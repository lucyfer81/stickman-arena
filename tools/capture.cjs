// Robust art-direction capture. Gameplay first (no options beforehand to avoid
// the options-close/start race), then a fresh load for the options overlay.
const { chromium } = require('@playwright/test');
const path = require('path');
const SHOT = path.resolve(__dirname, '..', 'tests', 'shots', 'art');
const BASE = 'http://127.0.0.1:8080/';
const tele = (page) => page.evaluate(() => window.__stickman || null).catch(() => null);
async function waitTele(page, pred, timeout = 18000, interval = 120) {
  const dl = Date.now() + timeout;
  while (Date.now() < dl) {
    const t = await tele(page);
    if (t && pred(t)) return t;
    await page.waitForTimeout(interval);
  }
  throw new Error('telemetry timeout waiting for ' + (pred.toString().slice(0, 60)));
}
const log = (...a) => console.log('[cap]', ...a);

(async () => {
  const browser = await chromium.launch();
  const errs = [];
  async function newPage() {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (e) => errs.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    return page;
  }

  // ===== PASS 1: gameplay scenes (start immediately) =====
  const page = await newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await waitTele(page, (t) => t.state === 'title');
  await page.waitForTimeout(1400);
  await page.screenshot({ path: SHOT + '/r-title.png' });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: SHOT + '/r-title-punch.png' });
  log('title captured');

  await page.keyboard.press('Space');
  await waitTele(page, (t) => t.state === 'game' && t.wave >= 1);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: SHOT + '/r-wave1.png' });
  log('wave1 captured');

  for (let i = 0; i < 18; i++) {
    await page.keyboard.press(i % 2 ? 'k' : 'j').catch(() => {});
    await page.waitForTimeout(80);
  }
  await page.screenshot({ path: SHOT + '/r-combat.png' });
  log('combat captured');

  await page.evaluate(() => window.__test && window.__test.spawnBossKind && window.__test.spawnBossKind('slammer'));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: SHOT + '/r-boss-slammer.png' });
  await page.evaluate(() => window.__test && window.__test.bossFireSpecial && window.__test.bossFireSpecial());
  await page.waitForTimeout(700);
  await page.screenshot({ path: SHOT + '/r-boss-slam.png' });
  log('boss captured');

  await page.evaluate(() => window.__test && window.__test.enterSecondWind && window.__test.enterSecondWind());
  await page.waitForTimeout(600);
  await page.screenshot({ path: SHOT + '/r-second-wind.png' });
  log('second wind captured');
  await page.close();

  // ===== PASS 1b: game over (fresh — die cleanly at wave 1) =====
  const pageG = await newPage();
  await pageG.goto(BASE, { waitUntil: 'domcontentloaded' });
  await waitTele(pageG, (t) => t.state === 'title');
  await pageG.keyboard.press('Space');
  await waitTele(pageG, (t) => t.state === 'game' && t.wave >= 1);
  await pageG.waitForTimeout(800);
  // enter second wind then expire its window -> real death -> gameover
  await pageG.evaluate(() => { window.__test && window.__test.enterSecondWind && window.__test.enterSecondWind(); });
  await waitTele(pageG, (t) => t.broken === true, 8000);
  await pageG.evaluate(() => { window.__test && window.__test.fastForwardBroken && window.__test.fastForwardBroken(0.05); });
  await waitTele(pageG, (t) => t.state === 'gameover', 18000);
  await pageG.waitForTimeout(900);
  await pageG.screenshot({ path: SHOT + '/r-gameover.png' });
  log('gameover captured');
  await pageG.close();

  // ===== PASS 2: options overlay (fresh load) =====
  const page2 = await newPage();
  await page2.goto(BASE, { waitUntil: 'domcontentloaded' });
  await waitTele(page2, (t) => t.state === 'title');
  await page2.waitForTimeout(800);
  await page2.keyboard.press('o');
  await page2.waitForTimeout(700);
  await page2.screenshot({ path: SHOT + '/r-options.png' });
  log('options captured');
  await page2.close();

  // ===== PASS 3: mobile landscape =====
  const page3 = await newPage();
  await page3.setViewportSize({ width: 915, height: 412 });
  await page3.goto(BASE, { waitUntil: 'domcontentloaded' });
  await waitTele(page3, (t) => t.state === 'title');
  await page3.waitForTimeout(800);
  await page3.screenshot({ path: SHOT + '/r-mobile-title.png' });
  await page3.keyboard.press('Space');
  await waitTele(page3, (t) => t.state === 'game');
  await page3.waitForTimeout(1600);
  await page3.screenshot({ path: SHOT + '/r-mobile-game.png' });
  log('mobile captured');

  await browser.close();
  console.log('ERRORS:', JSON.stringify(errs.slice(0, 12)));
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
