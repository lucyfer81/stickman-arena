// Round C — remaining fixes (post #1/#2 rebind): balance caps, third boss,
// meta-depth unlocks, quick-retry, difficulty ramp. Deterministic where
// possible; drives the real pipelines (combat / boss / recordRun).
//
// Run: npx playwright test --config=tests/dev.config.js --project=roundc
const { test, expect } = require('@playwright/test');

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
const collectErrors = (page) => {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
  return errors;
};
const startGame = async (page) => {
  await page.goto('/');
  await waitTele(page, (t) => t.state === 'title');
  await page.keyboard.press('Space');
  await waitTele(page, (t) => t.state === 'game' && t.wave >= 1);
  await page.waitForTimeout(500);
};

test.describe('Round C — balance, boss, meta, retry, ramp', () => {
  test('#6 bomber friendly-fire chain is capped (no wave-self clear)', async ({ page }) => {
    test.setTimeout(30000);
    const errors = collectErrors(page);
    await startGame(page);
    await page.evaluate(() => window.__test.clearEnemies());
    // Park the player far away so the blast only chains enemies, not the player.
    // Spawn 5 grunts tightly packed (within the 96px blast radius) at x=600.
    const before = await page.evaluate(() => {
      const C = window.__config;
      const s = window.__game.scene.getScene('Game');
      s.player.x = C.WALL_LEFT + 10;
      for (let i = 0; i < 5; i++) {
        window.__test.spawnVariant('grunt', 0);
        const e = s.enemies[s.enemies.length - 1];
        e.x = 600 + (i - 2) * 22; e.vx = 0; e.firstStrike = false; e.attackCd = 1e9;
      }
      return s.enemies.filter((e) => !e.dead).length;
    });
    expect(before).toBe(5);
    // detonate at the cluster centre. The chain does a flat 26 dmg to ≤3 enemies;
    // the lingering fire ticks the rest for a few dmg. Count only CHAIN-level hits
    // (drop ≥ 20) to isolate the cap from the fire-zone DPS.
    await page.evaluate(() => window.__test.detonateAt(600));
    await page.waitForTimeout(150);
    const chainHit = await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      return s.enemies.filter((e) => !e.dead && (e.maxHealth - e.health) >= 20).length;
    });
    // CHAIN_MAX = 3: at most 3 enemies take the chain hit from a single blast
    expect(chainHit).toBeLessThanOrEqual(3);
    expect(errors).toEqual([]);
  });

  test('#6 splitter spiral is capped (spawnlings never exceed MAX_SIMULT)', async ({ page }) => {
    test.setTimeout(30000);
    const errors = collectErrors(page);
    await startGame(page);
    await page.evaluate(() => window.__test.clearEnemies());
    // spawn + kill 4 splitters in succession; total simultaneous spawnlings stays bounded
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      for (let i = 0; i < 4; i++) window.__test.spawnVariant('splitter', 80 + i * 10);
    });
    let maxSpawnlings = 0;
    for (let i = 0; i < 4; i++) {
      await page.evaluate((i) => {
        const s = window.__game.scene.getScene('Game');
        const sp = s.enemies.filter((e) => !e.dead && e.variant === 'splitter')[0];
        if (sp) sp.takeHit(9999, s.player.x, 0, 0);
      }, i);
      await page.waitForTimeout(120);
      const n = await page.evaluate(() => window.__game.scene.getScene('Game').enemies.filter((e) => !e.dead && e.variant === 'spawnling').length);
      if (n > maxSpawnlings) maxSpawnlings = n;
    }
    // MAX_SIMULT = 4: the crowd never spirals past the cap
    expect(maxSpawnlings).toBeLessThanOrEqual(4);
    expect(errors).toEqual([]);
  });

  test('#7 third boss: wave 15 spawns THE JUGGERNAUT (steel bulwark, charge)', async ({ page }) => {
    test.setTimeout(30000);
    const errors = collectErrors(page);
    await startGame(page);
    // gotoBossWave queues the boss (spawnTimer ~0.3s); wait for it to actually spawn.
    const bossKindAt = async (wave) => {
      await page.evaluate((w) => window.__test.gotoBossWave(w), wave);
      await page.waitForFunction(() => { const s = window.__game.scene.getScene('Game'); return s.boss && !s.boss.dead; }, null, { timeout: 6000 });
      return await page.evaluate(() => { const b = window.__game.scene.getScene('Game').boss; return b ? { kind: b.bossKind, variant: b.variant, isBoss: b.isBoss, hp: b.maxHealth } : null; });
    };
    const r = await bossKindAt(15);
    expect(r).not.toBeNull();
    expect(r.kind).toBe('juggernaut');
    expect(r.variant).toBe('bossJuggernaut');
    expect(r.isBoss).toBe(true);
    // still cycles the first two correctly: wave 5 slammer, wave 10 caster
    expect((await bossKindAt(5)).kind).toBe('slammer');
    expect((await bossKindAt(10)).kind).toBe('caster');
    expect(errors).toEqual([]);
  });

  test('#7 juggernaut charge connects on a grounded player + enrage summons a brute', async ({ page }) => {
    test.setTimeout(30000);
    const errors = collectErrors(page);
    await startGame(page);
    await page.evaluate(() => window.__test.spawnBossKind('juggernaut'));
    await page.waitForFunction(() => { const s = window.__game.scene.getScene('Game'); return s.boss && !s.boss.dead; }, null, { timeout: 6000 });
    // park the boss + player within charge RANGE (760) so the special fires
    await page.evaluate(() => {
      const C = window.__config;
      const s = window.__game.scene.getScene('Game');
      s.boss.x = C.WALL_LEFT + 40; s.player.x = 700; s.player.y = C.GROUND_Y;
    });
    const hitsBefore = await page.evaluate(() => window.__stickman.hitsTaken || 0);
    // force the special; let it wind up + dash across. The grounded player in the
    // lane should eat a contact hit.
    let chargeSeen = false;
    const dl = Date.now() + 6000;
    while (Date.now() < dl) {
      await page.evaluate(() => window.__test.bossFireSpecial());
      const st = await page.evaluate(() => { const b = window.__game.scene.getScene('Game').boss; return b && b.charge ? b.charge.phase : null; });
      if (st === 'dash') { chargeSeen = true; break; }
      await page.waitForTimeout(120);
    }
    expect(chargeSeen, 'juggernaut should enter its dash phase').toBe(true);
    await page.waitForTimeout(1400); // let the dash resolve across the arena
    const hitsAfter = await page.evaluate(() => window.__stickman.hitsTaken || 0);
    expect(hitsAfter, 'a grounded player in the charge lane gets hit').toBeGreaterThan(hitsBefore);
    // enrage at 50% summons brutes (not grunts/leapers). The enrage check lives
    // in the boss update loop, so setting health<50% + enraged=false is enough.
    const beforeBrutes = await page.evaluate(() => window.__game.scene.getScene('Game').enemies.filter((e) => !e.dead && e.variant === 'brute').length);
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      const b = s.boss; if (b) { b.health = b.maxHealth * 0.4; b.enraged = false; b.charge = null; b.chargeCd = 2; }
    });
    await page.waitForTimeout(400);
    const afterBrutes = await page.evaluate(() => window.__game.scene.getScene('Game').enemies.filter((e) => !e.dead && e.variant === 'brute').length);
    expect(afterBrutes, 'juggernaut enrage summons brutes').toBeGreaterThan(beforeBrutes);
    expect(errors).toEqual([]);
  });

  test('#8 meta-depth: playstyle achievements unlock the new skins', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/');
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const M = window.__meta;
      localStorage.removeItem('stickman_arena_stats');
      // fresh: none of the new skins unlocked
      const s0 = M.unlockedSkins(M.loadStats());
      const has = (k) => s0.indexOf(k) !== -1;
      // a run that spares 5 + unleashes 15 overdrives + beats 3 bosses + reforms once
      M.recordRun({ kills: 30, wave: 15, bestCombo: 12, score: 9000, mercySpares: 5, bursts: 15, bossKills: 3, reforms: 1 });
      const s1 = M.unlockedSkins(M.loadStats());
      // a second run adds a 2nd reform -> phoenix
      M.recordRun({ kills: 5, wave: 6, bestCombo: 5, score: 2000, mercySpares: 0, bursts: 0, bossKills: 0, reforms: 1 });
      const s2 = M.unlockedSkins(M.loadStats());
      const stats = M.loadStats();
      return {
        freshNoPacifist: !has('pacifist'),
        pacifist: s1.indexOf('pacifist') !== -1,
        surge: s1.indexOf('surge') !== -1,
        slayer: s1.indexOf('slayer') !== -1,
        phoenix: s2.indexOf('phoenix') !== -1,
        totalMercy: stats.totalMercy, totalBursts: stats.totalBursts,
        totalBossKills: stats.totalBossKills, totalReforms: stats.totalReforms,
      };
    });
    expect(r.freshNoPacifist).toBe(true);
    expect(r.pacifist).toBe(true);
    expect(r.surge).toBe(true);
    expect(r.slayer).toBe(true);
    expect(r.phoenix).toBe(true);
    expect(r.totalMercy).toBe(5);
    expect(r.totalBursts).toBe(15);
    expect(r.totalBossKills).toBe(3);
    expect(r.totalReforms).toBe(2);
  });

  test('#9 quick-retry: R on game over drops straight into a new run (not the title)', async ({ page }) => {
    test.setTimeout(40000);
    const errors = collectErrors(page);
    await startGame(page);
    // die
    await page.evaluate(() => window.__test.setHealth(1));
    await page.evaluate(() => window.__test.hurt(99));
    await waitTele(page, (t) => t.state === 'gameover');
    await page.waitForTimeout(800); // input lockout window
    await page.keyboard.press('KeyR');
    const t = await waitTele(page, (tt) => tt.state === 'game');
    expect(t, 'R should start a new game run directly').not.toBeNull();
    expect(errors).toEqual([]);
  });

  test('#4 smoother ramp: wave-4 aggression exceeds wave-2 (no flat-then-spike)', async ({ page }) => {
    test.setTimeout(20000);
    const errors = collectErrors(page);
    await page.goto('/');
    await waitTele(page, (t) => t.state === 'title');
    await page.keyboard.press('Space');
    await waitTele(page, (t) => t.state === 'game');
    const r = await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      const sample = (wave) => {
        s.wave = wave;
        const e = window.__test.spawnVariant('grunt', 9999); s.enemies.pop(); e.destroy();
        return e.aggrMul;
      };
      return { w2: sample(2), w4: sample(4) };
    });
    expect(r.w4, 'wave-4 aggression should ramp above wave-2').toBeGreaterThan(r.w2);
    expect(errors).toEqual([]);
  });
});
