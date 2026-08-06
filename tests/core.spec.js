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

test.describe('Desktop', () => {
  test('title -> gameplay -> scoring', async ({ page }) => {
    test.setTimeout(75000);
    const errors = collectErrors(page);
    await page.goto('/');
    await expect(page.locator('canvas')).toBeVisible();
    await waitTele(page, (t) => t.state === 'title');
    await page.screenshot({ path: 'tests/shots/01-title.png' });

    await page.keyboard.press('Space');
    await waitTele(page, (t) => t.state === 'game' && t.wave >= 1);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'tests/shots/02-gameplay.png' });

    const deadline = Date.now() + 35000;
    const keys = ['J', 'K', 'J', 'D', 'J', 'K', 'D', 'J'];
    let i = 0;
    while (Date.now() < deadline) {
      await page.keyboard.press(keys[i++ % keys.length]);
      await page.waitForTimeout(110);
      const t = await telemetry(page);
      if (t && t.score > 0) break;
    }
    await page.screenshot({ path: 'tests/shots/03-combat.png' });
    const t = await waitTele(page, (x) => x.score > 0, 4000);
    expect(t.score).toBeGreaterThan(0);
    expect(t.wave).toBeGreaterThanOrEqual(1);
    expect(errors).toEqual([]);
  });

  test('waves progress', async ({ page }) => {
    test.setTimeout(60000);
    const errors = collectErrors(page);
    await page.goto('/');
    await page.keyboard.press('Space');
    await waitTele(page, (t) => t.state === 'game');
    const deadline = Date.now() + 25000;
    while (Date.now() < deadline) {
      await page.evaluate(() => window.__test && window.__test.killEnemies && window.__test.killEnemies());
      await page.waitForTimeout(220);
      const t = await telemetry(page);
      if (t && t.wave >= 3) break;
    }
    const t = await telemetry(page);
    expect(t.wave).toBeGreaterThanOrEqual(2);
    expect(errors).toEqual([]);
  });

  test('game over and restart', async ({ page }) => {
    test.setTimeout(60000);
    const errors = collectErrors(page);
    await page.goto('/');
    await page.keyboard.press('Space');
    await waitTele(page, (t) => t.state === 'game');
    // drive a guaranteed kill instead of waiting on enemy AI timing (robust to load)
    await page.evaluate(() => {
      const step = () => {
        const s = window.__stickman;
        if (!s || s.state === 'gameover' || s.state === 'dying') return;
        if (window.__test && window.__test.setHealth) window.__test.setHealth(1);
        if (window.__test && window.__test.hurt) window.__test.hurt(99);
      };
      step();
      window.__killTimer = setInterval(step, 300);
    });
    await waitTele(page, (t) => t.state === 'gameover', 30000);
    await page.evaluate(() => clearInterval(window.__killTimer));
    await page.screenshot({ path: 'tests/shots/07-gameover.png' });
    // restart (retry R past the brief input lockout on the game-over screen).
    // Restart returns to the Title so the player can re-pick skin/difficulty/daily.
    let restarted = false;
    const restartDeadline = Date.now() + 10000;
    while (Date.now() < restartDeadline) {
      await page.keyboard.press('R');
      await page.waitForTimeout(250);
      const tt = await telemetry(page);
      if (tt && tt.state === 'title') { restarted = true; break; }
    }
    expect(restarted).toBe(true);
    expect(errors).toEqual([]);
  });
});
