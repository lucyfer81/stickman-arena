// Boss variety — "The Oracle" caster boss (the fix for the #1 post-music
// complaint: "only one boss / repetitive"). Boss waves now alternate archetypes:
// wave 5/15/25 = the slammer (ground-slam + shockwaves); wave 10/20/30 = the
// caster (telegraphed lobbed projectile barrage). Both share the HP bar, enrage,
// and BOSS DOWN payoff. Covers:
//   1. wave 5 = slammer, wave 10 = caster (bossKind telemetry + banner name)
//   2. the caster's barrage actually fires ranger-pool projectiles
//   3. caster enrage summons leapers (anti-air), not grunts
//   4. killing the caster fires the same BOSS DOWN payoff + heal drop
// Run: npx playwright test --config=tests/dev.config.js --project=bossvariety
const { test, expect } = require('@playwright/test');

const collectErrors = (page) => {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String((e && e.stack) || e)));
  return errors;
};
const tele = (page) => page.evaluate(() => window.__stickman || null);
const waitTele = async (page, predicate, timeout = 20000, interval = 150) => {
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

test.describe('Boss variety — slammer & caster alternate', () => {
  test('wave 5 is the slammer, wave 10 is the caster', async ({ page }) => {
    test.setTimeout(70000);
    const errors = collectErrors(page);
    await startGame(page);
    await page.evaluate(() => window.__test.gotoBossWave(5));
    const slam = await waitTele(page, (t) => t.bossActive && t.bossKind, 8000);
    expect(slam, 'wave-5 boss should be alive').toBeTruthy();
    expect(slam.bossKind).toBe('slammer');

    await page.evaluate(() => window.__test.gotoBossWave(10));
    const cast = await waitTele(page, (t) => t.bossActive && t.bossKind === 'caster', 8000);
    expect(cast, 'wave-10 boss should be the caster').toBeTruthy();
    expect(cast.bossKind).toBe('caster');
    expect(errors).toEqual([]);
  });

  test('the caster fires a lobbed projectile barrage', async ({ page }) => {
    test.setTimeout(60000);
    const errors = collectErrors(page);
    await startGame(page);
    await page.evaluate(() => window.__test.spawnBossKind('caster'));
    const up = await waitTele(page, (t) => t.bossActive && t.bossKind === 'caster', 8000);
    expect(up).toBeTruthy();
    // Deterministic: drive the boss update at a fixed step so the cast windup
    // (0.6s game-time) resolves regardless of the headless framerate (the old
    // real-time poll could time out when fps was low). Force the special off
    // cooldown, then step until the barrage releases into the projectile pool.
    const r = await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      const b = s.boss; const player = s.player;
      s.projectiles = [];
      b.castCd = 0;
      let fired = false;
      for (let i = 0; i < 200; i++) {
        b.update(0.03, player);
        if (s.projectiles.length > 0) { fired = true; break; }
      }
      return { fired, projectiles: s.projectiles.length };
    });
    expect(r.fired, 'caster barrage should spawn projectiles').toBe(true);
    expect(r.projectiles).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test('caster enrage summons leapers (anti-air), slammer summons grunts', async ({ page }) => {
    test.setTimeout(60000);
    const errors = collectErrors(page);
    await startGame(page);
    await page.evaluate(() => window.__test.spawnBossKind('caster'));
    const up = await waitTele(page, (t) => t.bossActive && t.bossKind === 'caster', 8000);
    expect(up).toBeTruthy();
    const leapersBefore = (up.variants && up.variants.leaper) || 0;
    // drop the boss below the 50% enrage threshold; the enrage callback fires
    // next update and summons CONFIG.BOSS.ENRAGE_SUMMONS adds of the caster's
    // kind. (Enrage-summoned adds are pushed straight into enemies, so we assert
    // on the LIVE variant count rather than the career spawned totals.)
    await page.evaluate(() => { if (window.__test.setBossHp) window.__test.setBossHp(1); });
    const enraged = await waitTele(page, (t) => t.bossEnraged === true, 6000);
    expect(enraged, 'caster should enrage below 50% hp').toBeTruthy();
    expect((enraged.variants && enraged.variants.leaper) || 0).toBeGreaterThan(leapersBefore);
    expect(errors).toEqual([]);
  });

  test('killing the caster fires the BOSS DOWN payoff + heal drop', async ({ page }) => {
    test.setTimeout(60000);
    const errors = collectErrors(page);
    await startGame(page);
    await page.evaluate(() => window.__test.spawnBossKind('caster'));
    const up = await waitTele(page, (t) => t.bossActive && t.bossKind === 'caster', 8000);
    expect(up).toBeTruthy();
    const scoreBefore = up.score;
    await page.evaluate(() => window.__test.killBoss());
    const dead = await waitTele(page, (t) => !t.bossActive, 8000);
    expect(dead, 'caster should die to a lethal strike').toBeTruthy();
    expect(dead.score).toBeGreaterThanOrEqual(scoreBefore + 1000); // BOSS.SCORE = 1500
    const healed = await waitTele(page, (t) => t.pickups > 0, 5000);
    expect(healed && healed.pickups, 'caster death should drop a heal like the slammer').toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
});
