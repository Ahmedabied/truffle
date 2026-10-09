import { TIER_ORDER, type TruffleState } from "./engine";
import type { Tier } from "./config";

/** Request policy, separate from the engine's available intelligence. */
export function conversationEffort(
  state: Pick<TruffleState, "energy_version">,
  message: string,
  requested?: Tier
): Tier | undefined {
  if (state.energy_version !== 2) return requested;
  if (requested !== undefined && TIER_ORDER.includes(requested)) return requested;
  // Only complete short greetings take the small-reply path. A greeting before
  // a question or plan must not silently reduce the useful answer's length.
  const greeting = message.normalize("NFKC").trim().toLowerCase()
    .replace(/[!.,?؟،؛\s]+$/u, "").replace(/\s+/gu, " ");
  return /^(?:hi|hello|hey|good morning|good evening|good afternoon|thanks|thank you|هلا|هلا فيك|مرحبا|مرحباً|مرحبا بك|اهلا|أهلا|أهلًا|السلام عليكم|صباح الخير|مساء الخير|شكرا|شكرًا)$/u.test(greeting)
    ? "low" : "medium";
}
