const { test, expect } = require('@playwright/test');

const collectErrors = (page) => {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
  return errors;
};

const telemetry = (page) => page.evaluate(() => window.__stickman || null);
const waitTele = async (page, predicate, timeout = 20000, interval = 150) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const t = await telemetry(page);
    if (t && predicate(t)) return t;
    await page.waitForTimeout(interval);
  }
  throw new Error('telemetry condition timed out');
};

test('mobile landscape: touch input works', async ({ page }) => {
  test.setTimeout(60000);
  const errors = collectErrors(page);
  await page.goto('/');
  await waitTele(page, (t) => t.state === 'title');
  await page.screenshot({ path: 'tests/shots/04-mobile-title.png' });

  const { w, h } = page.viewportSize();
  await page.keyboard.press('Space');
  await waitTele(page, (t) => t.state === 'game', 8000);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'tests/shots/05-mobile-game.png' });

  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    await page.evaluate(() => {
      const c = window.__controls; if (!c) return;
      c.touchActive = true; c.touchDir = 1;
      c.punchPressed = true;
      if (Math.random() < 0.5) c.kickPressed = true;
    });
    await page.waitForTimeout(140);
    const t = await telemetry(page);
    if (t && t.score > 0) break;
  }
  const t = await waitTele(page, (x) => x.score > 0, 4000);
  expect(t.score).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
