# B10 worker_output_guards: result

Builder: Opus. Cost: 0 (no paid runs; the smoke chat used the local wrangler dev Workers AI binding).
Nothing committed. Changes only in worker/ plus this report.

## Files

- `worker/src/guards.ts` (new): `BlockGuard`, `PRIVATE_LINE`, `heatLine`, `heatTemp`, `voiceHits`.
- `worker/src/blocklist.generated.ts` (new, generated): copy of `finetune/filters/blocklist_en.txt` and `blocklist_ar.txt`.
- `worker/scripts/gen-blocklist.mjs` (new): `node worker/scripts/gen-blocklist.mjs` regenerates the module.
- `worker/src/do.ts`: chat stream goes through the guard, heat line, `block_leak`, `heat_line`, `voice_flag`, `facts_failed` logs.
- `worker/src/brain.ts`: `extractFacts(env, transcript, onError?)` reports the error class.
- `worker/test/b10-guards.test.ts` (new): 29 tests.

No change to tiers, token caps, costs, goldens, web/, feeder-android/, finetune/, brain-modal/.

## Evidence per item

### 1. Status block never reaches the client

- `BlockGuard` sits between the brain stream and `send("token")`. It replaces a closed `[truffle ...]` that holds at least one field (`stage=`, `energy=` and so on) and any run of two or more `field=value` pairs with `PRIVATE_LINE[lang]`:
  en "that line is private, even from me", ar "هذا السطر سري، حتى عني".
- Holding rules: text is held only while it could still be a status line: a partial `[truffle ` at the end (at most 8 chars), an open `[truffle ` block until its `]` (cap 400 chars), trailing field pairs, or a last word that could still become `field=` (at most 12 chars). Ordinary text goes out in the same push.
- A block cut off by the token limit is still replaced at flush. `[Truffle yawns]` and a single `energy=good` are not leaks.
- `reply` (charged, stored as the assistant turn, used for the empty-reply check) is the guarded text, so a leaked block never re-enters context.
- One `block_leak` log per reply: `{count, tier, brain}`.
- Tests: whole block, split at every index of the reply (2 chunks), one char at a time, bare run across 4 chunks, truncated block, Arabic line, no-hold for plain text, prefix hold bounded, false positives, and the DO chat test: block split across two SSE chunks, asserts no token event carries any part of it, `block_leak` logged once, stored turn equals what the client saw.

### 2. Heat line from code

- When `s.burrowed` at admission, the Worker sends one line then `\n` before the model text:
  en `44C outside. Truffle is under the sand. Walk after sunset or indoors.`
  ar `44C برا. ترافل تحت الرمل. امش بعد المغرب أو داخل البيت.`
- Number: the current apparent temperature if valid (-90..70, same range as the state block weather), else today's daytime max (`Up to 47C today.`), else no number (`Too hot outside today.` / `الجو حار واجد اليوم.`).
- Model path: the line is sent just before the first visible text, so an empty reply (error, nothing charged) shows no heat line. Asleep tier: sent before the canned line.
- The line is not stored as a turn (the model sees only its own words). Logged as `heat_line {lang, temp}`.
- Live on wrangler dev, demo Truffle with heat on: first token event was `{"t":"34C outside. Truffle is under the sand. Walk after sunset or indoors.\n"}`, then the model reply.

### 3. Fact extraction failures logged

- `extractFacts` still never throws. On failure it calls `onError` with `e.constructor.name` (`TypeError`, `SyntaxError`, ...) or `BadShape` when the reply has no facts list. An honest empty list is not a failure.
- `rememberFrom` logs `facts_failed {error}`. Test checks the message text (`Sara lives in Ruwi`) never reaches the log.

### 4. voice_flag

- `voiceHits` mirrors `finetune/filter.py` TermList (NFKC, lowercase, Arabic diacritics and alef/yaa folding, whole token, `word*` prefix, phrases, Arabic prefix stripping) but returns every entry hit, each once.
- One `voice_flag {terms, tier, brain}` per model reply with hits. The reply is not altered (test asserts the visible text is unchanged). Not run on canned asleep lines.
- A test checks the generated module equals the source lists, so a list edit without rerunning the script fails CI.

## Verification output

Before: `Tests  291 passed (291)`.

After:
```
$ cd worker && npm test
 Test Files  15 passed (15)
      Tests  320 passed (320)
$ npx tsc --noEmit
tsc clean
$ wrangler dev --ip 127.0.0.1 --port 8787 &  ;  scripts/smoke.sh http://127.0.0.1:8787
SMOKE OK against http://127.0.0.1:8787 (real phrase guacamole-pinto-mallow, demo phrase iris-garage-granola)
```
Wrangler stopped afterwards. Dash check on all touched files: no en or em dashes.

## Open questions

1. Demo heat toggle shows the real current temperature. In the live check it said "34C outside" while burrowed, which reads oddly. Options: for demo Truffles use a fixed demo number, or prefer today's daytime max when it is the reason for the burrow. Left as is: it is honest.
2. Leak replacement uses the Truffle's stored lang, not the reply's language. An Arabic reply on an `en` Truffle gets the English line.
3. The guard holds a trailing word that could be a field name ("energy", "mood", "t"), so such a word reaches the client one chunk later. Cost is one chunk of latency, never more than 12 chars.
4. Single isolated `field=value` pairs are left alone on purpose (false positive risk). If the fine-tune eval shows single-field leaks, tighten to one pair of the rarer keys (`zero_days=`, `steps_today=`, `avg7=`, `age_days=`).
5. Not done here (out of scope, packet says the low tier cap is an open decision): the 60-word budget from C02/C04 R1 is still not enforced at runtime.
