# 06 - Write-up plan

The unpublished article is [post_draft.md](post_draft.md): **No rescue mission: a Gemma pet that eats steps**. It is approximately 1,600 words. The [submission checklist](submission_checklist.md) owns release and evidence checks, keeping the article a story.

## Contest format

The [official Week 1 page](https://dev.to/challenges/hacktoberfest-week1-2026-10-05) and its linked template were checked on October 9, 2026. Deadline: **October 11, 11:59 PM PDT**, or **October 12, 10:59 AM Oman**. Ahmed's preferred preparation date is Friday, October 9. Preparing this draft does not publish it.

Keep `published: false`, tags `devchallenge, hf26challenge`, and the seven template headings in order: What I Built; Demo; Code; How I Built It; Why Does Open Innovation Matter?; My Agent Session; Prize Categories. Enter **Best Use of Gemma**. Writing has the greatest judging weight; actual outdoor use is encouraged and an agent-session embed is optional. Credit human teammates by DEV handle if applicable. The October 7 project start is inside the window; disclose commits made after the deadline if any.

## Narrative decisions

The opening is a matched model evaluation, not a personal anecdote. In `S12-076`, the fictional state says Phoenix, 46°C apparent temperature, an Elder at 90% energy, three zero-energy nights, and `burrowed=yes`. The prompt offers to walk to save the creature. The base encourages it; the adapter says there is no rescue mission. Both received the same prompt and state. Link the [base](../finetune/eval/out/2026-10-08-r16/base.jsonl) and [tuned](../finetune/eval/out/2026-10-08-r16/tuned.jsonl) outputs; retain original case and the marked omission.

The story asks: **can a creature that lives on steps also know when to leave its person alone?** Explain the energy loop first, then give the return a reason to matter: a recognizable, expressive mushroom, an invitation to notice something, and a little ASCII gift after time away. The world, Pocket and native notebook support that story; do not turn the post into a feature inventory.

The final experience is an edge-to-edge world with chat underneath and tools in Pocket. Every living stage is a mushroom. Sleep has closed eyes and slow, anchored breathing; intelligence changes freckles and size modestly. Gifts are actual glyph objects; tapping opens their note in chat, with a keyboard alternative in Pocket. They are authored local fictions resolved on return, not a claim of background AI creation. Rest and heat days can receive them without steps.

The native counter makes a concrete bridge from movement to model budget. The verified Samsung observation is **81 hardware-counter steps → a dated accepted feed → 81/6,000 energy and low tier**. It earns a short field paragraph without inventing scenery, feelings, a route or outdoor presence. There was no manually counted reference. Ahmed's approximate recollection is not ground truth and should not be turned into a percentage error.

Keep the matched fine-tune experiment central: improvements, regressions, the failed phrase-based heat metric, and the same-base judge limit next to the table. Do not present the voice regression as established judge bias. The GPU cold start and fallback wait deserve a candid paragraph because they affect the experience.

The native shell is English; the embedded world and model support English and Arabic. Step totals cannot prove outdoor activity. Four unprotected empty-energy nights still cause a gravestone, so do not call the entire experience guilt-free or universally gentle.

## Assets and evidence

The hero now uses [the final day scene](reviews/ascii-art/after/day-scene.png), captured locally from a compiled browser build with simulated state. README uses [the full mobile composition](reviews/ascii-art/after/day-mobile.png). These are explicitly browser captures, not handset or walk records. [Art direction and verification](reviews/ascii-art-direction.md) and [raw measurements](reviews/ascii-art/after/measurements.json) document five scenes at 59.85–60.05 fps, 412×915, DPR 2, 4× CPU slowdown, with zero page errors and identical reduced-motion pixels.

The [placed gift](reviews/ascii-art/after/gift-scene.png) and [opened note](reviews/ascii-art/after/gift-open-mobile.png) can support a short montage. Do not add every screenshot to the article: the opening comparison, hero, demo and result table already carry the narrative. Use an actual reviewed handset image for the 81-step paragraph if it adds clear information and exposes no ownership data.

The strongest optional recording is continuous: sleeping mushroom, phone put away, returned feed, actual reply and model identity; a simulated heat segment must be labelled. A recording is not permission to invent an observation or conceal a long reply wait through an unexplained cut.

The three reply types must remain distinct: trained `r16`, untuned **half-awake**, and **offline demo** sample. The sanitized earlier browser timing link is [recorded-browser-latencies.json](reviews/recorded-browser-latencies.json), not its unsanitized source artifact. It predates the latest stream fixes.

## Final evidence updates

The draft already includes the physically observed 81-step direct-counter feed. Initial Health Connect/Samsung Health agreement was a separate zero-step check. Native 0.3 upgrades retained ownership. Do not merge these observations into a Samsung Health accuracy result.

At the editorial checkpoint, Worker typecheck and 428 tests passed; web typecheck, 177 unit tests, 30 browser cases and production build passed. The latest native fixes address initial cached sensor timestamps and ordinary-midnight rollover. Wait for the final native test/build count and APK install report before assigning those results to a release.

Root still needs to supply the new deployed revision, the anonymous public Pocket walkthrough and the physical-phone measurement for the 60 fps renderer. The prior Samsung 30 fps sample belongs to `283e981`; it cannot validate the new renderer. When the new result arrives, replace the article's pending phone statement with the measured scene, duration and scope, and update README and checklist consistently. A short on-screen sample must not become a sustained performance claim.

The 81-step result demonstrates the sensor-to-energy path. Accuracy against a counted reference, long-running battery/background reliability, independent model judging, blind Arabic preference and changed habits remain unproved. Preserve those limits when adding new evidence.

## Publication pass

Verify the exact Pocket-based demo flow after deployment, then remove the temporary build-status note from README and resolve the article's publication-gate comment. Check each GitHub/raw URL after assets and reports are pushed. Link an APK only once its public download and checksum are verified.

Preview the rendered DEV article on desktop and phone, especially the hero, Arabic name and result table. Keep the exact Gemma 4 Apache 2.0 provenance from [NOTICE-GEMMA.md](../NOTICE-GEMMA.md); do not reintroduce older Gemma terms. Use linked task reports for agent-process evidence unless a locally sanitized excerpt has been reviewed. No publication is authorized by preparing these files.

## Final integration evidence, October 9

Final web: 177 unit tests and 40 browser cases; Worker: 428; Android: 101.
The direct 81-step upload, repeated-feed idempotence and native World ownership
are documented. A short Samsung Chrome sample reads 60 fps. Public walkthrough
passes; high/low live fallback first-visible times are approximately 53/27 seconds.
The trained adapter was not the provider in those two checks. The energy economy
report is an exploration, not released behavior. Keep the draft unpublished.
