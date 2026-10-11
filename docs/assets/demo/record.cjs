const { chromium } = require('/home/abied/Desktop/Truffle/web/node_modules/playwright');
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome' });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-US' });
  const p = await c.newPage();
  const fs = require('fs'); fs.mkdirSync(OUT + '/f', { recursive: true });
  const cdp = await c.newCDPSession(p); const frames = []; let n = 0;
  cdp.on('Page.screencastFrame', async f => { const name = `f${String(n++).padStart(5,'0')}.jpg`; fs.writeFileSync(`${OUT}/f/${name}`, Buffer.from(f.data, 'base64')); frames.push([name, f.metadata.timestamp]); try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {} });
  const startCast = () => cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 });
  const w = ms => p.waitForTimeout(ms);
  const log = []; p.on('console', m => { if (m.type() === 'error') log.push(m.text()); });
  await p.goto('https://truffle-web.ahmed-abied.workers.dev/demo?mock=1');
  await p.waitForFunction(() => !!window.truffle?.summary());
  await w(800); await startCast();
  await w(3500);                                   // asleep
  await p.locator('#firstWalk').click(); await w(3500);   // wakes on 4,000 steps
  await p.locator('#ask').selectOption(''); await w(600);
  await p.locator('#msg').click();
  await p.locator('#msg').pressSequentially('what should I notice on my walk today?', { delay: 45 });
  await w(500); await p.keyboard.press('Enter'); await w(6000);  // reply + charge
  await p.locator('#pocketBtn').click(); await w(1200);
  await p.locator('#pauseBtn').click(); await w(3000);    // take a moment
  await p.locator('#backBtn').click(); await w(1500);
  await p.locator('#pocketBtn').click(); await w(800);
  await p.getByText('Your little keepsakes').click(); await w(900);
  const pg = p.locator('#previewGift'); await pg.scrollIntoViewIfNeeded(); await w(600);
  await pg.click(); await w(4000);                        // gift
  const heat = p.locator('#heatBtn'); await heat.scrollIntoViewIfNeeded(); await w(500);
  await heat.click(); await w(800);
  await p.locator('#midBtn').click(); await w(1200);
  if (await p.locator('#pocketDialog').evaluate(e => e.open)) await p.locator('#pocketClose').click();
  await w(4500);                                   // burrowed in heat
  await cdp.send('Page.stopScreencast'); await w(300);
  fs.writeFileSync(OUT + '/frames.json', JSON.stringify(frames));
  await c.close(); await b.close();
  console.log(JSON.stringify({ errors: log }));
})().catch(e => { console.error(e); process.exit(1); });
