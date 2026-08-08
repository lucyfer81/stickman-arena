const { test, expect } = require('@playwright/test');

// Round 10 backlog #6: combo bridge. Casuals stalled at best-combo 9 (just
// under the x10 milestone) because the 2.2s window couldn't bridge a dead enemy
// to the next one. A kill now grants +COMBO_KILL_BRIDGE so the kill->next-enemy
// flow sustains the chain.

const startGame = async (page) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__stickman && window.__stickman.state === 'title', null, { timeout: 15000 });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__stickman && window.__stickman.state === 'game' && window.__stickman.wave >= 1, null, { timeout: 15000 });
};

const WINDOW = 2.2, BRIDGE = 0.9;

// drive one punch and wait for it to connect (comboTimer spikes), then read it.
const punchAndRead = async (page) => {
  await page.evaluate(() => { window.__game.scene.getScene('Game').controls.punchPressed = true; });
  let timer = null;
  const deadline = Date.now() + 2500;
  while (Date.now() < deadline) {
    timer = await page.evaluate(() => window.__game.scene.getScene('Game').comboTimer);
    if (timer > 1.5) break; // a hit landed and set the window
    await page.waitForTimeout(50);
  }
  return timer;
};

test.describe('Combo bridge (kill sustains the chain)', () => {
  test('a non-killing hit sets the base window', async ({ page }) => {
    test.setTimeout(60000);
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
    await startGame(page);
    // a full-health grunt survives one punch -> a non-killing hit.
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      window.__test.clearEnemies();
      s.combo = 0; s.comboTimer = 0;
      window.__test.spawnVariant('grunt', 60); // within punch reach, full HP
    });
    const timer = await punchAndRead(page);
    expect(timer).toBeGreaterThanOrEqual(WINDOW - 0.15);
    expect(timer).toBeLessThan(WINDOW + BRIDGE); // NOT bridged (no kill)
    expect(errors).toEqual([]);
  });

  test('a kill grants the bridge (window + COMBO_KILL_BRIDGE)', async ({ page }) => {
    test.setTimeout(60000);
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
    await startGame(page);
    // a 1-HP grunt dies to one punch -> a kill -> bridge applies.
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      window.__test.clearEnemies();
      s.combo = 1; s.comboTimer = 0;
      const e = window.__test.spawnVariant('grunt', 60);
      e.health = e.maxHealth = 1;
    });
    const timer = await punchAndRead(page);
    expect(timer).toBeGreaterThanOrEqual(WINDOW + BRIDGE - 0.2);
    expect(errors).toEqual([]);
  });
});
