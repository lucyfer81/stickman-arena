// QA bug-fix regression suite. Each test pins a specific defect found in the
// QA pass so it can't silently return.
//
// Bug A: boss wave banner name must match the spawned boss archetype for ALL
//   boss waves (the old startWave used a 2-cycle slammer/caster while _spawnBoss
//   cycled three archetypes; wave 15+ showed the wrong name).
// Bug B: the charger enemy variant must use its own CHARGER constants for its
//   dash (two _startCharge/_progressCharge definitions had collided and the
//   juggernaut boss version silently shadowed the charger's, so every charger
//   hit like a boss — too fast, too long, boss-tier wall-slam feedback).
//
// Run: npx playwright test --config=tests/dev.config.js --project=qabugs
const { test, expect } = require('@playwright/test');

const startGame = async (page) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__stickman && window.__stickman.state === 'title', null, { timeout: 8000 });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__stickman && window.__stickman.state === 'game', null, { timeout: 8000 });
  await page.waitForTimeout(300);
};

test.describe('QA bug regressions', () => {
  test('Bug A: banner + spawn agree on the boss archetype for every boss wave', async ({ page }) => {
    test.setTimeout(25000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await startGame(page);
    const r = await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      const C = window.__config;
      // the shared helper is the single source of truth
      const helper = {};
      for (const w of [5, 10, 15, 20, 25, 30]) helper[w] = s._bossKindForWave(w);
      // verify the spawned variant matches the helper for each real boss wave
      const spawned = {};
      for (const w of [5, 10, 15, 20, 25, 30]) {
        for (const e of s.enemies) e.destroy();
        s.enemies = []; s.boss = null; s.shockwaves = []; s.hazards = []; s.projectiles = []; s.meteorWarnings = []; s.debris = [];
        s.wave = w;
        s._spawnBoss();
        const b = s.boss;
        spawned[w] = { kind: b.bossKind, variant: b.variant, name: C.BOSS.NAME[b.bossKind] };
      }
      return { helper, spawned };
    });
    // expected 3-cycle: 5=slammer, 10=caster, 15=juggernaut, 20=slammer, ...
    const expect3 = { 5: 'slammer', 10: 'caster', 15: 'juggernaut', 20: 'slammer', 25: 'caster', 30: 'juggernaut' };
    for (const w of Object.keys(expect3)) {
      expect(r.helper[w], `helper wave ${w}`).toBe(expect3[w]);
      expect(r.spawned[w].kind, `spawned kind wave ${w}`).toBe(expect3[w]);
      expect(r.spawned[w].name, `name wave ${w}`).toBe(C_BOSS_NAME(expect3[w]));
    }
    expect(errors).toEqual([]);
  });

  test('Bug B: charger uses CHARGER constants (not the juggernaut boss constants)', async ({ page }) => {
    test.setTimeout(25000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await startGame(page);
    const r = await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      const C = window.__config;
      window.__test.clearEnemies();
      const e = window.__test.spawnVariant('charger', 320);
      e.chargeCd = 0;
      const player = s.player;
      // step until the charge starts, then read the charge spec
      let spec = null;
      for (let i = 0; i < 50 && !spec; i++) {
        e.update(0.03, player);
        if (e.charge && e.charge.phase === 'windup') spec = Object.assign({}, e.charge);
      }
      // step into the dash and read velocity (CHARGER.CHARGE_SPEED = 620)
      let dashVx = null;
      for (let i = 0; i < 60 && dashVx === null; i++) {
        e.update(0.03, player);
        if (e.charge && e.charge.phase === 'dash') dashVx = Math.abs(e.vx);
      }
      return {
        hasSpec: !!spec,
        // charger shape carries windup/dashTime/recover (boss shape has none)
        hasChargerFields: spec ? (spec.windup != null && spec.dashTime != null && spec.recover != null) : false,
        windup: spec ? spec.windup : null,
        // boss-shape only field — must NOT be present on a charger
        hasBossHitField: spec ? (spec.hit !== undefined) : null,
        dashVx,
        chargerSpeed: C.CONTENT.CHARGER.CHARGE_SPEED,   // 620
        bossSpeed: C.BOSS.CHARGE.SPEED,                  // 720
        chargerWindup: C.CONTENT.CHARGER.CHARGE_WINDUP, // 0.55
        bossWindup: C.BOSS.CHARGE.WINDUP,                // 0.70
      };
    });
    expect(r.hasSpec).toBe(true);
    expect(r.hasChargerFields, 'charger charge carries its own spec fields').toBe(true);
    expect(r.hasBossHitField, 'charger must NOT use the boss charge shape').toBe(false);
    expect(r.windup).toBe(r.chargerWindup);
    expect(r.windup).not.toBe(r.bossWindup);
    expect(r.dashVx).toBe(r.chargerSpeed);
    expect(r.dashVx).not.toBe(r.bossSpeed);
    expect(errors).toEqual([]);
  });

  test('Bug B: juggernaut boss uses BOSS.CHARGE constants (regression guard)', async ({ page }) => {
    test.setTimeout(25000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await startGame(page);
    const r = await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      const C = window.__config;
      window.__test.clearEnemies();
      window.__test.spawnBossKind('juggernaut');
      const b = s.boss;
      b.chargeCd = 0;
      const player = s.player;
      // step until charge starts — the boss uses _startBossCharge (no player arg)
      let spec = null;
      for (let i = 0; i < 50 && !spec; i++) {
        b.update(0.03, player);
        if (b.charge && b.charge.phase === 'windup') spec = Object.assign({}, b.charge);
      }
      // step into dash and read velocity (BOSS.CHARGE.SPEED = 720)
      let dashVx = null;
      for (let i = 0; i < 80 && dashVx === null; i++) {
        b.update(0.03, player);
        if (b.charge && b.charge.phase === 'dash') dashVx = Math.abs(b.vx);
      }
      return {
        hasSpec: !!spec,
        hasHitField: spec ? (spec.hit === false) : null,     // boss shape
        hasChargerFields: spec ? (spec.windup !== undefined) : null, // charger shape
        dashVx,
        bossSpeed: C.BOSS.CHARGE.SPEED,
        chargerSpeed: C.CONTENT.CHARGER.CHARGE_SPEED,
      };
    });
    expect(r.hasSpec).toBe(true);
    expect(r.hasHitField, 'juggernaut charge uses the boss shape (hit flag)').toBe(true);
    expect(r.hasChargerFields, 'juggernaut must NOT use the charger shape').toBe(false);
    expect(r.dashVx).toBe(r.bossSpeed);
    expect(r.dashVx).not.toBe(r.chargerSpeed);
    expect(errors).toEqual([]);
  });

  test('Bug F1: juggernaut boss spawns with a charge grace period (not 0)', async ({ page }) => {
    test.setTimeout(25000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await startGame(page);
    const r = await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      // spawn a juggernaut fresh and read its constructor-set chargeCd BEFORE
      // any update tick. The old double-init overwrote the 2.5s grace with 0,
      // so the boss charged on frame 1 with no telegraph.
      window.__test.clearEnemies();
      const kind = window.__test.spawnBossKind('juggernaut');
      const b = s.boss;
      return {
        kind,
        chargeCdAtSpawn: b.chargeCd,
        // slam/cast keep their grace — charge must too (parity)
        slamCdAtSpawn: b.slamCd,
        castCdAtSpawn: b.castCd,
      };
    });
    expect(r.kind).toBe('juggernaut');
    // the grace is 2.5s — must be > 0 so the windup telegraph can play
    expect(r.chargeCdAtSpawn, 'juggernaut chargeCd must have a grace (>0) at spawn').toBeGreaterThan(0);
    expect(r.chargeCdAtSpawn).toBeGreaterThanOrEqual(2.0);
    // charger variant (non-boss) still gets its randomized cd, not the boss grace
    const r2 = await page.evaluate(() => {
      window.__test.clearEnemies();
      const e = window.__test.spawnVariant('charger', 320);
      return { variant: e.variant, isBoss: e.isBoss, chargeCd: e.chargeCd };
    });
    expect(r2.isBoss).toBe(false);
    expect(r2.chargeCd, 'non-boss charger keeps randomized cd').toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
});

// local mirror of CONFIG.BOSS.NAME so the test file is self-contained
function C_BOSS_NAME(kind) {
  return kind === 'slammer' ? 'THE SLAMMER'
    : kind === 'caster' ? 'THE ORACLE'
    : 'THE JUGGERNAUT';
}
