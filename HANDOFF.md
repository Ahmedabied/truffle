# HANDOFF -> Session 02 (build kickoff)

Start in `~/Desktop/Truffle`. Read `CLAUDE.md`, `STATE.md`, then this.

## Ahmed's first message should say

"Build Truffle. Use the astra fleet (GPT) for Wave A and the Opus builders." The gpt plugin only runs when his message asks for GPT/astra.

## First 30 minutes

1. Confirm Ahmed's sign-ins are done (DEV, promos, Modal, HF token, Cloudflare). Collect tokens via the `!` prefix, never pasted in chat. Put them in `worker/.dev.vars` and Modal secrets. Grep the repo for secrets before the first commit.
2. Launch **Wave A** (S01 - S10) from `fleet/packets/`. S01 needs a Modal token: astra writes `brain-modal/modal_app.py`, the main session deploys and measures.
3. Launch **B01** (engine + goldens) and **B02** (Worker routes/DO) Opus builders in parallel. B01 is pure code; B02 can stub the engine until B01 lands.
4. Scaffold `worker/` with `npm create cloudflare@latest` (Hono template), `web/` with Vite vanilla-ts. Commit the scaffolds.

## Thursday morning

- Read `fleet/outbox/S01/RESULT.md` first. Decide Plan A or B. Write `decisions/0011_serving_plan.md`.
- Start B03 (web), B04 (feeder: build on the box per findings/02, not on the laptop), B05 (finetune pipeline).
- Ahmed's seed lines due noon -> launch Wave B.

## Things that will bite

- `request.cf` is undefined in `wrangler dev` locally; guard with defaults (Muscat, Asia/Muscat, OM, ar).
- DO alarms: one per object; reschedule inside `alarm()`; test catch-up when multiple midnights were missed.
- Health Connect auto-revokes permissions on unused apps. Feeder must handle `SecurityException` and prompt again.
- Gemma 4 chat template on the 31B inserts empty reasoning blocks when thinking is off; parse with `--reasoning-parser gemma4`.
- Don't let any agent download weights to the laptop (9GB free).

## Deliverable for end of Thursday

Truffle talks on Ahmed's phone with real steps (via Tasker), via the Workers AI fallback brain, with the ASCII world showing real energy and real Muscat weather. Diary day 1 happens.
