const { test, expect } = require('@playwright/test');

// Round 10 fix #3: mobile hold-to-repeat. Touch was 8x weaker than keyboard
// because one tap = one swing (tap-lift-tap is slow with a thumb). Now holding
// PUNCH/KICK auto-swings as soon as the attack cycle allows. Keyboard stays
// edge-triggered. We measure player.swingId (increments on every attack start)
// to prove a hold produces many attacks a single tap physically cannot.

const startGame = async (page) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__stickman && window.__stickman.state === 'title', null, { timeout: 15000 });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__stickman && window.__stickman.state === 'game' && window.__stickman.wave >= 1, null, { timeout: 15000 });
};

const uiScene = (page) => page.evaluate(() => window.__game.scene.getScene('UI'));

test.describe('Mobile hold-to-repeat attack', () => {
  test('holding PUNCH auto-swings repeatedly (many attacks, not one)', async ({ page }) => {
    test.setTimeout(60000);
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
    await startGame(page);
    await page.evaluate(() => window.__test.clearEnemies());

    const before = await page.evaluate(() => window.__game.scene.getScene('Game').player.swingId);

    // simulate holding the PUNCH button, then poll for repeated swing starts.
    // (Headless rAF runs the game clock slower than wall-time, so we wait on the
    // game's own swing counter rather than a fixed wall-time.)
    await page.evaluate(() => { const ui = window.__game.scene.getScene('UI'); if (ui.touchHeld) ui.touchHeld.PUNCH = true; });
    let swings = before;
    const deadline = Date.now() + 9000;
    while (Date.now() < deadline && swings - before < 3) {
      await page.waitForTimeout(200);
      swings = await page.evaluate(() => window.__game.scene.getScene('Game').player.swingId);
    }
    await page.evaluate(() => { const ui = window.__game.scene.getScene('UI'); if (ui.touchHeld) ui.touchHeld.PUNCH = false; });

    // a single tap is exactly one swing start; a hold must produce many.
    expect(swings - before).toBeGreaterThanOrEqual(3);
    expect(errors).toEqual([]);
  });

  test('a single tap produces only one swing start (no runaway without a hold)', async ({ page }) => {
    test.setTimeout(60000);
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
    await startGame(page);
    await page.evaluate(() => window.__test.clearEnemies());

    const before = await page.evaluate(() => window.__game.scene.getScene('Game').player.swingId);
    // one discrete tap via the shared controls edge
    await page.evaluate(() => { window.__game.scene.getScene('Game').controls.punchPressed = true; });
    await page.waitForTimeout(900);
    const after = await page.evaluate(() => window.__game.scene.getScene('Game').player.swingId);
    // exactly one swing starts from one edge; it does NOT auto-repeat without a hold.
    expect(after - before).toBe(1);
    expect(errors).toEqual([]);
  });
});
