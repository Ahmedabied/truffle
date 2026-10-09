# Companion v2 public release acceptance

October 9, 2026. Source `d8a51ed` is deployed to both services:

| Service | Version |
| --- | --- |
| API | `c5ea5b7c-336b-4fff-a557-3ad4a9086334` |
| Web | `3b5bbf7c-8100-46af-8219-38a5dadd109c` |

Both deployments completed before the prospective cutover,
`2026-10-09T08:43:00Z`. The independently audited legacy-cursor guard remained
in the deployed source. The [public web acceptance](../fleet25-public-web.md)
verified the expected JS/CSS, complete mushroom, full mobile width and direct
sample walk. The sample used no API or model requests.

## Live food migration

Root created a separate, non-demo test pet at 08:35:16 UTC, in Asia/Muscat,
with synthetic steps. The user's selected pet and phone were not accessed.
The test fixture accepted 4,000 steps before cutover and admitted a rest-away
job. Legacy public state showed 4,000 food and capacity 6,000. Credentials
remain in an ignored, private local fixture; none appear in these artifacts.

At 08:44:08 UTC, the same credentials returned generation zero, the same zone,
4,000 daily/lifetime steps, a living unsheltered pet and the same pending job.
Capacity was now 12,000. Displayed food was 3,999, matching the fixed-point
balance of about 3,999.22 after elapsed upkeep from cutover. There was no new
midnight or stage debit. [Sanitized migration observation](migration.json).
The public API does not expose the internal energy-version field; this checks
its observable migration behavior. It is one live fixture, not a census of all
existing pets. Preservation of older memories/graves and settled history also
has separate SQL integration coverage in the [final audit](../fleet25-25-final.md).

## Actual background gift and replay protection

The accepted job was due at **08:45:18.151 UTC**. A GET at 08:45:33 UTC, before
any return request, found a completed **Paper bouquet**, no pending job, and a
creation timestamp of **08:45:18.151 UTC**. Only the server alarm calls the gift
settler; reading state or rendering a preview cannot manufacture this result.

The gift has seven lines of procedural ASCII art and authored English/Arabic
notes. Its provenance is explicit. Food was 3,998, matching elapsed upkeep at
about 3,998.23. No gift charge or model request occurred.

Root then verified:

- Returning preserves the same single gift.
- A fresh away request on that pinned day succeeds as a no-op, with no new job
  or second gift.
- Replaying the same 4,000-step absolute total adds no food.

[Sanitized gift, timing and replay observation](gift.json). These values describe
synthetic activity in a real deployed pet, not physical walking. An initial
probe ran six seconds before the due time and exited at its own time guard;
the successful check occurred after the scheduled alarm.

A separate [production UI check](../fleet25-live-gift-ui.md) at 08:47:57 UTC
opened the actual server bouquet from its world object and from Pocket using
the keyboard. Art and note matched the server, provenance stayed visible, and
there were no browser errors or model requests.

The browser's signal still has to reach the server. Closing too soon can lose
an away request, and there is no cross-tab visible-presence coordination. The
server's owner/day/life fences bound gift creation in either case.

## Public Android artifact

[Version 0.4.0 test prerelease](https://github.com/Ahmedabied/truffle/releases/tag/v0.4.0-app)
was created at target `630a42e167eecf95e94f3c91b302547b47eca839`. The APK was built
on the workstation from `0a3c56c6d1c7ddfbfc0873560142e66ab2bf75bb`; Android app
and build inputs are unchanged at deployed integration source `d8a51ed`.

An anonymous HTTPS download returned all **12,588,066 bytes**. SHA-256 matches
both the source-built/emulator-installed artifact and the published checksum:

```text
1ddc5b0d50240a610078c36693580f4fa5074500a0aab1d7afd429f97ae47962
```

[Download record](apk-download.json). The APK is debug-signed and debuggable;
it is a sideload test prerelease. Workstation validation passed 129 JVM tests
and lint with 0 errors / 69 warnings. Synthetic native reloads preserved
settings and created fresh WebViews, but did not authenticate a live Truffle
owner. [Build and emulator record](../fleet25-24-release.md).

Eight anonymous evidence/asset/health URLs returned HTTP 200, including the
published roster, native and final audits, public browser report, current
screenshots and frame measurement. [URL checks](links.json). API health
`modal: true` means configured, not a measured warm adapted model.

## Boundaries

Final source checks passed 607 Worker tests, 436 web tests, 75 browser cases,
both typechecks and the web build. This release check used no paid inference,
training or model downloads. Provider totals remain unreconciled. Faster live
responses, independent model judging and blind Arabic preference remain open.

The phone stayed disconnected. Version 0.4 has no new physical ownership,
reaction, notification, battery, endurance, TalkBack or frame-rate evidence.
Historical version 0.3 observations are not relabelled as current APK proof.
The DEV article remains unpublished. Only reviewed, credential-free evidence
was added to Git; raw owner fixtures and private fleet output remain excluded.
