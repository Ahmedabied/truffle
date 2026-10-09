import type { StateSummary } from "../types";
import type { CompanionNote } from "./copy";
import { classifyIntent, type Intent } from "./intent";
import {
  companionScope, persistCompanion, readCompanion, readMovement, reduceCompanion,
  type CompanionContext, type CompanionEvent, type CompanionState, type ReactionKind,
} from "./state";

type Action = "away" | "return" | "cancel";
type AwayIntent = "walk" | "errand" | "rest";
export interface CompanionBinding {
  origin: string;
  pet: string;
  demo: boolean;
  /** Granted only by this document's successfully verified fragment import. */
  nativeScope?: string;
  request?: (action: Action, intent?: AwayIntent, requestId?: string, keepalive?: boolean, generation?: number, jobId?: string) => Promise<StateSummary>;
}
interface Deps {
  load: (key: string) => unknown;
  save: (key: string, value: unknown) => void;
  setReaction: (reaction: ReactionKind | null) => void;
  showNote: (note: CompanionNote | null) => void;
  requestState: () => void;
  onServerSummary: (summary: StateSummary) => void;
  now?: () => number;
  requestId?: () => string;
  visible?: boolean;
}

/** One verified life, one wall-clock timer. All network work is life-fenced. */
export class CompanionController {
  private state: CompanionState | null = null;
  private context: CompanionContext | null = null;
  private binding: CompanionBinding | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private serial = 0;
  private operation = 0;
  private snapshotVersion = 0;
  private awayRequestId: string | undefined;
  private awayReceipt: { requestId: string; jobId: string } | undefined;
  private work: Promise<void> = Promise.resolve();
  private awayAttempted = false;
  private pendingJobId: string | undefined;
  private visible = true;
  private readonly now: () => number;

  constructor(private d: Deps) { this.now = d.now ?? Date.now; this.visible = d.visible ?? true; }

  snapshot(binding: CompanionBinding, summary: StateSummary, fresh = true): void {
    this.snapshotVersion++;
    if (!Number.isSafeInteger(summary.generation) || summary.generation! < 0) { this.clear(); return; }
    const scope = companionScope(binding.origin, binding.pet, binding.demo, summary.generation!);
    if (this.context?.scope !== scope) {
      this.clear();
      this.state = readCompanion(this.d.load(scope), scope, this.now());
    }
    this.binding = binding;
    this.pendingJobId = summary.companion?.pending?.id;
    this.context = { scope, generation: summary.generation!, demo: binding.demo, ready: true,
      visible: this.visible, alive: !summary.state.dead && summary.mood !== "dead",
      burrowed: summary.state.burrowed || summary.mood === "burrowed", nativeScope: binding.nativeScope };
    this.dispatch({ type: "snapshot", scope, summary, fresh, at: this.now() });
  }

  /** Drops document authority and in-flight callbacks without erasing another life's storage. */
  clear(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.serial++;
    this.operation++;
    this.awayAttempted = false;
    this.pendingJobId = undefined;
    this.awayRequestId = undefined;
    this.awayReceipt = undefined;
    this.work = Promise.resolve();
    this.state = null;
    this.context = null;
    this.binding = null;
    this.d.setReaction(null);
    this.d.showNote(null);
  }

  acceptedMessage(message: string): void { this.intent(classifyIntent(message), "chat"); }

  intent(intent: Intent, source: "chat" | "button" = "button"): void {
    if (!this.context?.alive || intent.type === "none") return;
    this.d.showNote(null);
    const previous = this.state?.outing;
    this.dispatch({ type: "intent", intent, source, at: this.now() });
    if (intent.type === "plan" && this.state?.outing !== previous && this.state?.outing) {
      this.awayAttempted = false;
      void this.away(this.state.outing.kind);
    } else if ((intent.type === "back" || intent.type === "cancel") && previous && !this.state?.outing) {
      this.awayAttempted = false;
      void this.send(intent.type === "back" ? "return" : "cancel");
    } else if (intent.type === "quiet") {
      this.awayAttempted = false;
      void this.send("cancel");
    }
  }

