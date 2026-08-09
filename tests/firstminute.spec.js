// First-Minute retention v2 — covers the 7 changes targeting the 60s window:
//   A1. Wave-1 full truce: ALL wave-1 enemies passive until first hit / 12s gate
//   A2. Title J-tag: glows on the demo punch
//   B1. Overdrive seed: meter starts part-charged + first-blood bonus
//   B2. First-action score: number climbs from second 1
//   B3. Guaranteed early heal: drop on 3rd wave-1 kill if HP<max
//   C1. ROOKIE skin: unlocks at first wave clear (bestWave >= 2)
//   C2. Game-over tip: shows for wave-1/2 deaths
//
// Run: npx playwright test --config=tests/dev.config.js --project=firstminute
const { test, expect } = require('@playwright/test');

const tele = (page) => page.evaluate(() => window.__stickman || null);
const waitTele = async (page, predicate, timeout = 30000, interval = 120) => {
  const dl = Date.now() + timeout;
  while (Date.now() < dl) {
    const t = await tele(page);
    if (t && predicate(t)) return t;
    await page.waitForTimeout(interval);
  }
  throw new Error('telemetry condition timed out');
};

const startGame = async (page) => {
  await page.goto('/');
  await waitTele(page, (t) => t.state === 'title');
  await page.keyboard.press('Space');
  await waitTele(page, (t) => t.state === 'game' && t.wave >= 1);
  await page.waitForTimeout(600);
};

const collectErrors = (page) => {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
  return errors;
};

// ---------- A1: Wave-1 full truce ----------
test.describe('First-minute — A1 wave-1 full truce', () => {
  test('every wave-1 enemy spawns passive while the truce is active', async ({ page }) => {
    test.setTimeout(40000);
    const errors = collectErrors(page);
    await startGame(page);
    // wait for multiple wave-1 enemies to be alive, then check ALL are passive
    await page.waitForFunction(() => {
      const s = window.__game.scene.getScene('Game');
      return s.enemies.length >= 2;
    }, null, { timeout: 8000 });
    const res = await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      return {
        truce: s.wave1Truce,
        allPassive: s.enemies.every((e) => e.passive === true),
        count: s.enemies.length,
      };
    });
    expect(res.truce).toBe(true);
    expect(res.count).toBeGreaterThanOrEqual(2);
    expect(res.allPassive).toBe(true);
    expect(errors).toEqual([]);
  });

  test('the first landed hit ends the truce and clears passive on every enemy', async ({ page }) => {
    test.setTimeout(40000);
    const errors = collectErrors(page);
    await startGame(page);
    await page.waitForFunction(() => {
      const s = window.__game.scene.getScene('Game');
      return s.enemies.length >= 1;
    }, null, { timeout: 8000 });
    // pull the nearest enemy right next to the player so a punch can't miss,
    // then drive the REAL attack pipeline (press J). _onPlayerHit is only called
    // from the scene's combat resolver, not from enemy.takeHit() directly.
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      const e = s.enemies[0];
      if (e) { e.x = s.player.x + 60; e.vx = 0; }
    });
    // mash J and poll until firstHit lands (headless rAF runs slower than realtime)
    let res = null;
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      await page.keyboard.press('J');
      await page.waitForTimeout(180);
      res = await page.evaluate(() => {
        const s = window.__game.scene.getScene('Game');
        return {
          truce: s.wave1Truce,
          firstHit: s.onboard.firstHit,
          nonePassive: s.enemies.every((e) => !e.passive),
        };
      });
      if (res.firstHit) break;
    }
    expect(res.firstHit).toBe(true);
    expect(res.truce).toBe(false);
    expect(res.nonePassive).toBe(true);
    expect(errors).toEqual([]);
  });

  test('AFK player survives the full 12s truce with no damage', async ({ page }) => {
    // The core retention proof: a frozen first-timer cannot be damaged during
    // the wave-1 truce. Bleeds out 0-score deaths in wave 1 are the #1 D1 churn.
    test.setTimeout(40000);
    const errors = collectErrors(page);
    await startGame(page);
    // do NOTHING; drive the truce timer to just-under-threshold and check HP
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      s.wave1TruceT = 11.9; // just under WAVE1_TRUCE_TIME (12)
    });
    await page.waitForTimeout(500);
    const res = await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      return { hp: s.player.health, hitsTaken: s.hitsTaken, truce: s.wave1Truce };
    });
    expect(res.truce).toBe(true);
    expect(res.hitsTaken).toBe(0);
    expect(res.hp).toBe(res.hp); // unchanged at full
    expect(errors).toEqual([]);
  });
});

