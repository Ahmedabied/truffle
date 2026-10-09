# 06 - Write-up plan

The unpublished article is [post_draft.md](post_draft.md): **No rescue mission: a Gemma pet that eats steps**. The [submission checklist](submission_checklist.md) owns exact release checkpoints and evidence boundaries.

## Contest format

The [official Week 1 page](https://dev.to/challenges/hacktoberfest-week1-2026-10-05) and its template were checked on October 9, 2026. Deadline: **October 11, 11:59 PM PDT**, or **October 12, 10:59 AM Oman**. Ahmed's preferred preparation date is Friday, October 9. Preparing the draft does not publish it.

Keep `published: false`, tags `devchallenge, hf26challenge`, and the seven required headings in order: What I Built; Demo; Code; How I Built It; Why Does Open Innovation Matter?; My Agent Session; Prize Categories. Enter **Best Use of Gemma**. Writing has the greatest judging weight; actual outdoor use is encouraged and an agent-session embed is optional. Credit human teammates by DEV handle if applicable. The October 7 project start is inside the window; disclose commits made after the deadline if any.

## Story and factual boundaries

The opening is a matched evaluation, not a personal anecdote. In `S12-076`, the fictional state says Phoenix, 46°C apparent temperature, Elder, 90% energy, three zero-energy nights and `burrowed=yes`. The base encourages a rescue walk; the adapter says there is no rescue mission. Both had the same prompt and state. Link the [base](../finetune/eval/out/2026-10-08-r16/base.jsonl) and [tuned](../finetune/eval/out/2026-10-08-r16/tuned.jsonl) replies, retain their case and mark the omission. This historical prompt format is not evidence about the current v2 prompt.

The story asks whether a creature that lives on steps can also know when to leave its person alone. Start with the food and conversation loop, then show why returning might matter: an expressive mushroom, a small invitation to notice something and a drawing made while away. Explain the v1 friction plainly: food taken at midnight and stage-dependent upkeep worked against carrying a busy day into a quiet one. Do not invent a personal outdoor diary or claim the redesign changed anyone's habits.

[Decision 0023](../decisions/0023_continuous_food_and_living_companion.md) is implemented source, no longer only an exploration. Food lasts across midnight and uses 1,000 points per actual elapsed day at every age. Shelter pauses both use and empty time. Death comes after 96 actual non-sheltered hours continuously empty, with a gravestone and explicit new-spore recovery. The trial rate and heat threshold are game rules, not health recommendations. Storage is bounded; historical discarded overflow is not refunded. Link [v2 goldens](../tests/golden/energy_v2_cases.json), preserving the original v1 cases for migration evidence.

Ordinary chat selects medium or lower effort, short greetings can select low, and deep thinking is explicit. Food thresholds are absolute: 20 / 1,500 / 3,600, with costs 20 / 60 / 200. A larger capacity cannot downgrade the same balance. Reservations and visible-text charging are code guarantees; considerate wording still needs model evaluation.

Gifts now come from real server alarm jobs after an authenticated away plan and at least ten minutes. Their drawing geometry is procedural and their notes are authored. They use no paid inference and no food. At most one arrives per pinned local day, with twelve server gifts retained. Old local keepsakes remain a labelled archive; previews do not count as earned gifts. Do not call gifts model-generated or globally unique. Browser absence signals are best effort, including a known cross-tab visible-presence limitation.

The world and chat remain central, with tools in Pocket. Every living stage is a full mushroom. Sleep stays anchored; anticipation has its own attentive expression. Natural English/Arabic plans and returns produce bounded reactions. A fresh native movement event changes presentation only, after verified ownership; it cannot claim outdoor activity or credited food.

Keep the matched fine-tune comparison central: 170 prompts, improvements, voice and nudge regressions, the missed phrase-based heat failure, and the same-base judge limit next to the table. Do not present style differences as proven judge bias. The harness predates current production guidance. Retain exact Apache 2.0 provenance from [NOTICE-GEMMA.md](../NOTICE-GEMMA.md), separate from MIT application code.

The estimated $1.81 describes the r16 training run's Modal credit only. The project has a $50 cap, provider totals are unreconciled, and no new paid inference was used for this v2 validation session. The four/eight-second trained-provider deadlines bound routing, not total reply time. Keep older cold-start and fallback timings historical; do not claim the new live experience is faster without measurement.

## Android and physical evidence

The 0.4 source adds fresh native movement reactions, coalesced feeding and clearer Walk periods. Today/7-day/30-day totals match their selected span. Missing native dates remain blank; recorded zero is distinct. Large glyphs scroll at larger font sizes. The native shell is English; the embedded web app and model support English and Arabic.

The final 0.4 workstation checkpoint `0a3c56c` passed 129 JVM tests and built with lint at 0 errors / 69 warnings. Emulator display checks used synthetic diaries. Three reloads created new stable WebViews and preserved synthetic owner settings. That reload fixture did not verify a live Truffle owner or JavaScript nonce acceptance; desktop browser tests cover the web boundary separately. [Artifact evidence](reviews/fleet25-24-release.md) records the checksum. No new physical phone tests exist. The public [0.4 release](https://github.com/Ahmedabied/truffle/releases/tag/v0.4.0-app) is a debug prerelease; its anonymous 12,588,066-byte download and published checksum match the built artifact. Build source `0a3c56c` is unchanged in Android at `d8a51ed`; the release targets `630a42e`.

The Samsung 0.3 observation remains **81 hardware-counter steps → a dated accepted feed → 81 food points and low tier**, under the older capacity rules. It proves a small sensor-to-budget path. There was no manually counted reference, route record or observation of outdoor surroundings. The separate Health Connect/Samsung Health comparison was zero after midnight. Never turn these into an accuracy percentage or merge them into one positive Health Connect test.

## Assets and demo

The article hero [day scene](reviews/ascii-art/after/day-scene.png) remains an explicitly earlier local capture. README now uses the [October 9 public offline sample](reviews/fleet25-public-web/sample-after-walk-390.png) after 4,000 simulated steps. Neither image is 0.4 handset evidence. The [art/motion record](reviews/fleet25-19-art-motion.md) shows new expressions. The final [full-width desktop storm sample](reviews/fleet25-19-art-motion/full-width/measurements.json) measured 58.91 fps over about ten seconds at 4× CPU slowdown, at 740 × 838.66 CSS pixels; the earlier smaller canvas measured 59.98 fps. A short earlier Samsung Chrome sample was also 60 fps; neither establishes sustained WebView performance or battery use.

Use the sample route `/demo?mock=1` for a repeatable, unpaid walkthrough: the direct **Try a 4,000-step walk** button; Everyday or explicit Think deeper; a labelled sample reply and charge; Take a moment and return; drawing preview; Next day (+24 hours), then the same advance with Heat day on. A preview demonstrates the generator, not a server alarm. The [public sample check](reviews/fleet25-public-web.md) verified the deployed assets, full mobile scene width and direct walk action without API calls. The other steps have local browser coverage; do not describe that public check as a live model or server-alarm test.

Keep reply provenance distinct: trained `r16`, untuned **half-awake**, and **offline demo** sample. A recording must label simulation and explain any cut across a reply wait. Do not use synthetic emulator numbers as physical walking evidence. Any public screenshot must be checked for ownership data.

## Final delivery and publication pass

API and web `d8a51ed` are deployed: API `c5ea5b7c-336b-4fff-a557-3ad4a9086334`, web `3b5bbf7c-8100-46af-8219-38a5dadd109c`, both before the 08:43 UTC cutover. Final validation passed 607 Worker tests, 436 web unit tests, 75 browser cases and 129 native tests. The [submission checklist](submission_checklist.md) links public sample acceptance, APK download/checksum and eight successful anonymous evidence-link checks. Separate live acceptance passed for one owned synthetic non-demo test pet: migration preserved its identity, date/zone, steps and pending job while adopting v2 capacity and elapsed upkeep; the server alarm created a Paper bouquet at its due time before any return request. Return retained it, another same-day away request was a successful no-op, and a duplicate feed added no food. [Migration](reviews/fleet25-live-release/migration.json) and [gift evidence](reviews/fleet25-live-release/gift.json). No existing user pet was touched and no model was called. These checks do not validate every existing pet or physical activity.

The article now links the public 0.4 APK and describes the actual 25-agent waves, with the roster as evidence. Keep the historical 0.3 physical limits, new 0.4 phone limits and unmeasured live inference latency. The article can describe the verified Paper bouquet appearing before return, with its synthetic-test scope and no model-generation claim. Preparing and verifying these artifacts still does not publish the DEV draft.

Preview DEV on desktop and phone, especially the hero, Arabic name and comparison table. Use plain human prose without em or en dashes, inflated win claims or an invented walk story. An optional agent-session embed needs a separately reviewed, sanitized excerpt; linked reports already document agent work. Leave `published: false`. No publishing or sending externally is authorized by this documentation task.
