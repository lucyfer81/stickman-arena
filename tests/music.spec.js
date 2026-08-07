// Generative soundtrack — the fix for the #1 post-launch complaint ("no music").
// Verifies the procedural music engine follows the game state across scenes:
//   1. menu bed on the title, combat bed in gameplay
//   2. boss waves flip to the driving intensity
//   3. Second Wind flips to the tense intensity; reform restores it
//   4. game over stops the music
//   5. no runtime errors are thrown by the scheduler/note helpers
// Music routes through its own gain under the master, so volume/mute already
// apply; here we assert state transitions via getMusicState() (synchronous).
// Run: npx playwright test --config=tests/dev.config.js --project=music
const { test, expect } = require('@playwright/test');

const collectErrors = (page) => {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String((e && e.stack) || e)));
  return errors;
};
const tele = (page) => page.evaluate(() => window.__stickman || null);
const music = (page) => page.evaluate(() => window.__audio && window.__audio.getMusicState ? window.__audio.getMusicState() : null);
const waitMusic = async (page, predicate, timeout = 8000, interval = 120) => {
  const dl = Date.now() + timeout;
  while (Date.now() < dl) {
    const m = await music(page);
    if (m && predicate(m)) return m;
    await page.waitForTimeout(interval);
  }
  return null;
};
const waitTele = async (page, predicate, timeout = 20000, interval = 120) => {
  const dl = Date.now() + timeout;
  while (Date.now() < dl) {
    const t = await tele(page);
    if (t && predicate(t)) return t;
    await page.waitForTimeout(interval);
  }
  return null;
};
const startGame = async (page) => {
  await page.goto('/');
  await waitTele(page, (t) => t.state === 'title');
  await page.keyboard.press('Space');
  await waitTele(page, (t) => t.state === 'game' && t.wave >= 1);
  await page.waitForTimeout(500);
};

test.describe('Generative soundtrack — scene-following music', () => {
  test('menu bed on title, combat bed in gameplay', async ({ page }) => {
    test.setTimeout(60000);
    const errors = collectErrors(page);
    await page.goto('/');
    await waitTele(page, (t) => t.state === 'title');
    // title requests the calm menu bed (the `on` flag flips synchronously even
    // before the audio context is gesture-resumed).
    const menu = await waitMusic(page, (m) => m.intensity === 'menu', 6000);
    expect(menu, 'title should request menu music').toBeTruthy();
    expect(menu.on).toBe(true);

    await page.keyboard.press('Space');
    await waitTele(page, (t) => t.state === 'game' && t.wave >= 1);
    const combat = await waitMusic(page, (m) => m.intensity === 'combat' && m.on === true, 8000);
    expect(combat, 'gameplay should use the combat bed').toBeTruthy();
    expect(combat.bpm).toBeGreaterThan(0);
    // give the scheduler a moment to actually run notes through the audio graph
    await page.waitForTimeout(800);
    expect(errors).toEqual([]);
  });

  test('boss wave flips to the driving intensity, normal wave flips back', async ({ page }) => {
    test.setTimeout(60000);
    const errors = collectErrors(page);
    await startGame(page);
    await page.evaluate(() => window.__test.gotoBossWave(5));
    const boss = await waitMusic(page, (m) => m.intensity === 'boss', 8000);
    expect(boss, 'boss wave should drive the boss intensity').toBeTruthy();
    expect(boss.bpm).toBeGreaterThanOrEqual(140);
    // a normal wave after that relaxes back to the combat groove
    await page.evaluate(() => window.__test.clearEnemies());
    await page.evaluate(() => { const s = window.__game.scene.scenes.find((x) => x && x.constructor.name === 'GameScene'); s.startWave(6); });
    const back = await waitMusic(page, (m) => m.intensity === 'combat', 8000);
    expect(back, 'a normal wave should restore the combat bed').toBeTruthy();
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });

  test('Second Wind flips to tense music; reform restores it', async ({ page }) => {
    test.setTimeout(60000);
    const errors = collectErrors(page);
    await startGame(page);
    await page.evaluate(() => window.__test.enterSecondWind());
    const brokenMusic = await waitMusic(page, (m) => m.intensity === 'broken', 8000);
    expect(brokenMusic, 'Second Wind should trigger the tense bed').toBeTruthy();
    await page.evaluate(() => window.__test.reform());
    const restored = await waitMusic(page, (m) => m.intensity === 'combat', 8000);
    expect(restored, 'reform should hand the music back to the wave intensity').toBeTruthy();
    expect(errors).toEqual([]);
  });

  test('game over stops the music', async ({ page }) => {
    test.setTimeout(70000);
    const errors = collectErrors(page);
    await startGame(page);
    // confirm music is running, then kill the player for real
    const playing = await waitMusic(page, (m) => m.on === true, 6000);
    expect(playing).toBeTruthy();
    await page.evaluate(() => {
      const gs = window.__game.scene.scenes.find((x) => x && x.constructor.name === 'GameScene');
      const p = gs.player;
      p.invuln = 0;
      p.secondWindUsed = true;   // skip Second Wind so the lethal hit ends the run
      p.takeHit(p.health + 99, p.x - 100, 200);
    });
    await waitTele(page, (t) => t.state === 'gameover', 12000);
    const stopped = await waitMusic(page, (m) => m.on === false, 6000);
    expect(stopped, 'game over should stop the music').toBeTruthy();
    expect(errors).toEqual([]);
  });
});
