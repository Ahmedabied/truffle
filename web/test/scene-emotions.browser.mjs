// Real desktop Chrome canvas/RAF evidence; local mock state only, never a handset claim.
// Run from repo root: node web/test/scene-emotions.browser.mjs before|after|full-width
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const phase = process.argv[2] || 'after';
assert.ok(['before', 'after', 'full-width'].includes(phase));
const base = process.env.TRUFFLE_TEST_URL || 'http://localhost:5191';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const out = resolve('docs/reviews/fleet25-19-art-motion', phase);
mkdirSync(out, { recursive: true });
const viewport = { width: 1440, height: 1000 };
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome' });
const context = await browser.newContext({ viewport, deviceScaleFactor: 2, locale: 'en-US' });
await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
await context.addInitScript(() => localStorage.setItem('truffle.lang', JSON.stringify('en')));
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto(`${base}/demo?mock=1&fps=1&scene=elder&hour=15&country=GB&wx=95&rain=1&wind=40&mm=5`);
  await page.waitForFunction(() => !!window.truffle?.summary());
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);
  const measured = await page.evaluate(async () => {
    const deltas = [], hud = [];
    let previous, raf;
    const observe = time => {
      if (previous !== undefined) deltas.push(time - previous);
      previous = time;
      raf = requestAnimationFrame(observe);
    };
    raf = requestAnimationFrame(observe);
    const started = performance.now(), first = window.truffle.frames();
    for (let second = 0; second < 10; second++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      hud.push(document.querySelector('#fps').textContent);
    }
    cancelAnimationFrame(raf);
    const duration = performance.now() - started, frames = window.truffle.frames() - first;
    const sorted = [...deltas].sort((a, b) => a - b);
    const percentile = q => +(sorted[Math.floor((sorted.length - 1) * q)] || 0).toFixed(2);
    const canvas = document.querySelector('#world canvas');
    const box = canvas.getBoundingClientRect();
    return { duration_ms: +duration.toFixed(1), scene_frames: frames,
      scene_fps: +(frames * 1000 / duration).toFixed(2), raf_samples: deltas.length,
      raf_ms: { p50: percentile(.5), p95: percentile(.95), p99: percentile(.99), max: percentile(1) },
      raf_over_25ms: deltas.filter(value => value > 25).length,
      canvas_css_px: [box.width, box.height], canvas_device_px: [canvas.width, canvas.height],
      mock: window.truffle.mock(), hud };
  });
  await page.screenshot({ path: `${out}/storm-desktop.png`, fullPage: true });
  assert.equal(measured.mock, true);
  assert.equal(errors.length, 0, errors.join('\n'));
  const result = { phase, measured_at: new Date().toISOString(), browser: browser.version(),
    headless: true, viewport, device_scale_factor: 2, cpu_throttle: 4,
    scene: 'Elder in GB storm, 5 mm rain, 40 km/h wind, hour 15',
    note: 'Desktop Chrome RAF intervals and real scene draws. HUD timings cover JavaScript composition/canvas submission, not GPU/display latency. No phone measurement.',
    ...measured, errors };
  writeFileSync(`${out}/measurements.json`, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));

  // Independently inspect deterministic art on the same native browser canvas.
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.route(`${base}/__scene-art`, route => route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' }));
  await page.goto(`${base}/__scene-art`);
  await page.evaluate(async () => {
    const { World } = await import('/src/scene/world.ts');
    document.body.style.cssText = 'margin:0;background:#ece4cf;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:12px;font:16px monospace';
    for (const [label, reaction, mood, hour] of [
      ['Content', null, 'content', 12], ['Anticipating', 'anticipating', 'content', 12], ['Happy', 'happy', 'content', 12],
      ['Asleep at night', 'anticipating', 'asleep', 22], ['Wilting stays wilting', 'happy', 'wilting', 12], ['Burrowed stays burrowed', 'anticipating', 'burrowed', 12]
    ]) {
      const figure = document.createElement('figure'); figure.style.margin = '0';
      const caption = document.createElement('figcaption'); caption.textContent = label;
      const host = document.createElement('div');
      host.style.cssText = 'width:440px;font:7.333333px "Noto Sans Mono","Droid Sans Mono","Roboto Mono",Menlo,Consolas,"DejaVu Sans Mono",monospace;--world-cell-width:4.4';
      figure.append(caption, host); document.body.append(figure);
      const world = new World(host);
      world.set({ stage: 'Truffle', tier: 'high', mood, reaction, hourOverride: hour, moonOverride: .5, ageDays: 12 });
      world.setReduced(true); world.draw(); world.stop();
      host.dataset.pixels = world.frame().toDataURL();
    }
  });
  const pixels = await page.locator('[data-pixels]').evaluateAll(hosts => hosts.map(host => host.dataset.pixels));
  if (phase !== 'before') assert.equal(new Set(pixels.slice(0, 3)).size, 3, 'Content, anticipation and happy must be visually distinct');
  await page.screenshot({ path: `${out}/expressions-desktop.png`, fullPage: true });
} finally {
  await browser.close();
}
