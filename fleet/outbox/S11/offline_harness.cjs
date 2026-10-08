// Offline S11 evidence. No network or filesystem database.
// Cloudflare base class and external adapters are replaced.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash, randomBytes } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const ROOT = '/home/abied/Desktop/Truffle';
const ts = require(ROOT + '/worker/node_modules/typescript');
const cache = new Map();
let clock = Date.parse('2026-10-08T08:00:00Z');
Date.now = () => clock;
let brainAdapter;
let forecastAdapter = async () => null;
const fakeBrain = { askBrain: (...a) => brainAdapter(...a), extractFacts: async () => [] };
function load(name) {
  const filename = path.resolve(ROOT + '/worker/src', name.endsWith('.ts') ? name : name + '.ts');
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const text = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const req = (id) => {
    if (id === 'cloudflare:workers') return { DurableObject: class {
      constructor(ctx, env) { this.ctx = ctx; this.env = env; }
    } };
    if (id === './brain' && filename.endsWith('/do.ts')) return fakeBrain;
    if (id.startsWith('.')) {
      const imported = load(path.resolve(path.dirname(filename), id));
      if (id === './weather' && filename.endsWith('/do.ts')) {
        return { ...imported, fetchForecast: (...args) => forecastAdapter(...args) };
      }
      return imported;
    }
    return require(id);
  };
  new Function('require', 'module', 'exports', text)(req, module, module.exports);
  return module.exports;
}
const engine = load('engine');
const { TruffleDO } = load('do');
async function fixture(overState = {}, overMeta = {}) {
  const db = new DatabaseSync(':memory:');
  const pending = [];
  const sql = { exec(query, ...args) {
    if (/CREATE TABLE/.test(query)) { db.exec(query); return { toArray: () => [] }; }
    const stmt = db.prepare(query);
    const rows = stmt.columns().length ? stmt.all(...args) : (stmt.run(...args), []);
    return { toArray: () => rows, one: () => { assert.equal(rows.length, 1); return rows[0]; } };
  } };
  const ctx = { storage: { sql, setAlarm: async () => {}, deleteAlarm: async () => {},
    deleteAll: async () => { db.exec('DELETE FROM facts; DELETE FROM turns; DELETE FROM log; DELETE FROM state;'); }
  }, waitUntil: p => pending.push(p) };
  const object = new TruffleDO(ctx, {});
  object.ensureSchema();
  const credential = randomBytes(16).toString('base64url');
  const meta = { tz: 'Asia/Muscat', country: 'OM', lang: 'en', lat: 23.59, lon: 58.41,
    city: 'Muscat', secret_hash: await load('pairing').hashSecret(credential), demo: true,
    created_ms: clock, last_tick_ms: clock, last_midnight_key: '2026-10-08',
    weather_days: {}, weather_now: null, feed_window: { start_ms: clock, count: 0 }, ...overMeta };
  object.save({ ...structuredClone(engine.DEFAULT_STATE), ...overState }, meta);
  return { object, credential, db, pending, async drain() {
    for (let i = 0; i < pending.length; i++) await pending[i];
  } };
}
function deferredBrain() {
  const calls = [];
  brainAdapter = async (_env, req) => {
    let controller;
    const stream = new ReadableStream({ start(c) { controller = c; } });
    calls.push({ req, controller });
    return { stream, brain: 'workers-ai', half_awake: true, retry: { retried: false } };
  };
  return calls;
}
const tick = () => new Promise(r => setImmediate(r));
async function chat(f, message = 'Hello.', requested = 'low') {
  const result = await f.object.chat(f.credential, message, requested, undefined);
  if (!result.ok) return { result };
  const text = new Response(result.value).text();
  await tick();
  return { result, text };
}
function complete(call, text = 'Hello human.') { call.controller.enqueue(text); call.controller.close(); }
const evidence = [];
async function test(name, fn) {
  try { evidence.push({ name, pass: true, ...(await fn()) }); }
  catch (e) { evidence.push({ name, pass: false, error: e.message }); }
}
module.exports = { assert, load, engine, fixture, deferredBrain, tick, chat, complete, evidence, test,
  now: () => clock, setClock: v => { clock = v; },
  setBrain: fn => { brainAdapter = fn; }, setForecast: fn => { forecastAdapter = fn; },
  finish() {
    const sources = Object.fromEntries([...cache.keys()].map(p => [path.relative(ROOT, p), createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
    console.log(JSON.stringify({ classification: 'code-read, offline adapter tests', sources, evidence }, null, 2));
    if (evidence.some(e => !e.pass)) process.exitCode = 1;
  }
};
