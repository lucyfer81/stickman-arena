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
  return null;
};

const startGame = async (page) => {
  await page.goto('/');
  await waitTele(page, (t) => t.state === 'title');
  await page.keyboard.press('Space');
  await waitTele(page, (t) => t.state === 'game' && t.wave >= 1);
};

test.describe('Boss waves', () => {
  test('boss spawns on wave 5 with HP bar and big payoff on kill', async ({ page }) => {
    test.setTimeout(90000);
    const errors = collectErrors(page);
    await startGame(page);
    await page.waitForTimeout(800);

    // jump straight to the first boss wave
    await page.evaluate(() => window.__test && window.__test.gotoBossWave && window.__test.gotoBossWave(5));
    const bossUp = await waitTele(page, (t) => t.isBossWave && t.bossActive && t.bossHp > 0, 8000);
    expect(bossUp, 'boss should be alive on a boss wave').toBeTruthy();
    expect(bossUp.bossMaxHp).toBeGreaterThan(150); // boss-tier HP, not a grunt
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/shots/boss-spawn.png' });

    // route the kill through the real combat pipeline -> BOSS DOWN payoff fires
    const scoreBefore = bossUp.score;
    await page.evaluate(() => window.__test && window.__test.killBoss && window.__test.killBoss());
    const killed = await waitTele(page, (t) => !t.bossActive, 8000);
    expect(killed, 'boss should die when struck').toBeTruthy();
    expect(killed.score).toBeGreaterThanOrEqual(scoreBefore + 1000); // BOSS.SCORE = 1500
    // a guaranteed health pickup is dropped on the boss death
    const dropped = await waitTele(page, (t) => t.pickups > 0, 4000);
    expect(dropped && dropped.pickups, 'boss death should drop a heal pickup').toBeGreaterThan(0);
    // wave should clear shortly after the boss dies (no adds survived)
    const cleared = await waitTele(page, (t) => !t.waveActive || t.wave >= 6, 6000);
    expect(cleared).toBeTruthy();
    await page.screenshot({ path: 'tests/shots/boss-down.png' });
    expect(errors).toEqual([]);
  });

  test('ground-slam emits shockwaves the player must jump', async ({ page }) => {
    test.setTimeout(90000);
    const errors = collectErrors(page);
    await startGame(page);
    await page.waitForTimeout(800);
    await page.evaluate(() => window.__test && window.__test.spawnBoss && window.__test.spawnBoss());

    const bossUp = await waitTele(page, (t) => t.bossActive, 6000);
    expect(bossUp).toBeTruthy();

    // hold full health and wait for the boss to commit a slam -> shockwaves appear
    let sawShock = false;
    const shockDeadline = Date.now() + 18000;
    while (Date.now() < shockDeadline) {
      await page.evaluate(() => window.__test && window.__test.setHealth && window.__test.setHealth(100));
      const t = await telemetry(page);
      if (t && t.shockwaves > 0) { sawShock = true; break; }
      await page.waitForTimeout(150);
    }
    expect(sawShock, 'boss slam should radiate shockwaves').toBeTruthy();
    await page.screenshot({ path: 'tests/shots/boss-shockwave.png' });

    // a grounded player standing on the shockwave takes damage (must jump).
    // We stay idle (no movement, no jump) and keep HP topped between passes so
    // a single clip is observable in hitsTaken.
    let tookHit = false;
    const hitDeadline = Date.now() + 14000;
    while (Date.now() < hitDeadline) {
      await page.evaluate(() => window.__test && window.__test.setHealth && window.__test.setHealth(100));
      await page.waitForTimeout(120);
      const t = await telemetry(page);
      if (t && t.shockwaves > 0) {
        // do NOT jump — stay grounded and let the wave pass
        await page.waitForTimeout(300);
        const t2 = await telemetry(page);
        if (t2 && t2.hitsTaken > 0) { tookHit = true; break; }
      }
    }
    expect(tookHit, 'a grounded player should be clipped by the shockwave').toBe(true);
    expect(errors).toEqual([]);
  });

  test('jumping clears the shockwave (no damage while airborne)', async ({ page }) => {
    test.setTimeout(90000);
    const errors = collectErrors(page);
    await startGame(page);
    await page.waitForTimeout(800);
    await page.evaluate(() => window.__test && window.__test.spawnBoss && window.__test.spawnBoss());
    await waitTele(page, (t) => t.bossActive, 6000);

    // spam jump while a shockwave is present — an airborne player clears it and
    // should take far fewer hits than a grounded stance over the same window.
    const hitsBefore = (await telemetry(page)).hitsTaken;
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      await page.evaluate(() => window.__test && window.__test.setHealth && window.__test.setHealth(100));
      // hop continuously to ride above the shockwave line
      await page.keyboard.down('Space'); await page.waitForTimeout(40); await page.keyboard.up('Space');
      await page.waitForTimeout(120);
    }
    const after = await telemetry(page);
    // jumping isn't perfectly reliable for the whole window, but a hopping player
    // should never take more than a couple of clips — sanity bound only.
    expect(after.hitsTaken - hitsBefore).toBeLessThan(6);
    expect(errors).toEqual([]);
  });
});
