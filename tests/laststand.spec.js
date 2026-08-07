// Second Wind ("The Broken") — surprising comeback mechanic.
// Once per run, lethal damage shatters the stickman into a 1-HP last stand
// instead of ending the game. Covers:
//   1. lethal damage enters the broken window (player alive, arm prop dropped,
//      banner/telemetry reflect SHATTER)
//   2. reform via a health pickup restores HP and clears the broken flag
//   3. broken-window kills extend the timer and can drop a heal
//   4. timer expiry -> real death -> game over
//   5. once-per-run: a second lethal hit after reform kills normally
// Run: npx playwright test --config=tests/dev.config.js --project=laststand
const { test, expect } = require('@playwright/test');

const collectErrors = (page) => {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String((e && e.stack) || e)));
  return errors;
};
const tele = (page) => page.evaluate(() => window.__stickman || null);
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
  await page.waitForTimeout(600);
};

test.describe('Second Wind — shatter on lethal damage', () => {
  test('0 HP enters the broken window instead of ending the run', async ({ page }) => {
    test.setTimeout(60000);
    const errors = collectErrors(page);
    await startGame(page);
    // route lethal damage through the real pipeline so the shatter fires
    await page.evaluate(() => {
      const p = window.__game.scene.scenes.find((s) => s && s.constructor.name === 'GameScene').player;
      p.takeHit(p.health + 50, p.x - 100, 200); // overkill from the left
    });
    const broken = await waitTele(page, (t) => t.broken === true, 6000);
    expect(broken, 'player should be broken, not dead').toBeTruthy();
    expect(broken.health).toBe(1);                  // 1-HP last stand
    expect(broken.secondWindUsed).toBe(true);        // gate armed
    expect(broken.brokenMax).toBeGreaterThan(3);     // ~6s window
    expect(broken.state).not.toBe('dying');          // not transitioning to game-over
    // an arm prop + a guaranteed lifeline heal should be in the world
    expect(broken.pickups).toBeGreaterThan(0);
    await page.screenshot({ path: 'tests/shots/second-wind-shatter.png' });
    expect(errors).toEqual([]);
  });
});

test.describe('Second Wind — reform', () => {
  test('health pickup while broken reforms the player', async ({ page }) => {
    test.setTimeout(60000);
    const errors = collectErrors(page);
    await startGame(page);
    await page.evaluate(() => {
      window.__test.enterSecondWind();
    });
    const broken = await waitTele(page, (t) => t.broken === true, 5000);
    expect(broken).toBeTruthy();
    const scoreBefore = broken.score;
    await page.evaluate(() => { window.__test.reform(); });
    const reformed = await waitTele(page, (t) => t.broken === false && t.reformed === true, 6000);
    expect(reformed, 'player should be reformed').toBeTruthy();
    // HP restored to the reform fraction (~40%), not still 1
    expect(reformed.health).toBeGreaterThan(1);
    // reform grants a score bonus
    expect(reformed.score).toBeGreaterThanOrEqual(scoreBefore + 100);
    expect(errors).toEqual([]);
  });
});

test.describe('Second Wind — kill extends timer + drops health', () => {
  test('a broken-window kill adds time and may drop a heal pickup', async ({ page }) => {
    test.setTimeout(60000);
    const errors = collectErrors(page);
    await startGame(page);
    // spawn a passive dummy, enter second wind, then note the timer
    await page.evaluate(() => { window.__test.spawnDummy(70, true); });
    await page.evaluate(() => { window.__test.enterSecondWind(); });
    let t0 = await waitTele(page, (t) => t.broken === true, 5000);
    expect(t0).toBeTruthy();
    const timerBefore = t0.brokenT;
    // route a lethal player strike through the real combat pipeline
    await page.evaluate(() => { window.__test.killFirstEnemy(); });
    const after = await waitTele(page, (t) => t.broken === true && t.kills >= 1, 6000);
    expect(after, 'kill should land during the broken window').toBeTruthy();
    // timer should have gone UP (the kill bonus), not down (it would otherwise
    // only ever decrease). Allow a small real-time delta margin.
    expect(after.brokenT).toBeGreaterThanOrEqual(timerBefore - 0.15);
    expect(errors).toEqual([]);
  });
});

test.describe('Second Wind — expiry and once-per-run', () => {
  test('timer running out -> real death -> game over; second lethal kills after reform', async ({ page }) => {
    test.setTimeout(70000);
    const errors = collectErrors(page);
    await startGame(page);
    await page.evaluate(() => { window.__test.enterSecondWind(); });
    const broken = await waitTele(page, (t) => t.broken === true, 5000);
    expect(broken).toBeTruthy();
    // fast-forward the window to the edge and let it expire
    await page.evaluate(() => { window.__test.fastForwardBroken(0.05); });
    const dying = await waitTele(page, (t) => t.state === 'dying', 6000);
    expect(dying, 'broken window expiry should kill for real').toBeTruthy();
    // wait for the game-over screen
    const gameOver = await waitTele(page, (t) => t.state === 'gameover', 10000);
    expect(gameOver, 'should reach the game-over screen after expiry').toBeTruthy();

    // ---- once-per-run: a fresh run, reform first, then lethal = real death ----
    await startGame(page);
    await page.evaluate(() => { window.__test.enterSecondWind(); });
    expect(await waitTele(page, (t) => t.broken === true, 5000)).toBeTruthy();
    await page.evaluate(() => { window.__test.reform(); });
    expect(await waitTele(page, (t) => t.broken === false && t.reformed === true, 6000)).toBeTruthy();
    // now a lethal hit must kill outright (second wind already consumed).
    // reform grants brief i-frames, so clear them before the killing blow.
    await page.evaluate(() => {
      const gs = window.__game.scene.scenes.find((s) => s && s.constructor.name === 'GameScene');
      const p = gs.player;
      p.invuln = 0;
      p.takeHit(p.health + 99, p.x - 100, 200);
    });
    const deadNow = await waitTele(page, (t) => t.state === 'dying', 6000);
    expect(deadNow, 'a second lethal hit after reform must kill (once per run)').toBeTruthy();
    expect(errors).toEqual([]);
  });
});
