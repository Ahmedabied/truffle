# 05 - Fleet orchestration

Three kinds of workers, one production line.

| Role | Who | How to launch | Effort | Count | Job |
|---|---|---|---|---|---|
| **Production line** | Fable 5.1 (the main session) | you are it | high | 1 | Owns STATE/HANDOFF, integrates, merges, decides, writes the post with Ahmed |
| **Builders / reviewers** | Opus 5.5 | `Agent(model: "opus", effort: "medium", ...)` | medium | **5 max at once** | Build one module each against a packet with tests; review astra output before anything merges |
| **Astra fleet** | GPT gpt-6-astra | `Agent(subagent_type: "gpt:max")` (ultra) or `gpt:deep` | xhigh | **25+ at once** | Spikes, dataset shards, red-team, write-up critique. Never on the critical path |

Hard constraints:

- The gpt plugin **refuses** unless Ahmed's own message asks for GPT/astra. The session that launches a wave must start from a message that says "use the astra fleet" (or GPT/Codex).
- ChatGPT plan may end **~Oct 9** and weekly usage was 80% on Oct 7. **Run Wave A tonight and Wave B Thursday.** Design every astra task so that losing the fleet on Friday costs nothing critical.
- Astra output is **input, not truth**. An Opus reviewer or Fable checks every packet result against its acceptance criteria before it is used. Astra does not commit to `main`.
- No secrets in packets. Agents get URLs and public model names, never tokens. Anything needing a token (Modal deploy, HF download) runs in the main session.
- Everything an agent produces lands in `fleet/outbox/<packet-id>/` with a `RESULT.md` on top. Raw dumps go in `raw/` (gitignored).

## Task packet format (`fleet/packets/<id>_<slug>.md`)

```
# <id> <title>
Owner: astra | opus        Wave: A | B | C        Due: <Oman time>
Goal: one sentence.
Inputs: files/URLs the agent must read first (always docs/01 and docs/02 for builders).
Deliverable: exact files to produce in fleet/outbox/<id>/ (or the module path for builders).
Acceptance: checklist. Tests that must pass. Numbers that must be reported.
Do not: scope fences.
Report: RESULT.md with: what was done, evidence (command + output), open questions, cost if any.
```

Prompts to agents must be self-contained: paste the packet, the relevant spec sections, and the repo path. Agents do not have this conversation.

## Waves

### Wave A - spikes (Wed night Oct 7, astra x 10, 60 - 90 min)

| id | Spike | Acceptance |
|---|---|---|
| S01 | vLLM + `RedHatAI/gemma-4-31B-it-FP8-dynamic` + a dummy rank-16 LoRA on Modal L40S: does it load, cold start with/without snapshot, warm p50 at 120/400/1200 tokens, thinking on/off | A `modal_app.py` that runs, numbers in a table, exact vLLM/transformers versions pinned. Cost logged. **This one needs a Modal token, so astra writes the script and the main session runs it.** |
| S02 | Health Connect Kotlin minimal feeder: project skeleton, manifest permissions, rationale activity, aggregate steps since midnight, WorkManager hourly, POST JSON | Compiles with Gradle on the box; a dry-run README with the exact Samsung Health > Health Connect steps |
| S03 | Workers AI `@cf/google/gemma-4-26b-a4b-it`: streaming, thinking toggle, JSON-schema output for fact extraction | A Worker snippet and observed behaviour, with the response shape pasted |
| S04 | Open-Meteo: exact URL for our fields, response parsing, Muscat today vs a reference; burrow threshold sanity for 5 cities (Muscat, Riyadh, Phoenix, Berlin, Kuala Lumpur) | Parser function + table |
| S05 | Next-local-midnight from IANA tz in Workers (no Luxon if possible, `Intl` only), tested on `Asia/Muscat` and `Europe/Berlin` across a DST change; DO alarm catch-up design | Pure function + Vitest cases |
| S06 | Modal plan/credits: confirm $30 Starter credit, GPU concurrency, L40S availability, snapshot API usage with vLLM, bearer-auth proxy pattern | A short memo with doc links and a code pattern |
| S07 | DEV agent-session upload: locate this project's Claude Code `.jsonl`, dry-run the parser expectations, redaction behaviour, embed syntax after upload | Memo. No upload yet (that is Saturday, from the main session) |
| S08 | ASCII world rendering on phones: `<pre>` grid performance at 40x28 at 12fps on a mid Android, font choice for Arabic + box drawing, `prefers-reduced-motion` | A standalone `web/spike/ascii.html` that runs and a note on what jittered |
| S09 | Gemma 4 base behaviour with our state block, Arabic and English, 10 prompts each on Workers AI 26B: does it read the block without training? | 20 transcripts in outbox + a one-paragraph verdict (this is also the baseline for the eval) |
| S10 | Red-team the energy rules in `docs/01` and the goldens: find exploits (feed spam, clock games, tz change to dodge midnight, slider abuse in demo) | A list of holes with a proposed fix for each |

### Wave B - dataset (Thu Oct 8, astra x 12 - 15, after Ahmed's 30 seed lines land)

- One shard per `(mood, lang)` pair, each shard covering all tiers and intents: 6 moods x 3 langs = 18 shards, ~100 examples each. Launch 12 - 15 at a time.
- Each shard agent gets: the seed lines, the state block format, the length budgets, the safety rails, 3 fully worked examples, and the exact JSONL schema (`{"messages":[{role,content},...], "meta":{mood,tier,lang,intent}}`).
- Output: `fleet/outbox/D<nn>/shard.jsonl` + `RESULT.md` with counts per tier and a self-check against the budgets.
- Opus reviewer (1 agent) runs the filters from `docs/03` across all shards and produces `finetune/data/generated/train.jsonl` + `eval_holdout.jsonl` + a report.

### Wave C - red-team and critique (Fri Oct 9 if the plan is still alive, else Opus does it)

- 5 astra agents try to jailbreak the deployed Truffle at low tier into long/thinking answers (they cannot: the Worker caps it; they document the attempts and Truffle's in-character responses for the post).
- 3 astra agents critique the draft post against the judging criteria and the voice rules, each returning a ranked list of 5 cuts and 5 additions.

### Opus builders (5, from Wed night onward, medium effort)

| id | Module | Packet acceptance |
|---|---|---|
| B01 | `worker/` engine + goldens runner | All 30 goldens pass; engine is pure; `npm test` green |
| B02 | `worker/` routes, DO, alarm, weather, brain router, prompt builder | `wrangler dev` works end to end against a fake brain; fallback path tested; no secrets in repo |
| B03 | `web/` ASCII world + chat + judge mode | Runs on Ahmed's phone; reduced motion; RTL chat; demo controls drive the real engine |
| B04 | `feeder-android/` Kotlin app | APK builds on the box; real steps arrive at `/feed` from Ahmed's phone |
| B05 | `finetune/` pipeline: data filters, Unsloth train script, eval harness, results table | Train script dry-runs on 20 examples locally in CPU mode for syntax; full run in main session; eval produces RESULTS.md |

Builders report with evidence (commands + output). Fable integrates in `main`. Only Fable merges.

## Cost ledger

`fleet/costs.md`. One line per paid run: date, what, provider, GPU, minutes, $. Running total at the bottom. Cap $50.

## Daily rhythm

- Morning (Oman): Fable reads outbox results, updates STATE, cuts packets for the day.
- Midday: Opus builders run; astra waves run in parallel where they are off the critical path.
- Evening: Ahmed walks (diary), tests on his phone, writes seed lines or diary entries.
- Night: integrate, verify on phone, update STATE/HANDOFF, commit.
