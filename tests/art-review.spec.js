// Art-direction screenshot sweep. Captures every key scene at desktop + mobile
// resolutions for ASCII/imgstat visual review. NOT a CI test (no assertions on
// gameplay), only on: page loads, scenes transition, no console errors.
const { test, expect } = require('@playwright/test');

const SHOT = 'tests/shots/art/';
const LD = process.env.LD_LIBRARY_PATH || '';

const errorsOf = (page) => {
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(String((e && e.stack) || e)));
  return errs;
};
const tele = (page) => page.evaluate(() => window.__stickman || null);
const waitTele = async (page, pred, timeout = 25000, interval = 120) => {
  const dl = Date.now() + timeout;
  while (Date.now() < dl) {
    const t = await tele(page);
    if (t && pred(t)) return t;
    await page.waitForTimeout(interval);
  }
  throw new Error('telemetry timeout');
};

test.describe('Art-direction sweep', () => {
  test('desktop — every scene', async ({ page }) => {
    test.setTimeout(180000);
    const errs = errorsOf(page);
    await page.goto('/');
    await waitTele(page, (t) => t.state === 'title');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: SHOT + '01-title.png' });

    // capture the sparring punch moment (player attacks on even rounds ~2.5s in)
    await page.waitForTimeout(1400);
    await page.screenshot({ path: SHOT + '01c-title-punch.png' });

    // cycle difficulty to hard so the selector color reads in shot
    await page.keyboard.press('3');
    await page.waitForTimeout(300);
    await page.screenshot({ path: SHOT + '01b-title-hard.png' });

    // start
    await page.keyboard.press('Space');
    await waitTele(page, (t) => t.state === 'game' && t.wave >= 1);
    await page.waitForTimeout(1600);
    await page.screenshot({ path: SHOT + '02-wave1.png' });

    // a few attacks -> combat feedback frame
    for (let i = 0; i < 24; i++) {
      await page.keyboard.press(i % 2 ? 'K' : 'J');
      await page.waitForTimeout(90);
    }
    await page.screenshot({ path: SHOT + '03-combat.png' });

    // boss slammer at wave 5
    await page.evaluate(() => window.__test && window.__test.gotoBossWave && window.__test.gotoBossWave(5));
    await waitTele(page, (t) => t.isBossWave || (t.wave === 5));
    await page.waitForTimeout(1800);
    await page.screenshot({ path: SHOT + '04-boss-slammer.png' });

    // boss caster at wave 10
    await page.evaluate(() => window.__test && window.__test.gotoBossWave && window.__test.gotoBossWave(10));
    await page.waitForTimeout(1800);
    await page.screenshot({ path: SHOT + '05-boss-caster.png' });

    // second wind broken
    await page.evaluate(() => window.__test && window.__test.enterSecondWind && window.__test.enterSecondWind());
    await page.waitForTimeout(500);
    await page.screenshot({ path: SHOT + '06-second-wind-broken.png' });

    // game over
    await page.evaluate(() => { window.__test && window.__test.setHealth && window.__test.setHealth(1); });
    await page.evaluate(() => { window.__test && window.__test.hurt && window.__test.hurt(99); });
    await waitTele(page, (t) => t.state === 'gameover', 25000);
    await page.waitForTimeout(800);
    await page.screenshot({ path: SHOT + '07-gameover.png' });

    expect(errs).toEqual([]);
  });

  test('mobile landscape', async ({ page }) => {
    test.setTimeout(90000);
    const errs = errorsOf(page);
    await page.setViewportSize({ width: 915, height: 412 });
    await page.goto('/');
    await waitTele(page, (t) => t.state === 'title');
    await page.waitForTimeout(800);
    await page.screenshot({ path: SHOT + '08-mobile-title.png' });
    await page.keyboard.press('Space');
    await waitTele(page, (t) => t.state === 'game');
    await page.waitForTimeout(1600);
    await page.screenshot({ path: SHOT + '09-mobile-game.png' });
    expect(errs).toEqual([]);
  });

  test('mobile portrait (rotate hint)', async ({ page }) => {
    test.setTimeout(60000);
    const errs = errorsOf(page);
    await page.setViewportSize({ width: 412, height: 915 });
    await page.goto('/');
    await waitTele(page, (t) => t.state === 'title');
    await page.waitForTimeout(800);
    await page.screenshot({ path: SHOT + '10-portrait.png' });
    expect(errs).toEqual([]);
  });
});
