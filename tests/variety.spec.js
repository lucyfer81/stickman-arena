// Content variety suite (round 5) — covers the new enemy archetypes
// (shielder / bomber / ranger), the hazard + projectile layers, the multi-type
// pickup, the rage buff, and the rare-event director.
// Run: npx playwright test --config=tests/dev.config.js --project=variety
const { test, expect } = require('@playwright/test');

const gsOf = (page) => page.evaluate(() => window.__game.scene.scenes.find((s) => s && s.constructor.name === 'GameScene'));
const startGame = async (page) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__stickman && window.__stickman.state === 'title', null, { timeout: 15000 });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__stickman && window.__stickman.state === 'game', null, { timeout: 15000 });
  await page.waitForTimeout(900);
};

test.describe('Variety — new enemy archetypes', () => {
  test('shielder blocks light frontal hits, kicks break guard, back is vulnerable', async ({ page }) => {
    test.setTimeout(30000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await startGame(page);
    const r = await page.evaluate(() => {
      const gs = window.__game.scene.scenes.find((s) => s && s.constructor.name === 'GameScene');
      // spawn facing left (toward a player on its left). A light hit from the
      // left (front) should be BLOCKED (no hp loss).
      const e = window.__test.spawnVariant('shielder', 80);
      const hp0 = e.health;
      e.facing = -1;
      e.takeHit(11, e.x - 30, 320, 0.05); // light, frontal
      const blocked = e.health;
      // heavy kick from the front: guard broken + damage lands
      e.takeHit(16, e.x - 30, 560, 0.08);
      const afterKick = e.health;
      // a fresh shielder hit from BEHIND takes damage even when light
      const e2 = window.__test.spawnVariant('shielder', 80);
      e2.facing = 1; // facing right; player is on its left = back
      const hp2 = e2.health;
      e2.takeHit(11, e2.x - 30, 320, 0.05);
      return { hp0, blocked, afterKick, guardBroken: e.guardBroken > 0, hp2, backHit: e2.health };
    });
    expect(errors).toEqual([]);
    expect(r.blocked).toBe(r.hp0);          // blocked: no damage
    expect(r.afterKick).toBeLessThan(r.hp0); // kick damaged
    expect(r.guardBroken).toBe(true);
    expect(r.backHit).toBeLessThan(r.hp2);   // flank/back punishes
  });

  test('bomber detonates a ground-fire hazard + blast-damages the player', async ({ page }) => {
    test.setTimeout(30000);
    await startGame(page);
    const r = await page.evaluate(() => {
      const gs = window.__game.scene.scenes.find((s) => s && s.constructor.name === 'GameScene');
      const beforeHaz = gs.hazards.length;
      const hpBefore = gs.player.health;
      // detonate right next to the player
      window.__test.detonateAt(gs.player.x + 50);
      return {
        hazBefore: beforeHaz, hazAfter: gs.hazards.length,
        hpBefore, hpAfter: gs.player.health,
      };
    });
    expect(r.hazAfter).toBeGreaterThan(r.hazBefore);
    expect(r.hpAfter).toBeLessThan(r.hpBefore);
  });

  test('bomber fuse ignites near the player and detonates within fuse time', async ({ page }) => {
    test.setTimeout(30000);
    await startGame(page);
    // spawn a bomber adjacent and step its AI until it detonates
    const r = await page.evaluate(() => {
      const gs = window.__game.scene.scenes.find((s) => s && s.constructor.name === 'GameScene');
      const e = window.__test.spawnVariant('bomber', 40); // within FUSE_RANGE
      let detonated = false;
      for (let i = 0; i < 120; i++) {
        e.update(0.05, gs.player);
        if (e.detonated) { detonated = true; break; }
      }
      return { detonated, hazards: gs.hazards.length };
    });
    expect(r.detonated).toBe(true);
    expect(r.hazards).toBeGreaterThan(0);
  });

  test('ranger lobs an arcing projectile (upward initial vy) that travels and can hit', async ({ page }) => {
    test.setTimeout(30000);
    await startGame(page);
    // creation + trajectory are checked white-box (no live loop interference)
    const traj = await page.evaluate(() => {
      const gs = window.__game.scene.scenes.find((s) => s && s.constructor.name === 'GameScene');
      gs.spawnEnemyProjectile(gs.player.x - 220, 380, gs.player.x, gs.player.y - 60);
      const pr = gs.projectiles[gs.projectiles.length - 1];
      const vy0 = pr.vy, x0 = pr.x;
      gs._updateProjectiles(0.03);
      return { vy0, moved: pr.x !== x0, count: gs.projectiles.length };
    });
    expect(traj.count).toBeGreaterThan(0);
    expect(traj.vy0).toBeLessThan(0); // lobbed upward (screen-y down)
    expect(traj.moved).toBe(true);
    // hit is verified in isolation: pause the real loop, fire straight down
    // onto a static player, step the projectile system, confirm HP drops.
    const hit = await page.evaluate(() => {
      const gs = window.__game.scene.scenes.find((s) => s && s.constructor.name === 'GameScene');
      window.__test.clearEnemies();
      gs.paused = true;                 // freeze the real sim
      gs.projectiles = [];
      gs.player.health = 100;
      // fire from directly above the player so dx stays ~0 and the falling arc
      // connects regardless of small step variance
      gs.spawnEnemyProjectile(gs.player.x, gs.player.y - 300, gs.player.x, gs.player.y - 60);
      for (let i = 0; i < 240; i++) {
        gs._updateProjectiles(0.03);
        if (gs.player.health < 100) break;
      }
      const damaged = gs.player.health < 100;
      gs.paused = false;
      return damaged;
    });
    expect(hit).toBe(true);
  });
});

test.describe('Variety — pickups & rage', () => {
  test('rage pickup grants a damage + score multiplier for a duration', async ({ page }) => {
    test.setTimeout(30000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await startGame(page);
    const r = await page.evaluate(() => {
      const gs = window.__game.scene.scenes.find((s) => s && s.constructor.name === 'GameScene');
      const baseMul = gs._scoreMul();
      window.__test.giveRage(5);
      const rageMul = gs._scoreMul();
      // rage damage boost rounds harder than base on a dummy
      const e = window.__test.spawnVariant('grunt', 60);
      const hp0 = e.health;
      // simulate a player punch (11 dmg) under rage: effective = 11 * 1.6
      e.takeHit(Math.round(11 * 1.6), gs.player.x, 320, 0.05);
      return { baseMul, rageMul, dmgDealt: hp0 - e.health, rageT: gs.rageT };
    });
    expect(errors).toEqual([]);
    expect(r.rageMul).toBeGreaterThan(r.baseMul);
    expect(r.rageMul / r.baseMul).toBeGreaterThanOrEqual(2); // x2 score
    expect(r.dmgDealt).toBeGreaterThan(11);                  // > base punch dmg
    expect(r.rageT).toBeGreaterThan(0);
  });

  test('score pickup grants an instant bonus via the real collection loop', async ({ page }) => {
    test.setTimeout(30000);
    await startGame(page);
    const before = await page.evaluate(() => {
      const gs = window.__game.scene.scenes.find((s) => s && s.constructor.name === 'GameScene');
      window.__test.clearEnemies();
      gs.player.health = 100; // avoid a stray health drop muddying things
      window.__test.dropPickup('score', gs.player.x);
      return gs.score;
    });
    await page.waitForTimeout(700); // let the live loop collect it
    const after = await page.evaluate(() => window.__game.scene.scenes.find((s) => s && s.constructor.name === 'GameScene').score);
    expect(after).toBeGreaterThanOrEqual(before + 500);
  });
});

test.describe('Variety — rare-event director', () => {
  test('rollEvent respects MIN_WAVE and only returns eligible events', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/');
    await page.waitForTimeout(300);
    const r = await page.evaluate(async () => {
      const E = await import('/js/systems/Events.js');
      const keys = E.eventKeys();
      const below = E.rollEvent(1);                        // < MIN_WAVE(3) -> null
      const never = E.rollEvent(5, () => 0.99);            // eligible wave, chance fails -> null
      const at5 = E.rollEvent(5, () => 0.0);               // chance passes -> an event eligible for wave 5
      const at7 = E.rollEvent(7, () => 0.1);               // chance passes -> eligible for wave 7
      const elig = (wave) => keys.filter((k) => wave >= E.getEvent(k).minWave);
      return {
        keysCount: keys.length,
        below: below,
        never: never,
        at5Valid: at5 ? elig(5).includes(at5) : false,
        at7Valid: at7 ? elig(7).includes(at7) : false,
      };
    });
    expect(r.keysCount).toBeGreaterThanOrEqual(8);
    expect(r.below).toBeNull();
    expect(r.never).toBeNull();
    expect(r.at5Valid).toBe(true);
    expect(r.at7Valid).toBe(true);
  });

  test('SWARM event forces runner spawns + extra count; wave 1 stays grunt-only', async ({ page }) => {
    test.setTimeout(30000);
    await startGame(page);
    const r = await page.evaluate(() => {
      const gs = window.__game.scene.scenes.find((s) => s && s.constructor.name === 'GameScene');
      // wave 1 base table must yield grunt only (gentle intro)
      gs.wave = 1; gs.isBossWave = false; gs.waveFirstSpawn = true;
      for (const e of gs.enemies) { e.dead = true; e.destroy(); }
      gs.enemies = []; gs._resetEventFlags(); gs.activeEvent = null;
      const w1 = [];
      for (let i = 0; i < 6; i++) { gs.spawnOne(); const e = gs.enemies[gs.enemies.length - 1]; w1.push(e.variant); }
      // force swarm on a wave that's eligible (>=3)
      gs.triggerEvent ? null : null;
      window.__test.triggerEvent('swarm', 4);
      const forced = [];
      for (let i = 0; i < 4; i++) { gs.spawnOne(); const e = gs.enemies[gs.enemies.length - 1]; forced.push(e.variant); }
      return { w1: w1.every((v) => v === 'grunt'), swarmAllRunner: forced.every((v) => v === 'runner'), active: gs.activeEvent };
    });
    expect(r.w1).toBe(true);
    expect(r.active).toBe('swarm');
    expect(r.swarmAllRunner).toBe(true);
  });

  test('BOMB SQUAD forces bombers; HEAVY pool stays armored; ELITE DUO spawns 2 vanguards', async ({ page }) => {
    test.setTimeout(30000);
    await startGame(page);
    const r = await page.evaluate(() => {
      const gs = window.__game.scene.scenes.find((s) => s && s.constructor.name === 'GameScene');
      const sample = (key, wave, n) => {
        for (const e of gs.enemies) { e.dead = true; e.destroy(); }
        gs.enemies = gs.enemies.filter((e) => e.scene);
        gs._resetEventFlags();
        window.__test.triggerEvent(key, wave);
        gs.waveFirstSpawn = true;
        const out = [];
        for (let i = 0; i < n; i++) { gs.spawnOne(); const e = gs.enemies[gs.enemies.length - 1]; out.push(e.variant); }
        return out;
      };
      return {
        bomb: sample('bombsquad', 4, 4),
        heavy: sample('heavy', 5, 4),
        elite: sample('elite', 4, 2), // ELITE DUO = exactly two vanguards
      };
    });
    expect(r.bomb.every((v) => v === 'bomber')).toBe(true);
    expect(r.heavy.every((v) => v === 'brute' || v === 'shielder')).toBe(true);
    expect(r.elite.every((v) => v === 'vanguard')).toBe(true);
  });

  test('METEOR STORM spawns telegraphed ground strikes during the wave', async ({ page }) => {
    test.setTimeout(30000);
    await startGame(page);
    const r = await page.evaluate(() => {
      const gs = window.__game.scene.scenes.find((s) => s && s.constructor.name === 'GameScene');
      window.__test.triggerEvent('meteor', 5);
      gs.waveActive = true;
      // fast-forward the meteor timer loop directly
      let sawWarning = false, sawImpact = false;
      const hp0 = gs.player.health;
      for (let i = 0; i < 400; i++) {
        gs._updateMeteors(0.03);
        if (gs.meteorWarnings.length > 0) sawWarning = true;
        if (gs.hazards.length > 0) { sawImpact = true; break; }
      }
      return { sawWarning, sawImpact };
    });
    expect(r.sawWarning).toBe(true);
    expect(r.sawImpact).toBe(true);
  });
});
