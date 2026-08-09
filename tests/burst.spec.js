const { test, expect } = require('@playwright/test');

// OVERDRIVE burst meter — the player-built active super move. These verify the
// earning loop (hit/kill/hurt), the activation gate (full-only), the radial AoE
// (kills crowds, chunks bosses without skipping the fight), and the power-fantasy
// screen-clear (vaporizes projectiles + blows out fire).
const collectErrors = (page) => {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String((e && e.stack) || e)));
  return errors;
};

const telemetry = (page) => page.evaluate(() => window.__stickman || null);
const waitTele = async (page, predicate, timeout = 20000, interval = 120) => {
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
// wait until burst meter has settled to an exact value (post-feedback)
const waitBurst = async (page, value, timeout = 6000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const t = await telemetry(page);
    if (t && t.burst === value) return t;
    await page.waitForTimeout(60);
  }
  return null;
};

test.describe('OVERDRIVE burst meter', () => {
  test('meter builds from a landed hit (+5)', async ({ page }) => {
    test.setTimeout(60000);
    const errors = collectErrors(page);
    await startGame(page);
    await page.evaluate(() => window.__test.clearEnemies());
    // isolate the +5/hit delta from the v2 seed (START_METER) + first-blood bonus
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      s.player.burst = 0; s.firstBloodDone = true;
    });
    const hp0 = await page.evaluate(() => window.__test.spawnDummy(60, true));
    expect(hp0).toBeGreaterThan(0);
    await waitTele(page, (t) => t.enemiesAlive === 1);
    expect((await telemetry(page)).burst).toBe(0);
    await page.keyboard.press('J'); // punch (dmg 11) -> non-lethal hit
    // wait for the punch to connect (enemy hp drops)
    await page.waitForFunction((prev) => {
      const hp = window.__test && window.__test.firstEnemyHp && window.__test.firstEnemyHp();
      return hp != null && hp < prev;
    }, hp0, { timeout: 6000 });
    const t = await waitBurst(page, 5);
    expect(t && t.burst, 'a landed hit earns +5 meter').toBe(5);
    expect(errors).toEqual([]);
  });

  test('meter builds from a kill (+12) on top of the hit', async ({ page }) => {
    test.setTimeout(60000);
    const errors = collectErrors(page);
    await startGame(page);
    await page.evaluate(() => window.__test.clearEnemies());
    // isolate the +17 hit+kill delta from the v2 seed + first-blood bonus
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      s.player.burst = 0; s.firstBloodDone = true;
    });
    await page.evaluate(() => window.__test.spawnDummy(60, true));
    await waitTele(page, (t) => t.enemiesAlive === 1);
    expect((await telemetry(page)).burst).toBe(0);
    // route a lethal strike through the real combat pipeline (hit + kill)
    await page.evaluate(() => window.__test.killFirstEnemy());
    await waitTele(page, (t) => t.kills >= 1);
    // killFirstEnemy fires _onPlayerHit with killed=true: ON_HIT(+5) + ON_KILL(+12)
    const t = await waitBurst(page, 17);
    expect(t && t.burst, 'a kill earns +5 (hit) +12 (kill) = +17').toBe(17);
    expect(errors).toEqual([]);
  });

  test('meter builds when the player takes a hit (+9)', async ({ page }) => {
    test.setTimeout(60000);
    const errors = collectErrors(page);
    await startGame(page);
    await page.evaluate(() => window.__test.clearEnemies());
    // isolate the +9/hurt delta from the v2 seed
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      s.player.burst = 0;
    });
    // an aggressive dummy close enough to swing on the player
    await page.evaluate(() => window.__test.spawnDummy(70, false));
    await waitTele(page, (t) => t.enemiesAlive === 1);
    expect((await telemetry(page)).burst).toBe(0);
    // wait until the player actually takes a hit through the real pipeline
    const hurt = await waitTele(page, (t) => t.hitsTaken >= 1, 12000);
    expect(hurt, 'dummy should land a hit on the player').toBeTruthy();
    expect(hurt.burst, 'taking a hit earns +9 meter').toBeGreaterThanOrEqual(9);
    expect(errors).toEqual([]);
  });

  test('cannot unleash until the meter is full', async ({ page }) => {
    test.setTimeout(60000);
    const errors = collectErrors(page);
    await startGame(page);
    await page.evaluate(() => window.__test.clearEnemies());
    await page.evaluate(() => window.__test.setBurst(80)); // partial
    expect((await telemetry(page)).burst).toBe(80);
    await page.keyboard.press('L'); // bound to CONFIG.BURST.KEY
    await page.waitForTimeout(400);
    const t = await telemetry(page);
    expect(t.bursting, 'partial meter must not trigger a burst').toBeFalsy();
    expect(t.burst, 'meter unchanged on a rejected activation').toBe(80);
    expect(errors).toEqual([]);
  });

  test('a full meter unleashes a radial burst that clears a crowd', async ({ page }) => {
    test.setTimeout(60000);
    const errors = collectErrors(page);
    await startGame(page);
    await page.evaluate(() => window.__test.clearEnemies());
    // three dummies around the player, all well inside the burst radius
    await page.evaluate(() => {
      window.__test.spawnDummy(-110, true);
      window.__test.spawnDummy(60, true);
      window.__test.spawnDummy(150, true);
    });
    await waitTele(page, (t) => t.enemiesAlive === 3);
    const scoreBefore = (await telemetry(page)).score;
    await page.evaluate(() => window.__test.fillBurst());
    expect((await telemetry(page)).burstReady, 'meter reads ready when full').toBeTruthy();
    await page.evaluate(() => window.__test.burst());
    // after the windup(0.22) + release(0.30), all three weak dummies are dead
    const cleared = await waitTele(page, (t) => t.enemiesAlive === 0, 6000);
    expect(cleared, 'the burst should kill every dummy in radius').toBeTruthy();
    expect(cleared.kills, 'kills were credited').toBeGreaterThanOrEqual(3);
    expect(cleared.score, 'score was awarded for the screen-clear').toBeGreaterThan(scoreBefore);
    // meter is fully consumed
    expect((await telemetry(page)).burst).toBe(0);
    expect(errors).toEqual([]);
  });

  test('a boss takes a flat chunk, never a one-shot', async ({ page }) => {
    test.setTimeout(60000);
    const errors = collectErrors(page);
    await startGame(page);
    await page.evaluate(() => window.__test.clearEnemies());
    await page.evaluate(() => window.__test.gotoBossWave(5));
    const up = await waitTele(page, (t) => t.isBossWave && t.bossActive && t.bossHp > 0, 8000);
    expect(up, 'boss wave is live').toBeTruthy();
    const hpBefore = up.bossHp;
    // keep the player alive while the boss closes in from the wall (~536px out,
    // just past the 520px burst radius). Boss approaches on its own at ~95px/s.
    await page.evaluate(() => window.__test.setHealth(99999));
    await page.waitForTimeout(3500); // boss walks ~330px -> well inside radius
    await page.evaluate(() => window.__test.fillBurst());
    await page.evaluate(() => window.__test.burst());
    // boss should survive the burst (flat 50 dmg on a 300+ hp boss)
    const after = await waitTele(page, (t) => t.bossActive && t.bossHp < hpBefore, 6000);
    expect(after, 'boss must take damage from the burst').toBeTruthy();
    expect(after.bossHp, 'boss stays alive (flat chunk, not a one-shot)').toBeGreaterThan(0);
    const dealt = hpBefore - after.bossHp;
    // BOSS_DAMAGE is 50 (not the 45 normal-enemy damage). Allow a tiny rounding
    // window but assert it is distinctly the boss value, not the grunt value.
    expect(dealt, 'boss takes the flat BOSS_DAMAGE (~50), not the grunt 45').toBeGreaterThanOrEqual(48);
    expect(dealt).toBeLessThanOrEqual(52);
    expect(errors).toEqual([]);
  });

  test('the burst vaporizes projectiles and blows out ground fire', async ({ page }) => {
    test.setTimeout(60000);
    const errors = collectErrors(page);
    await startGame(page);
    await page.evaluate(() => window.__test.clearEnemies());
    // player starts at center (640). Spawn a lobbed projectile + a ground fire
    // zone, both within the 520px burst radius but OFF the player's body so they
    // don't push the player into a hurt state before the burst resolves.
    await page.evaluate(() => {
      const px = window.__test;
      const cx = px.playerX();
      px.spawnProjectileAt(cx - 220, 200, cx + 180, 560); // lands away from the player
      px.spawnFireZone(cx + 130, { life: 5, radius: 56, dps: 24 }); // edge at cx+74, clear of player
    });
    await waitTele(page, (t) => t.projectiles >= 1 && t.hazards >= 1);
    await page.evaluate(() => window.__test.fillBurst());
    await page.evaluate(() => window.__test.burst());
    // both layers cleared within the burst radius
    const cleared = await waitTele(page, (t) => t.projectiles === 0 && t.hazards === 0, 6000);
    expect(cleared, 'projectiles + fire in radius are cleared by the wave').toBeTruthy();
    expect(errors).toEqual([]);
  });
});
