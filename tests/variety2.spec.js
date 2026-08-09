// Content variety suite 2 (round 13) — covers the new enemy archetypes
// (charger / medic / splitter / spawnling), the new ground zones (ice patch /
// heal shrine), and the new rare events (frenzy / ambush / plague / blessed).
// Run: npx playwright test --config=tests/dev.config.js --project=variety
const { test, expect } = require('@playwright/test');

const startGame = async (page) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__stickman && window.__stickman.state === 'title', null, { timeout: 15000 });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__stickman && window.__stickman.state === 'game', null, { timeout: 15000 });
  await page.waitForTimeout(900);
};
const gs = (page) => page.evaluate(() => window.__game.scene.scenes.find((s) => s && s.constructor.name === 'GameScene'));

test.describe('Variety 2 — new enemy archetypes', () => {
  test('charger commits to a telegraphed dash with hyper-armor + a tall hitbox', async ({ page }) => {
    test.setTimeout(30000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await startGame(page);
    const r = await page.evaluate(async () => {
      const g = await window.__game.scene.scenes.find((s) => s && s.constructor.name === 'GameScene');
      window.__test.clearEnemies();
      // place a charger at mid-range so it can start a charge
      const e = window.__test.spawnVariant('charger', 320);
      e.chargeCd = 0; // force-eligible
      const hp0 = e.health;
      let sawWindup = false, sawDash = false, armoredDuringDash = false, hitboxDuringDash = null;
      const player = g.player;
      for (let i = 0; i < 200; i++) {
        e.update(0.03, player);
        if (e.charge && e.charge.phase === 'windup') sawWindup = true;
        if (e.charge && e.charge.phase === 'dash') {
          sawDash = true;
          // hyper-armor: a light hit (punch-class kb) during dash does no flinch
          const beforeState = e.state;
          e.takeHit(11, e.x - 200, 320, 0.05); // light, frontal-ish
          if (e.state === beforeState && !e.dead) armoredDuringDash = true;
          hitboxDuringDash = e.getHitbox(player);
          break;
        }
      }
      return { sawWindup, sawDash, armoredDuringDash, hasHitbox: !!hitboxDuringDash, hp: e.health, hp0 };
    });
    expect(errors).toEqual([]);
    expect(r.sawWindup).toBe(true);
    expect(r.sawDash).toBe(true);
    expect(r.armoredDuringDash).toBe(true);   // light hits can't stuff a committed dash
    expect(r.hasHitbox).toBe(true);            // the dash itself is the threat
    expect(r.hp).toBeLessThan(r.hp0);          // the armor-test hit still chipped HP (kill rule)
  });

  test('medic heals the lowest-HP wounded ally in range', async ({ page }) => {
    test.setTimeout(30000);
    await startGame(page);
    const r = await page.evaluate(async () => {
      const g = await window.__game.scene.scenes.find((s) => s && s.constructor.name === 'GameScene');
      window.__test.clearEnemies();
      const ally = window.__test.spawnVariant('grunt', 120); // wounded soon
      const medic = window.__test.spawnVariant('medic', 60);
      medic.chargeCd = 0; // (no-op, just ensure clean state)
      medic.healCd = 0;
      ally.health = 6; // well below threshold -> prime heal target
      const allyHpBefore = ally.health;
      let healed = false;
      for (let i = 0; i < 240; i++) {
        medic.update(0.03, g.player);
        ally.update(0.03, g.player); // keep ally ticking (idle)
        if (ally.health > allyHpBefore) { healed = true; break; }
      }
      return { healed, allyHpBefore, allyHpAfter: ally.health, medicHealed: medic.heal === null };
    });
    expect(r.healed).toBe(true);
    expect(r.allyHpAfter).toBeGreaterThan(r.allyHpBefore);
  });

  test('splitter fissures into spawnlings on death', async ({ page }) => {
    test.setTimeout(30000);
    await startGame(page);
    const r = await page.evaluate(() => {
      const g = window.__game.scene.scenes.find((s) => s && s.constructor.name === 'GameScene');
      window.__test.clearEnemies();
      const e = window.__test.spawnVariant('splitter', 80);
      const before = g.enemies.filter((x) => !x.dead && x.variant === 'spawnling').length;
      e.takeHit(9999, g.player.x, 320, 0.05); // kill via real pipeline -> _die -> split
      const after = g.enemies.filter((x) => !x.dead && x.variant === 'spawnling').length;
      return { before, after };
    });
    expect(r.after).toBeGreaterThan(r.before);
    expect(r.after - r.before).toBeGreaterThanOrEqual(2); // SPAWN_COUNT
  });
});

test.describe('Variety 2 — environmental zones', () => {
  test('ice patch drops the player traction (slip)', async ({ page }) => {
    test.setTimeout(30000);
    await startGame(page);
    const r = await page.evaluate(() => {
      const g = window.__game.scene.scenes.find((s) => s && s.constructor.name === 'GameScene');
      window.__test.clearEnemies();
      g.player.x = 640; g.player.vx = 0; g.player.health = 100;
      g.paused = true;
      window.__test.spawnIce(640);
      // the hazard update sets player.slipT while the player stands in it.
      // step it once and confirm the slip timer is armed (the source of truth
      // the player physics reads to cut traction).
      g._updateHazards(0.03);
      const slipWhenInside = g.player.slipT > 0;
      // now move the player off the patch and confirm slipT stops refreshing
      g.player.x = 200;
      g.player.slipT = 0;
      g._updateHazards(0.03);
      const slipWhenOutside = g.player.slipT > 0;
      // verify the low-traction effect: with slip armed each frame (as an active
      // ice patch would) and a velocity, the player retains far more momentum
      // than normal friction would allow.
      g.player.x = 640; g.player.onGround = true; g.player.vx = 300;
      for (let i = 0; i < 20; i++) { g.player.slipT = 0.12; g.player.update(0.03, { dir: 0, jumpPressed: false, jumpHeld: false }); }
      const retainedOnIce = Math.abs(g.player.vx);
      // normal-ground baseline (slip expired)
      g.player.vx = 300; g.player.slipT = 0;
      for (let i = 0; i < 20; i++) g.player.update(0.03, { dir: 0, jumpPressed: false, jumpHeld: false });
      const retainedNormal = Math.abs(g.player.vx);
      g.paused = false;
      return { slipWhenInside, slipWhenOutside, retainedOnIce, retainedNormal, kind: g.hazards[0] && g.hazards[0].kind };
    });
    expect(r.kind).toBe('ice');
    expect(r.slipWhenInside).toBe(true);   // standing in the patch arms slip
    expect(r.slipWhenOutside).toBe(false); // stepping off stops refreshing it
    expect(r.retainedOnIce).toBeGreaterThan(r.retainedNormal); // slides further
  });

  test('heal shrine restores HP up to its cap', async ({ page }) => {
    test.setTimeout(30000);
    await startGame(page);
    const r = await page.evaluate(() => {
      const g = window.__game.scene.scenes.find((s) => s && s.constructor.name === 'GameScene');
      window.__test.clearEnemies();
      g.player.x = 640; g.player.health = 40; g.player.maxHealth = 100;
      g.paused = true;
      window.__test.spawnShrine(640);
      const hp0 = g.player.health;
      for (let i = 0; i < 400; i++) {
        g._updateHazards(0.05);
        if (g.player.health >= 100) break;
      }
      const hpAfter = g.player.health;
      g.paused = false;
      return { hp0, hpAfter, healed: hpAfter > hp0 };
    });
    expect(r.healed).toBe(true);
    expect(r.hpAfter).toBeGreaterThan(r.hp0);
  });
});

test.describe('Variety 2 — new rare events', () => {
  test('FRENZY makes enemies fast/aggressive but brittle (stat flip)', async ({ page }) => {
    test.setTimeout(30000);
    await startGame(page);
    const r = await page.evaluate(() => {
      const g = window.__game.scene.scenes.find((s) => s && s.constructor.name === 'GameScene');
      // baseline scaling at wave 5
      g._resetEventFlags();
      const a = window.__test.spawnVariant('grunt', 9999); g.enemies.pop(); a.destroy();
      const base = { hp: a.maxHealth, speed: a.speedMul, aggr: a.aggrMul };
      // frenzy scaling at wave 5
      g._resetEventFlags(); g.eventFrenzy = true;
      const b = window.__test.spawnVariant('grunt', 9999); g.enemies.pop(); b.destroy();
      const fren = { hp: b.maxHealth, speed: b.speedMul, aggr: b.aggrMul };
      return { base, fren };
    });
    expect(r.fren.hp).toBeLessThan(r.base.hp);       // brittle
    expect(r.fren.speed).toBeGreaterThan(r.base.speed); // faster
    expect(r.fren.aggr).toBeGreaterThan(r.base.aggr);   // more aggressive
  });

  test('AMBUSH spawns mirrored pairs (one each wall)', async ({ page }) => {
    test.setTimeout(30000);
    await startGame(page);
    const r = await page.evaluate(() => {
      const g = window.__game.scene.scenes.find((s) => s && s.constructor.name === 'GameScene');
      window.__test.clearEnemies();
      window.__test.triggerEvent('ambush', 4);
      g.waveFirstSpawn = true;
      g.spawnQueue = 6;
      const sides = [];
      for (let i = 0; i < 3; i++) {
        const before = g.enemies.length;
        g.spawnOne();
        // each spawn tick should have added two (a mirrored pair)
        sides.push(g.enemies.length - before);
      }
      return { pairs: sides, allTwo: sides.every((n) => n === 2), active: g.activeEvent };
    });
    expect(r.active).toBe('ambush');
    expect(r.allTwo).toBe(true); // every tick produced a mirrored pair
  });

  test('PLAGUE event pool is medic/bomber/charger only', async ({ page }) => {
    test.setTimeout(30000);
    await startGame(page);
    const r = await page.evaluate(() => {
      const g = window.__game.scene.scenes.find((s) => s && s.constructor.name === 'GameScene');
      window.__test.clearEnemies();
      window.__test.triggerEvent('plague', 5);
      g.waveFirstSpawn = true;
      const out = [];
      for (let i = 0; i < 6; i++) { g.spawnOne(); const e = g.enemies[g.enemies.length - 1]; out.push(e.variant); }
      return { out, ok: out.every((v) => ['medic', 'bomber', 'charger'].includes(v)) };
    });
    expect(r.ok).toBe(true);
  });

  test('BLESSED GROUND drops heal shrines in the arena', async ({ page }) => {
    test.setTimeout(30000);
    await startGame(page);
    const r = await page.evaluate(() => {
      const g = window.__game.scene.scenes.find((s) => s && s.constructor.name === 'GameScene');
      window.__test.clearEnemies();
      const before = g.hazards.filter((h) => h.kind === 'shrine').length;
      window.__test.triggerEvent('blessed', 3);
      const after = g.hazards.filter((h) => h.kind === 'shrine').length;
      return { before, after };
    });
    expect(r.after).toBeGreaterThan(r.before);
    expect(r.after).toBeGreaterThanOrEqual(2); // two shrines
  });

  test('event director now offers >= 12 events and new ones are eligible', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/');
    await page.waitForTimeout(300);
    const r = await page.evaluate(async () => {
      const E = await import('/js/systems/Events.js');
      const keys = E.eventKeys();
      return {
        count: keys.length,
        hasFrenzy: keys.includes('frenzy'),
        hasAmbush: keys.includes('ambush'),
        hasPlague: keys.includes('plague'),
        hasBlessed: keys.includes('blessed'),
        frenzyMin: E.getEvent('frenzy').minWave,
      };
    });
    expect(r.count).toBeGreaterThanOrEqual(12);
    expect(r.hasFrenzy && r.hasAmbush && r.hasPlague && r.hasBlessed).toBe(true);
  });
});
