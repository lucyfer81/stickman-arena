const { test, expect } = require('@playwright/test');

// Round 10 fix #1: pickup magnet. Telemetry showed healed=0 for every persona —
// drops spawn on the corpse and players walk away from all of them. The magnet
// makes a pickup lock on and fly to the player once they're close. These checks
// prove the loop now actually engages (and that distant drops still wait).

const startGame = async (page) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__stickman && window.__stickman.state === 'title', null, { timeout: 15000 });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__stickman && window.__stickman.state === 'game' && window.__stickman.wave >= 1, null, { timeout: 15000 });
};

// Poll the live scene, keeping enemies cleared so spawn/knockback noise can't
// mask the magnet mechanics we're isolating here.

test.describe('Pickup magnet (resource loop fix)', () => {
  test('a health drop within range flies to the player and is collected', async ({ page }) => {
    test.setTimeout(60000);
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
    await startGame(page);

    // hurt the player so the heal is observable, then drop health just inside the
    // magnet range but well outside the static collect radius.
    const setup = await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      window.__test.clearEnemies();
      const px = s.player.x;
      s.player.health = 50;            // leave room to observe +25
      s.healed = 0;
      window.__test.dropPickup('health', px + 110); // within MAGNET_RANGE(150), beyond collect(46)
      return { px, hpBefore: s.player.health };
    });

    // poll until the drop is consumed (or timeout). Enemies re-cleared each tick.
    let after = null;
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      after = await page.evaluate(() => {
        const s = window.__game.scene.getScene('Game');
        window.__test.clearEnemies();
        return { hp: s.player.health, healed: s.healed, pickups: s.pickups.length };
      });
      if (after.pickups === 0) break;
      await page.waitForTimeout(100);
    }

    expect(after.healed).toBeGreaterThan(0);
    expect(after.hp).toBeGreaterThan(setup.hpBefore);
    expect(after.pickups).toBe(0);
    expect(errors).toEqual([]);
  });

  test('a health drop far outside range stays put (no vacuum through the arena)', async ({ page }) => {
    test.setTimeout(60000);
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
    await startGame(page);

    const setup = await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      window.__test.clearEnemies();
      const px = s.player.x;
      s.player.health = 50; s.healed = 0;
      window.__test.dropPickup('health', px + 400); // well beyond MAGNET_RANGE
      return { px, hpBefore: s.player.health };
    });

    // let it pop up, fall, and settle — keep enemies cleared, player never approaches.
    await page.waitForTimeout(500);
    for (let i = 0; i < 4; i++) { await page.evaluate(() => window.__test.clearEnemies()); await page.waitForTimeout(150); }

    const after = await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      window.__test.clearEnemies();
      const p = s.pickups[0];
      return { hp: s.player.health, healed: s.healed, present: s.pickups.length,
               homing: p ? !!p.homing : null };
    });
    expect(after.healed).toBe(0);
    expect(after.hp).toBe(setup.hpBefore);
    expect(after.present).toBe(1);
    expect(after.homing).toBe(false);
    expect(errors).toEqual([]);
  });

  test('magnet enables Second Wind reform (broken player collects a heal)', async ({ page }) => {
    test.setTimeout(60000);
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
    await startGame(page);

    // enter the broken window, then drop a health near the broken player. Before
    // the magnet this never collected; now it must reform. Dropped just inside
    // the collect radius so the test isn't dependent on rAF timing under the
    // broken-entry slowmo/hitpause — the magnet delivery itself is covered above.
    const entered = await page.evaluate(() => { window.__test.clearEnemies(); return window.__test.enterSecondWind(); });
    expect(entered).toBe(true);

    // wait out the entry feedback (hitpause+slowmo) so the scene is ticking.
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      window.__test.clearEnemies();
      window.__test.dropPickup('health', s.player.x + 40);
    });

    let after = null;
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      after = await page.evaluate(() => {
        const s = window.__game.scene.getScene('Game');
        window.__test.clearEnemies();
        return { broken: s.player.broken, reformed: s.player.reformed, hp: s.player.health };
      });
      if (!after.broken) break;
      await page.waitForTimeout(150);
    }
    expect(after.broken).toBe(false);
    expect(after.reformed).toBe(true);
    expect(after.hp).toBeGreaterThan(1);
    expect(errors).toEqual([]);
  });
});
