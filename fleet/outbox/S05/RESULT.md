# S05: local midnight alarms

PASS. Copy-ready `time.ts` and `time.test.ts` are here. B02 owns integration. No files outside this outbox were written. Cost: $0.
All 28 Node tests pass. workerd passes 15 exact fixtures plus 2,569 daily boundaries. Required zones, DST changes, catch-up caps, and timezone moves are covered.
The helper increments a calendar date, tries three offset corrections, then binary-searches a missing midnight to millisecond precision. Entirely skipped dates create no extra burn. Weekday is Sunday=0.
## Durable Object integration
Persist `last_tick_ms`, `last_midnight_key`, and `tz`. On pairing, initialize the cursor to now and the key to today's local date. Do not burn a day before creation.
For each returned `t`, the boundary key is `localDayKey(t, tz)`. The day being CLOSED is `localDayKey(t - 1, tz)`.
Use that closed day's cached weather decision, keyed by timezone and date. If absent, use `burrowed=false` and log `catchup_weather_missing` with its date and timezone. Never substitute today's forecast for missed days.
Set the engine state's closing-day `burrowed` BEFORE calling `midnight(state, nextBurrowed)`. Use the entering day's cached decision or false for historical days. Once caught up, fetch current-day weather. A live forecast failure follows the architecture's previous-decision fallback.
`applyTickAtomically` must re-read state in a storage transaction. If `t <= last_tick_ms`, do nothing. If `key <= last_midnight_key`, skip the engine. Otherwise apply it and persist the key, state, history, and gravestone together. Persist the cursor even for a skipped key. Keep the key as a high-water mark.
Serialize alarm, feed, and timezone mutations. Fetch weather outside the write transaction. Catch up before accepting new-day steps. Do not let a concurrent feed be overwritten by stale state.
Process at most 14 ticks per handler, oldest first. Retain any debt. A 30-day gap needs batches of 14, 14, and 2. Never advance the cursor straight to now to discard older days.
```ts
async alarm() {
  try {
    const s = await load();
    for (const t of missedMidnights(s.last_tick_ms, Date.now(), s.tz, 14)) {
      await applyTickAtomically(t, s.tz);
    }
    const latest = await load();
    const now = Date.now();
    const overdue = nextLocalMidnight(latest.last_tick_ms, latest.tz) <= now;
    if (!overdue) await refreshCurrentDayWeather(latest.tz);
    await this.ctx.storage.setAlarm(overdue ? now + 1000 : nextLocalMidnight(now, latest.tz));
  } catch (error) {
    console.error("midnight_alarm_failed", error);
    await this.ctx.storage.setAlarm(Date.now() + 60_000);
  }
}
```
The catch schedules an explicit retry. If scheduling itself fails, let that error escape for platform retries. Committed ticks remain safe to repeat.
On pairing or a timezone change: `await this.ctx.storage.setAlarm(nextLocalMidnight(now, tz));`. Persist the baseline and alarm together in an async storage transaction. This replaces the old alarm.
Validate a new zone first. Drain old-zone debt before changing it, or defer the change until debt is drained. Then set `last_tick_ms=now`, update `tz`, and keep `last_midnight_key=max(previousKey, localDayKey(now, tz))`. Do not replay today's elapsed midnight in the new zone.
The key guard prevents a second burn after westward travel. Test: after Muscat's Oct 8 tick at Oct 7 20:00Z, Berlin's Oct 8 boundary at 22:00Z is skipped. Its cursor still advances.
[Cloudflare alarms](https://developers.cloudflare.com/durable-objects/api/alarms/): one alarm per object, at-least-once delivery, six retries starting at two seconds. Reschedule inside `alarm()`. Do not infer pending debt from `getAlarm()`, which is normally null during the handler. Constructors must not overwrite an existing alarm.
## Intl and runtime notes
Node v22.23.3 uses ICU 78.3 and tzdb 2026c. Installed workerd is 2026-10-06. Both returned hour `00` with `h23`. A mock forces `24` to test normalization without incrementing the printed date.
Pin Gregorian calendar, Latin digits, locale, and timezone. Do not specify `hour12`, which overrides `hourCycle`. Strip milliseconds before computing UTC offsets. Reject numeric offset strings and an absent timezone to avoid runtime/default-zone differences.
[Cloudflare standards](https://developers.cloudflare.com/workers/runtime-apis/web-standards/) documents Intl support, not a pinned tzdb version. It also notes that `Date.now()` only advances after I/O. No Node/workerd differences occurred in the checked fixtures.
[IANA Brazil rules](https://github.com/eggert/tz/blob/main/southamerica) specify `Rule Brazil 2018 only - Nov Sun>=1 0:00 1:00 -`. Sao Paulo's missing 2018-11-04 midnight resolves to 03:00Z, local 01:00. Tests also cover Kathmandu's 00:15 start, Havana's repeated midnight, and Apia's skipped date.
## Verification
From repo root: `node --test fleet/outbox/S05/time.test.ts`. Exact summary:
```text
1..28
# tests 28
# suites 0
# pass 28
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 931.935644
```
Full pasted TAP: `TEST_OUTPUT.txt`. `TZ=Pacific/Honolulu node --test fleet/outbox/S05/time.test.ts` also passed all 28.
`worker/node_modules/.bin/workerd test fleet/outbox/S05/workerd.capnp`: `PASS: 15 exact fixtures, catch-up checks, 2569 calendar boundaries; h23 midnight=00`. Full output: `WORKERD_OUTPUT.txt`. `time.workerd.js` is a type-stripped copy for this check only.
Strict typecheck passed with no diagnostics: `node worker/node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler --allowImportingTsExtensions --typeRoots worker/node_modules/@types --types node fleet/outbox/S05/time.ts fleet/outbox/S05/time.test.ts`.
Open: B02 must wire and test the storage transaction, duplicate-alarm guard, weather cache, and retry schedule. No deployed DO alarm was exercised. No installs or git mutations were run.
