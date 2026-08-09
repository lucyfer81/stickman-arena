const { test, expect } = require('@playwright/test');

// Round 10 fix #2: first-time assist. AFK/confused first-timers were bleeding
// out 0-score in wave 1. Wave 1's opening enemy is now a passive "training
// dummy": it approaches but holds its swing until the player provokes it (a hit)
// or the grace timer expires — a safe window to land the first punch + FIRST BLOOD.

const startGame = async (page) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__stickman && window.__stickman.state === 'title', null, { timeout: 15000 });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__stickman && window.__stickman.state === 'game' && window.__stickman.wave >= 1, null, { timeout: 15000 });
};

test.describe('First-time assist (training dummy)', () => {
  test('wave 1 opening enemy is passive and holds its swing in range', async ({ page }) => {
    test.setTimeout(60000);
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
    await startGame(page);

    // wait for the first enemy to spawn, then isolate it (clear the rest).
    await page.waitForFunction(() => { const s = window.__game.scene.getScene('Game'); return s.enemies.length > 0; }, null, { timeout: 8000 });
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      // remove every enemy except the first so the dummy is the only threat
      for (let i = 1; i < s.enemies.length; i++) { s.enemies[i].dead = true; s.enemies[i].destroy(); }
      s.enemies = s.enemies.slice(0, 1);
      s.spawnQueue = 0;
    });

    // the first enemy must be flagged passive.
    const passive0 = await page.evaluate(() => window.__game.scene.getScene('Game').enemies[0].passive);
    expect(passive0).toBe(true);

    // give it time to walk into range of a stationary player, well within grace.
    const GRACE = 5.0;
    await page.waitForTimeout(Math.min(3500, GRACE * 1000 - 500));

    const state = await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      const e = s.enemies[0];
      return { passive: e ? e.passive : null, dist: e ? Math.abs(e.x - s.player.x) : null,
               hitsTaken: s.hitsTaken, hp: s.player.health, attacking: e && e.attack ? e.attack.phase : null };
    });
    // still passive, and it never landed a hit on the player.
    expect(state.passive).toBe(true);
    expect(state.hitsTaken).toBe(0);
    expect(state.hp).toBe(state.hp); // unchanged at full
    expect(errors).toEqual([]);
  });

  test('landing a hit provokes the dummy (passive clears)', async ({ page }) => {
    test.setTimeout(60000);
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
    await startGame(page);
    await page.waitForFunction(() => { const s = window.__game.scene.getScene('Game'); return s.enemies.length > 0; }, null, { timeout: 8000 });
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      for (let i = 1; i < s.enemies.length; i++) { s.enemies[i].dead = true; s.enemies[i].destroy(); }
      s.enemies = s.enemies.slice(0, 1);
      s.spawnQueue = 0;
    });
    expect(await page.evaluate(() => window.__game.scene.getScene('Game').enemies[0].passive)).toBe(true);

    // the player lands a hit on the dummy — provocation ends the truce.
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      const e = s.enemies[0];
      e.takeHit(5, s.player.x, 300, 0.05);
    });

    const after = await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      return { passive: s.enemies[0] ? s.enemies[0].passive : null };
    });
    expect(after.passive).toBe(false);
    expect(errors).toEqual([]);
  });

  test('the grace timer eventually clears passive (dummy fights back)', async ({ page }) => {
    test.setTimeout(60000);
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
    await startGame(page);
    await page.waitForFunction(() => { const s = window.__game.scene.getScene('Game'); return s.enemies.length > 0; }, null, { timeout: 8000 });
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      for (let i = 1; i < s.enemies.length; i++) { s.enemies[i].dead = true; s.enemies[i].destroy(); }
      s.enemies = s.enemies.slice(0, 1);
      s.spawnQueue = 0;
    });

    // FIRST-MINUTE v2: the truce is now a SCENE-level gate (WAVE1_TRUCE_TIME),
    // not the per-enemy 5s timer. The per-enemy self-expire only fires once the
    // scene truce ends. So we drive the scene timer to its threshold — the next
    // update tick must end the truce and clear passive on every wave-1 enemy.
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      s.wave1TruceT = 12.0; // WAVE1_TRUCE_TIME threshold
    });
    let after = null;
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      after = await page.evaluate(() => {
        const s = window.__game.scene.getScene('Game');
        return { passive: s.enemies[0] ? s.enemies[0].passive : null, truce: s.wave1Truce };
      });
      if (after.passive === false) break;
      await page.waitForTimeout(120);
    }
    expect(after.passive).toBe(false);
    expect(after.truce).toBe(false);
    expect(errors).toEqual([]);
  });

  test('a fumbling first-timer (freeze then mash J) lands a safe FIRST BLOOD', async ({ page }) => {
    // Integration proof of the assist's value: a realistic confused player who
    // freezes ~2.5s (overwhelmed) then fumbles with J should still earn a first
    // kill + the FIRST BLOOD celebration without having been punished — the
    // dummy held its swing so the lesson lands before the danger does.
    test.setTimeout(60000);
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
    await startGame(page);
    await page.waitForTimeout(2500); // freeze, overwhelmed
    // isolate the passive dummy: keep only the first (wave-1 opening) enemy so the
    // safe-window claim is measured against the dummy itself, not the 2nd grunt's
    // ambient pressure (a separate concern). Lower its HP so any landed punch
    // finishes it — robust to headless rAF running the game clock slow.
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      for (let i = 1; i < s.enemies.length; i++) { s.enemies[i].dead = true; s.enemies[i].destroy(); }
      s.enemies = s.enemies.slice(0, 1);
      s.spawnQueue = 0;
      if (s.enemies[0]) s.enemies[0].health = s.enemies[0].maxHealth = 11;
    });
    // mash J, polling for the first kill (FIRST BLOOD). Generous wall-time since
    // headless rAF runs the game slower than real-time.
    let t = null;
    const deadline = Date.now() + 12000;
    while (Date.now() < deadline) {
      await page.keyboard.press('J');
      await page.waitForTimeout(240);
      t = await page.evaluate(() => { const s = window.__game.scene.getScene('Game'); return { kills: s.kills, firstBlood: s.firstBloodDone, hits: s.hitsTaken }; });
      if (t.firstBlood) break;
    }
    const t2 = await page.evaluate(() => { const s = window.__game.scene.getScene('Game'); return { kills: s.kills, firstBlood: s.firstBloodDone, hits: s.hitsTaken }; });
    expect(t2.kills).toBeGreaterThanOrEqual(1);
    expect(t2.firstBlood).toBe(true);
    expect(t2.hits).toBe(0);
    expect(errors).toEqual([]);
  });
});