  movement(raw: unknown): void {
    if (!this.context?.nativeScope || !this.context.ready) return;
    const event = readMovement(raw, this.context.nativeScope, this.context.scope, this.now());
    if (event) this.dispatch(event);
  }

  hidden(keepalive = true): void {
    this.visible = false;
    if (this.context) this.context.visible = false;
    this.dispatch({ type: "hidden", at: this.now() });
    if (this.context?.alive) void this.away(this.state?.outing?.kind ?? "rest", keepalive);
  }

  /** Cancel unstarted server work before the fresh return read. */
  async returned(): Promise<void> {
    this.visible = true;
    if (!this.context) { this.d.requestState(); return; }
    this.context.visible = true;
    const serial = this.serial;
    this.dispatch({ type: "tick", at: this.now() });
    this.dispatch({ type: "visible", at: this.now() }, false);
    this.awayAttempted = false;
    await this.send("return");
    if (serial === this.serial && this.context?.ready) this.d.requestState();
  }

  private away(intent: AwayIntent, keepalive = false): Promise<void> {
    if (this.awayAttempted || !this.context?.alive) return Promise.resolve();
    this.awayAttempted = true;
    return this.send("away", intent, keepalive);
  }

  private send(action: Action, intent?: AwayIntent, keepalive = false): Promise<void> {
    const binding = this.binding;
    const context = this.context;
    if (!binding?.request || !context?.ready || context.demo) return Promise.resolve();
    const serial = this.serial;
    const operation = ++this.operation;
    const requestId = action === "away" ? (this.d.requestId?.() ?? crypto.randomUUID()) : this.awayRequestId;
    if (action === "away") this.awayRequestId = requestId;
    // Capture the intended job now. A later poll or tab must not redirect a
    // queued return onto a different outing in the same life.
    const targetJobId = action === "away" ? undefined : this.pendingJobId;
    const run = async () => {
      if (serial !== this.serial) return;
      const snapshotVersion = this.snapshotVersion;
      const jobId = action === "away" ? undefined : targetJobId ??
        (this.awayReceipt?.requestId === requestId ? this.awayReceipt?.jobId : undefined);
      try {
        const summary = await binding.request!(action, intent, action === "away" || !jobId ? requestId : undefined, keepalive, context.generation, jobId);
        if (serial !== this.serial || summary.generation !== context.generation) return;
        // Keep the receipt identity for a return already in the queue, even
        // when that return superseded displaying the scheduling response.
        if (action === "away" && requestId && summary.companion?.pending) {
          this.awayReceipt = { requestId, jobId: summary.companion.pending.id };
        }
        if (operation !== this.operation || snapshotVersion !== this.snapshotVersion) return;
        // A receipt is the only evidence that a server job exists. No optimistic pending field.
        this.d.onServerSummary(summary);
      } catch {
        // Away is best effort. A failed request never promises background work.
      }
    };
    this.work = this.work.then(run, run);
    return this.work;
  }

  private dispatch(event: CompanionEvent, refresh = true): void {
    if (!this.state || !this.context) return;
    const result = reduceCompanion(this.state, event, this.context);
    this.state = result.state;
    for (const effect of result.effects) {
      if (effect.type === "reaction") this.d.setReaction(effect.reaction);
      else if (effect.type === "note") this.d.showNote(effect.note);
      else if (effect.type === "persist") this.d.save(this.state.scope, persistCompanion(this.state));
      else if (effect.type === "refresh" && refresh) this.d.requestState();
    }
    clearTimeout(this.timer);
    const next = Math.min(this.state.reaction?.until ?? Infinity, this.state.outing?.expiresAt ?? Infinity);
    if (Number.isFinite(next)) this.timer = setTimeout(() => this.dispatch({ type: "tick", at: this.now() }), Math.max(1, next - this.now()));
  }
}