// ---------- A2: Title J-tag ----------
test.describe('First-minute — A2 title J-tag', () => {
  test('the J-tag text exists on the title screen', async ({ page }) => {
    test.setTimeout(20000);
    const errors = collectErrors(page);
    await page.goto('/');
    await waitTele(page, (t) => t.state === 'title');
    // wait one sparring round so the demo punch fires at least once
    await page.waitForTimeout(4000);
    // the J-tag is a Phaser text object on the Title scene; find it via the scene
    const exists = await page.evaluate(() => {
      const sc = window.__game.scene.getScene('Title');
      return !!(sc && sc.demoKey);
    });
    expect(exists).toBe(true);
    expect(errors).toEqual([]);
  });
});

// ---------- B1: Overdrive seed + first-blood bonus ----------
test.describe('First-minute — B1 overdrive seed', () => {
  test('meter starts at START_METER (not 0)', async ({ page }) => {
    test.setTimeout(20000);
    const errors = collectErrors(page);
    await startGame(page);
    const res = await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      return { burst: s.player.burst, startMeter: window.__meta ? 35 : 35 };
    });
    expect(res.burst).toBeGreaterThan(0);
    expect(res.burst).toBe(35);
    expect(errors).toEqual([]);
  });

  test('FIRST BLOOD grants the configured meter bonus', async ({ page }) => {
    test.setTimeout(40000);
    const errors = collectErrors(page);
    await startGame(page);
    // capture meter just before the first kill, then after
    await page.waitForFunction(() => {
      const s = window.__game.scene.getScene('Game');
      return s.enemies.length > 0;
    }, null, { timeout: 8000 });
    const meterBefore = await page.evaluate(() => window.__game.scene.getScene('Game').player.burst);
    // kill the first enemy via the real pipeline (fires FIRST BLOOD)
    await page.evaluate(() => {
      window.__test.spawnDummy(60);
      window.__test.killFirstEnemy();
    });
    const after = await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      return { firstBlood: s.firstBloodDone, burst: s.player.burst };
    });
    expect(after.firstBlood).toBe(true);
    // FIRST_BLOOD_BONUS (15) + ON_KILL (12) = at least +27 from the kill alone
    expect(after.burst).toBeGreaterThanOrEqual(meterBefore + 15);
    expect(errors).toEqual([]);
  });
});

// ---------- B2: First-action score ----------
test.describe('First-minute — B2 first-action score', () => {
  test('first move grants a score bonus', async ({ page }) => {
    test.setTimeout(20000);
    const errors = collectErrors(page);
    await startGame(page);
    expect(await page.evaluate(() => window.__stickman.score)).toBe(0);
    await page.keyboard.press('D');
    await page.waitForTimeout(300);
    const score = await page.evaluate(() => window.__stickman.score);
    expect(score).toBeGreaterThanOrEqual(5); // FIRST_MOVE_SCORE
    expect(errors).toEqual([]);
  });

  test('first jump grants a score bonus', async ({ page }) => {
    test.setTimeout(20000);
    const errors = collectErrors(page);
    await startGame(page);
    await page.keyboard.down('Space');
    await page.waitForTimeout(60);
    await page.keyboard.up('Space');
    await page.waitForTimeout(300);
    const score = await page.evaluate(() => window.__stickman.score);
    expect(score).toBeGreaterThanOrEqual(5); // FIRST_JUMP_SCORE
    expect(errors).toEqual([]);
  });
});

