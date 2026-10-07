// Read-only snapshot check. Transpiles in memory, so no build or test caches.
// This is a supplemental runner, not a replacement for worker/test/golden.test.ts.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'worker/node_modules/typescript'));
const sources = Object.fromEntries(['config', 'engine'].map(name => [name,
  fs.readFileSync(path.join(root, `worker/src/${name}.ts`), 'utf8')]));
const loaded = {};
function load(name) {
  if (loaded[name]) return loaded[name];
  const module = { exports: {} };
  const js = ts.transpileModule(sources[name], { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022
  }}).outputText;
  vm.runInNewContext(js, {
    module, exports: module.exports,
    require: spec => {
      if (spec !== './config') throw Error(`Unexpected import: ${spec}`);
      return load('config');
    }
  }, { filename: `${name}.snapshot.cjs` });
  return loaded[name] = module.exports;
}
const e = load('engine');
const original = JSON.parse(fs.readFileSync(path.join(root, 'tests/golden/energy_cases.json'), 'utf8'));
const proposed = JSON.parse(fs.readFileSync(path.join(__dirname, 'proposed_goldens.json'), 'utf8'));
function view(s) {
  return { ...s, ...e.decideTier(s), ...e.stageConfig(s.stage), mood: e.moodOf(s),
    gravestone: s.gravestones.at(-1), gravestones_count: s.gravestones.length };
}
function run(c) {
  const s = structuredClone({ ...e.DEFAULT_STATE, ...original.default_state, ...c.state });
  if (c.state.stage === undefined) s.stage = e.deriveStage(s.lifetime_steps);
  const before = JSON.stringify(s);
  const event = c.event;
  let actual;
  switch (event.type) {
    case 'feed': actual = view(e.feed(s, event.steps_today_total)); break;
    case 'tier_check': actual = view(s); break;
    case 'chat': {
      const d = e.decideTier(s, event.requested_tier);
      const after = e.chargeChat(s, d);
      actual = { ...view(after), ...d, energy_after: after.energy };
      break;
    }
    case 'midnight': actual = view(e.midnight(s, event.burrowed_tomorrow)); break;
    case 'new_spore': actual = view(e.newSpore(s)); break;
    case 'weather': actual = { burrowed: e.shouldBurrow(event.apparent_temperature_daytime_max_c) }; break;
    case 'state_block': actual = { state_block: e.stateBlock(s, event) }; break;
    default: throw Error(`Unknown event: ${event.type}`);
  }
  if (JSON.stringify(s) !== before) throw Error(`${c.id}: input mutation`);
  const errors = [];
  function match(want, got, key) {
    if (want && typeof want === 'object' && !Array.isArray(want)) {
      for (const [k, v] of Object.entries(want)) match(v, got?.[k], `${key}.${k}`);
    } else if (typeof want === 'number' && typeof got === 'number' &&
               Math.abs(want - got) <= 1e-9) {
      return;
    } else if (want !== got) {
      errors.push(key);
    }
  }
  for (const [key, want] of Object.entries(c.expect)) match(want, actual[key], key);
  return errors;
}
for (const [name, source] of Object.entries(sources)) {
  console.log(`${name}.ts sha256: ${crypto.createHash('sha256').update(source).digest('hex')}`);
}
for (const [label, cases] of [['Original', original.cases], ['Proposed', proposed]]) {
  let failures = 0;
  for (const c of cases) {
    const errors = run(c);
    if (errors.length) {
      failures++;
      console.log(`FAIL ${c.id}: ${errors.join(', ')}`);
    }
  }
  console.log(`${label} engine snapshot: ${cases.length - failures}/${cases.length} pass; ${failures} fail`);
  if (failures) process.exitCode = 1;
}
console.log('HTTP, alarm delivery, model calls and Android: NOT TESTED');
