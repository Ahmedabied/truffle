// Loaded-page visual and frame-rate evidence. Local mock inputs only; no real pet.
// CHROME_BIN=/usr/bin/google-chrome node web/test/scene.browser.mjs before|after
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
const phase = process.argv[2] || 'after';
assert.match(phase, /^[a-z0-9-]+$/);
const base = process.env.TRUFFLE_TEST_URL || 'http://localhost:5191';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const out = resolve('docs/reviews/ascii-art', phase);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome' });
const cases = [
  ['day', 'scene=truffle&hour=12'],
  ['night', 'scene=asleep&hour=22&moon=0.5'],
  ['fresh-night', 'scene=fresh&hour=0'],
  ['heat', 'scene=burrowed&hour=14&temp=44'],
  ['storm', 'scene=elder&hour=15&country=GB&wx=95&rain=1&wind=40&mm=5'],
];
const results = [];
try {
  for (const [name, params] of cases.filter(([name]) => !process.env.SCENE_CASE || name === process.env.SCENE_CASE)) {
    const c = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, locale: 'en-US' });
    await c.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    await c.addInitScript(() => localStorage.setItem('truffle.lang', JSON.stringify('en')));
    const p = await c.newPage();
    const errors = []; p.on('pageerror', e => errors.push(e.message));
    const cdp = await c.newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await p.goto(`${base}/demo?mock=1&fps=1&${params}`);
    await p.waitForFunction(() => !!window.truffle?.summary());
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(1800);
    const measured = await p.evaluate(async () => {
      const start = performance.now(); const n = window.truffle.frames();
      const readings = [];
      for (let i=0;i<8;i++) { await new Promise(r => setTimeout(r,1000)); readings.push(document.querySelector('#fps').textContent); }
      const duration = performance.now()-start; const frames=window.truffle.frames()-n;
      return { frames, duration_ms: Math.round(duration), fps: +(frames*1000/duration).toFixed(2), readings,
        hud: document.querySelector('#hud').textContent, mock: window.truffle.mock() };
    });
    await p.screenshot({ path: `${out}/${name}-mobile.png`, fullPage: true });
    await p.locator('#world').screenshot({ path: `${out}/${name}-scene.png` });
    results.push({ scene: name, viewport: [412,915], device_scale_factor: 2, cpu_throttle: 4, ...measured, errors });
    console.log(JSON.stringify(results.at(-1)));
    assert.equal(errors.length, 0, `${name}: browser errors`);
    if (name === 'day') {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await p.setViewportSize({ width:1440,height:1000 });
      await p.waitForTimeout(600);
      await p.screenshot({path:`${out}/day-desktop.png`,fullPage:true});
    }
    await c.close();
  }
  const c = await browser.newContext({ viewport:{width:412,height:915}, deviceScaleFactor:2,reducedMotion:'reduce' });
  await c.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
  const p = await c.newPage();
  await p.goto(`${base}/?mock=1&fps=1&scene=affectionate&hour=12`);
  await p.waitForFunction(()=>!!window.truffle?.summary());
  await p.waitForTimeout(700);
  const a = await p.locator('#world canvas').screenshot();
  await p.waitForTimeout(1100);
  const b = await p.locator('#world canvas').screenshot();
  assert.ok(a.equals(b), 'Reduced motion must preserve identical scene pixels');
  await p.screenshot({path:`${out}/reduced-motion-mobile.png`,fullPage:true});
  await c.close();
  writeFileSync(`${out}/measurements.json`,JSON.stringify({ phase, at:new Date().toISOString(), revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(), note:'Working-tree loaded browser scenes, simulated state, Chrome CPU throttle; not a handset measurement.', browser:browser.version(), reduced_motion_pixels:'identical across 1.1s',results },null,2));
} finally { await browser.close(); }