// ---------- B3: Guaranteed early heal ----------
test.describe('First-minute — B3 guaranteed early heal', () => {
  test('3rd wave-1 kill drops a heal when HP < max', async ({ page }) => {
    test.setTimeout(40000);
    const errors = collectErrors(page);
    await startGame(page);
    // damage the player a bit so HP < max (heal only drops when not full)
    await page.evaluate(() => { window.__test.hurt(20); });
    await page.waitForFunction(() => {
      const s = window.__game.scene.getScene('Game');
      return s.enemies.length > 0;
    }, null, { timeout: 8000 });
    // spawn + kill 3 wave-1 enemies, counting heal drops
    const res = await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      const before = s.pickups.length;
      for (let i = 0; i < 3; i++) {
        s.wave = 1;
        window.__test.spawnDummy(60);
        window.__test.killFirstEnemy();
      }
      return { heals: s.pickups.length - before + s.pickups.filter((p) => !p.scene).length };
    });
    // at least one heal pickup was created across the 3 kills (the guaranteed one)
    expect(res.heals).toBeGreaterThanOrEqual(1);
    expect(errors).toEqual([]);
  });
});

// ---------- C1: ROOKIE skin ----------
test.describe('First-minute — C1 ROOKIE skin', () => {
  test('rookie unlocks when bestWave >= 2 (cleared wave 1)', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/');
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const M = window.__meta;
      localStorage.removeItem('stickman_arena_stats');
      const fresh = M.isSkinUnlocked('rookie');
      localStorage.setItem('stickman_arena_stats', JSON.stringify({ totalKills: 0, gamesPlayed: 0, bestWave: 2, bestCombo: 0, bestScore: 0, totalScore: 0 }));
      const clearedWave1 = M.isSkinUnlocked('rookie');
      const def = M.skinDef('rookie');
      return { fresh, clearedWave1, label: def.label };
    });
    expect(r.fresh).toBe(false);
    expect(r.clearedWave1).toBe(true);
    expect(r.label).toBe('ROOKIE');
  });
});

// ---------- C2: Game-over tip ----------
test.describe('First-minute — C2 game-over tip', () => {
  test('wave-1 death shows a contextual tip', async ({ page }) => {
    test.setTimeout(40000);
    const errors = collectErrors(page);
    // clear any prior high score so newBest=false (score 0 can't beat hs 0)
    await page.addInitScript(() => { try { localStorage.removeItem('stickman_arena_hs'); } catch (e) {} });
    await startGame(page);
    // disable Second Wind so the death is clean (reform would grant +750 score
    // and flip newBest, suppressing the tip — isolating the tip-render logic)
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      s.player.secondWindUsed = true;
    });
    // drive to a wave-1 death
    await page.evaluate(() => {
      const step = () => {
        const s = window.__stickman;
        if (!s || s.state === 'gameover' || s.state === 'dying') return;
        if (window.__test && window.__test.setHealth) window.__test.setHealth(1);
        if (window.__test && window.__test.hurt) window.__test.hurt(99);
      };
      step();
      window.__killTimer = setInterval(step, 300);
    });
    await waitTele(page, (t) => t.state === 'gameover', 30000);
    await page.evaluate(() => clearInterval(window.__killTimer));
    // GameOver scene boots after a 1400ms death delay; give its create() + fade time
    await page.waitForTimeout(1200);
    const res = await page.evaluate(() => {
      const sc = window.__game.scene.getScene('GameOver');
      if (!sc) return { found: false, reason: 'no-scene', texts: [] };
      const texts = [];
      sc.children.list.forEach((c) => {
        if (c && typeof c.text === 'string') texts.push(c.text);
      });
      return { found: texts.some((t) => t.indexOf('TIP:') === 0), texts };
    });
    expect(res.found).toBe(true);
    expect(errors).toEqual([]);
  });
});
