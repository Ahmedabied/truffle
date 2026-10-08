/** Reproducible exploratory scenarios and assertions. No paid/model/network calls. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { DEFAULT_STATE, feed, midnight, decideTier, stageConfig } from "../../worker/src/engine";
import { localDayKey, nextLocalMidnight } from "../../worker/src/time";
import { DAY, MODELS, Pet, settings, minLife, type Model } from "./models";

const START = "2026-10-09T12:00:00+04:00";
const MIDNIGHT = "2026-10-09T00:00:00+04:00";
const elder = { lifetime_steps: 100000, energy: 0 };
type Result = Record<string, unknown>;
export function run(here: string) {
  const tests: string[] = [];
  function check(name: string, f: () => void) { f(); tests.push(name); }
  const scenarios: Result = {};
  const each = (f: (m: Model) => unknown) => Object.fromEntries(MODELS.map(m => [m, f(m)]));

  scenarios.midnight_cliff = each(m => {
    const runAt = (time: string) => {
      const p = new Pet(m, "2026-10-09T23:58:00+04:00", elder);
      p.advance(time).feed(1000).advance("2026-10-10T00:02:00+04:00");
      return p.snapshot();
    };
    const before = runAt("2026-10-09T23:59:00+04:00");
    const after = runAt("2026-10-10T00:01:00+04:00");
    check(`${m}: late walk has only elapsed-time disadvantage when continuous`, () => {
      if (m === "current") { assert.equal(before.total, 0); assert.equal(after.total, 1000); }
      else assert(Math.abs((after.total - before.total) - (settings[m].flat_burn ?? 7000) * 2 / 1440) < 0.000002);
    });
    return { before_midnight: before, after_midnight: after, gap: Math.round((after.total - before.total) * 1e6) / 1e6 };
  });

  scenarios.new_pet_15000_then_rest = each(m => {
    const p = new Pet(m, START).feed(15000);
    const rows = [{ after_days: 0, ...p.snapshot() }];
    for (const day of [1, 2, 3, 7, 15, 20]) {
      p.advance(p.start + day * DAY);
      rows.push({ after_days: day, ...p.snapshot() });
    }
    return rows;
  });

  scenarios.elder_10000_ten_auto_then_full_calendar_rest = each(m => {
    const p = new Pet(m, START, elder).feed(10000);
    for (let i = 0; i < 10; i++) p.chat();
    const afterConversation = p.snapshot();
    p.advance("2026-10-10T00:00:00+04:00");
    const activeDayClosed = p.snapshot();
    p.advance("2026-10-11T00:00:00+04:00").chat();
    return { after_conversation: afterConversation, active_day_closed: activeDayClosed, after_full_rest_day_and_check_in: p.snapshot() };
  });

  scenarios.elder_3500_daily_ten_auto = each(m => {
    const p = new Pet(m, MIDNIGHT, elder);
    const rows = [];
    for (let day = 0; day < 14; day++) {
      p.advance(p.start + day * DAY + DAY / 2).feed(3500);
      for (let i = 0; i < 10; i++) p.chat();
      p.advance(p.start + (day + 1) * DAY);
      rows.push({ day: day + 1, ...p.snapshot() });
    }
    return rows;
  });

  scenarios.elder_7000_daily_no_chat = each(m => {
    const p = new Pet(m, MIDNIGHT, elder);
    const rows = [];
    for (let day = 0; day < 7; day++) {
      p.advance(p.start + day * DAY + DAY / 2).feed(7000).advance(p.start + (day + 1) * DAY);
      rows.push({ day: day + 1, ...p.snapshot() });
    }
    return rows;
  });

  scenarios.chat_heavy_3500_daily = each(m => {
    const runChats = (explicitLow: boolean) => {
      const p = new Pet(m, MIDNIGHT, { ...elder, energy: 30000 });
      const rows = [];
      for (let day = 0; day < 14; day++) {
        p.advance(p.start + day * DAY + DAY / 2).feed(3500);
        // 30 chats over 10h, 3 each hour. This remains below the production
        // 20/hour limit and tests the economy, not provider quality.
        for (let i = 0; i < 30; i++) {
          p.advance(p.start + day * DAY + DAY / 2 + i * 20 * 60000).chat(explicitLow ? "low" : undefined);
        }
        p.advance(p.start + (day + 1) * DAY);
        rows.push({ day: day + 1, ...p.snapshot() });
      }
      return rows;
    };
    return { auto: runChats(false), short_requested_low: runChats(true) };
  });

  scenarios.useful_chat_drain_and_rest = each(m => {
    const runDrain = (withChat: boolean) => {
      const p = new Pet(m, START, { ...elder, energy: 2000 });
      if (withChat) {
        // 100 successful low requests over 10h, below hourly rate limits.
        for (let i = 0; i < 100; i++) p.advance(p.start + i * 6 * 60000).chat("low");
      }
      p.advance(p.start + 7 * DAY);
      return p.snapshot();
    };
    return { no_chat: runDrain(false), useful_low_chat: runDrain(true) };
  });

  scenarios.heat_four_days = each(m => {
    const p = new Pet(m, MIDNIGHT, { ...elder, burrowed: true, zero_days: 2 });
    p.emptyMs = 2 * DAY;
    p.advance(p.start + 4 * DAY);
    check(`${m}: four protected heat days advance neither burn nor starvation`, () => {
      assert.equal(p.s.dead, false); assert.equal(p.s.zero_days, 2); assert.equal(p.metrics.basal, 0);
    });
    const protectedEmpty = p.snapshot();
    p.feed(3000);
    check(`${m}: heat feed stores energy but cannot grow`, () => { assert.equal(p.s.lifetime_steps, 100000); assert.equal(p.total, 3000); });
    return { protected_empty: protectedEmpty, indoor_feed: p.snapshot() };
  });

  scenarios.offline_catchup = each(m => {
    const weather = { "2026-10-11": true, "2026-10-12": true, "2026-10-13": true, "2026-10-14": true, "2026-10-15": false };
    const offline = new Pet(m, MIDNIGHT, { ...elder, energy: 30000 }, "Asia/Muscat", weather);
    const online = new Pet(m, MIDNIGHT, { ...elder, energy: 30000 }, "Asia/Muscat", weather);
    offline.advance(offline.start + 8 * DAY);
    for (let hour = 1; hour <= 8 * 24; hour++) online.advance(online.start + hour * 3600000);
    check(`${m}: 8-day offline settlement equals hourly reads including four heat days`, () => {
      for (const key of ["total", "ready", "stored", "zero_days", "dead", "lifetime_steps", "steps_today", "basal", "death_hours"] as const) assert.equal(offline.snapshot()[key], online.snapshot()[key], key);
      const snapshot = offline.snapshot(); offline.advance(offline.now); assert.deepEqual(offline.snapshot(), snapshot);
    });
    return { one_catchup: offline.snapshot(), hourly_reads: online.snapshot() };
  });

  scenarios.growth_boundary = each(m => {
    const p = new Pet(m, "2026-10-09T23:59:00+04:00", { lifetime_steps: 99999, energy: 12000 });
    const before = p.snapshot(); const rateBefore = p.rate;
    p.feed(1);
    const grown = p.snapshot(); const rateAfter = p.rate;
    p.advance("2026-10-10T00:01:00+04:00");
    check(`${m}: growth conserves credited energy`, () => assert.equal(grown.total - before.total, 1));
    return { before, grown, after_midnight: p.snapshot(), rate_before: rateBefore, rate_after: rateAfter };
  });

  scenarios.timezone_and_replay = each(m => {
    const p = new Pet(m, START, elder);
    p.feed(1000, "2026-10-09", "Pacific/Honolulu");
    p.feed(1000, "2026-10-08", "Asia/Muscat");
    p.feed(1000, "2026-10-09", "Asia/Muscat").feed(1000).feed(999);
    p.advance("2026-10-10T00:02:00+04:00").feed(1000, "2026-10-09", "Asia/Muscat");
    check(`${m}: wrong-zone, old-day and repeated totals cannot mint points`, () => {
      assert.equal(p.metrics.credited, 1000); assert.equal(p.metrics.ignored_envelopes, 3); assert.equal(p.s.lifetime_steps, 101000);
    });
    return p.snapshot();
  });

  scenarios.dst = each(m => Object.fromEntries([
    ["spring_23h", "2026-03-28T23:00:00Z"], ["autumn_25h", "2026-10-24T22:00:00Z"]
  ].map(([name, iso]) => {
    const p = new Pet(m, iso, { ...elder, energy: 30000 }, "Europe/Berlin");
    p.advance(nextLocalMidnight(p.start, p.tz));
    check(`${m}: ${name} uses correct local calendar and elapsed maintenance`, () => {
      const hours = (p.now - p.start) / 3600000;
      assert.equal(hours, name === "spring_23h" ? 23 : 25);
      const expected = m === "current" ? 7000 : p.rate * hours / 24;
      assert(Math.abs(p.metrics.basal - expected) < 1e-6);
    });
    return [name, { elapsed_hours: (p.now - p.start) / 3600000, ...p.snapshot() }];
  })));

  check("actual production engine carries 15000 Elder points as 8000 at midnight", () => {
    const s = feed({ ...structuredClone(DEFAULT_STATE), ...elder, stage: "Elder" }, 15000);
    const next = midnight(s, false);
    assert.equal(next.energy, 8000); assert.equal(next.steps_today, 0); assert.equal(next.lifetime_steps, 115000);
  });
  check("current 7000 daily feed still dies at fourth midnight", () => {
    const p = new Pet("current", MIDNIGHT, elder);
    for (let day = 0; day < 4; day++) p.advance(p.start + day * DAY + DAY / 2).feed(7000).advance(p.start + (day + 1) * DAY);
    assert.equal(p.s.dead, true); assert.equal(p.metrics.credited, 28000);
  });
  check("proposed protected chat never consumes the last 1000 points", () => {
    const p = new Pet("pantry_gentle_protected", START, { ...elder, energy: 1059 });
    p.chat("medium"); assert.equal(p.total, 1039); // medium unavailable at this energy; low costs 20
    p.chat("low").chat("low").chat("low"); assert.equal(p.total, 1019);
    assert.equal(p.metrics.replies.asleep, 2);
  });
  check("empty/failed replies consume no energy in exploratory accounting", () => {
    for (const model of MODELS) {
      const p = new Pet(model, START, { ...elder, energy: 12000 });
      const before = p.snapshot(); p.chat("medium", false); assert.deepEqual(p.snapshot(), before);
    }
  });
  check("continuous exhaustion has no future upkeep debt", () => {
    const p = new Pet("gentle_continuous", MIDNIGHT, elder);
    p.advance(p.start + 3 * DAY).feed(1000);
    assert.equal(p.total, 1000); assert.equal(p.emptyMs, 0); assert.equal(p.s.zero_days, 0);
    p.advance(p.now + DAY / 2); assert.equal(p.total, 500);
  });
  check("current golden cap is reproduced and candidate retains overflow", () => {
    const p = new Pet("current", START, { energy: 5500, lifetime_steps: 4000, steps_today: 4000 }).feed(4900);
    assert.equal(p.s.energy, 6000); assert.equal(p.metrics.overflow, 400);
    const q = new Pet("pantry_gentle_protected", START, { energy: 5500, lifetime_steps: 4000, steps_today: 4000 }).feed(4900);
    assert.equal(q.s.energy, 6000); assert.equal(q.pantry, 400); assert.equal(q.metrics.overflow, 0);
  });
  check("a very large feed is bounded and growth does not create energy", () => {
    for (const model of MODELS) {
      const p = new Pet(model, START, elder).feed(50000);
      assert.equal(p.total + p.metrics.overflow, 50000);
      assert.equal(p.total, model.startsWith("pantry") ? 42000 : 30000);
    }
  });
  check("constant-rate accounting is invariant to read frequency", () => {
    for (const model of MODELS.filter(m => m !== "current")) {
      const bulk = new Pet(model, START, { ...elder, energy: 30000 });
      const split = new Pet(model, START, { ...elder, energy: 30000 });
      const duration = 98765432;
      bulk.advance(bulk.start + duration);
      for (let ms = 123457; ms < duration; ms += 123457) split.advance(split.start + ms);
      split.advance(split.start + duration);
      assert.equal(bulk.balanceNum, split.balanceNum);
    }
  });
  check("catchup exceeding the production 14-day batch boundary retains all debt", () => {
    for (const model of MODELS) {
      const all = new Pet(model, MIDNIGHT, { ...elder, energy: 30000 });
      const batches = new Pet(model, MIDNIGHT, { ...elder, energy: 30000 });
      all.advance(all.start + 22 * DAY);
      batches.advance(batches.start + 14 * DAY).advance(batches.start + 22 * DAY);
      assert.equal(all.balanceNum, batches.balanceNum);
      assert.equal(all.s.zero_days, batches.s.zero_days);
      assert.equal(all.s.dead, batches.s.dead);
      assert.equal(all.s.burrowed, false);
    }
  });
  check("candidate stage-dependent consumption applies only after actual growth instant", () => {
    const p = new Pet("pantry_current_rate", MIDNIGHT, { lifetime_steps: 99999, energy: 20000 });
    p.advance(p.start + DAY - 60000).feed(1).advance(p.start + DAY);
    const expected = 20001 - 5000 * 1439 / 1440 - 7000 / 1440;
    assert(Math.abs(p.total - expected) < 1e-8);
  });
  check("protected chat has a measurable first-walk usability cost", () => {
    const p = new Pet("pantry_gentle_protected", START).feed(1000).chat("low");
    assert.equal(p.metrics.replies.asleep, 1);
    assert.equal(p.metrics.chat, 0);
    const q = new Pet("gentle_continuous", START).feed(1000).chat("low");
    assert.equal(q.metrics.replies.low, 1);
    assert.equal(q.total, 980);
  });
  check("death during continuous settlement cannot invent a heat flag", () => {
    for (const model of MODELS) {
      const p = new Pet(model, MIDNIGHT, elder).advance(Date.parse(MIDNIGHT) + 5 * DAY);
      assert.equal(p.s.dead, true); assert.equal(p.s.burrowed, false);
    }
  });
  check("synthetic randomized feed/chat/read sequence conserves every credited point", () => {
    let seed = 20261009;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
    for (const model of MODELS) {
      const p = new Pet(model, MIDNIGHT, { ...elder, energy: 9000 });
      for (let i = 0; i < 2000; i++) {
        p.advance(p.now + Math.floor(random() * 600000));
        if (random() < 0.6) p.feed(p.s.steps_today + Math.floor(random() * 160));
        else p.chat(random() < 0.5 ? "low" : undefined);
        p.invariant();
      }
    }
  });

  const sourceFiles = ["worker/src/engine.ts", "worker/src/config.ts", "worker/src/time.ts", "worker/src/do.ts", "tests/golden/energy_cases.json"];
  const source_sha256 = Object.fromEntries(sourceFiles.map(file => [file, createHash("sha256").update(readFileSync(resolve(here, "../..", file))).digest("hex")]));
  const result = {
    schema: 1,
    kind: "offline_throwaway_energy_economy_exploration",
    source_sha256,
    assumptions: { step_credit: "1 accepted step = 1 point", flat_burn: "1000 per actual 24h, a product choice", candidate_empty_grace: "96 nonheat hours actually empty, reset on positive feed", pantry_capacity: "min(12000, stage energy_max) additional points", recommended_chat_floor: "1000 points; downward tier cap; never creates points", public_numbers: "No biological, calorie, outdoor-detection or provider-price claim", transport: "Scenario wrapper applies day/zone and monotone absolute totals; no HTTP, concurrency, authentication, ingestion jump-cap or provider emulation", mortality: "Candidates retain death only to expose current-product tradeoff; dormancy needs a separate explicit decision" },
    models: settings,
    stage_stable_daily_budget: Object.fromEntries(Object.keys(minLife).map(stage => [stage, { current_maintenance: stageConfig(stage as keyof typeof minLife).burn, proposed_maintenance: 1000, proposed_3500_step_day_left_for_requested_replies: 2500, max_high_replies_from_net: 12, max_medium_replies_from_net: 41, max_low_replies_from_net: 125, note: "Alternative budgets, not additive; tier thresholds and chat floor still apply" }])),
    checks: { passed: tests.length, names: tests },
    scenarios
  };
  writeFileSync(join(here, "results.json"), `${JSON.stringify(result, null, 2)}\n`);
  console.log(`PASS ${tests.length} exploratory checks. Results: explorations/energy-carryover/results.json`);
  console.log("Current: actual imported production engine. Proposals: isolated simulations. No network/model calls.");
}
