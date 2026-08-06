// QA regression suite — covers bugs found and fixed in the QA pass.
// Run via: npx playwright test --config=tests/dev.config.js --project=qa
const { test, expect } = require('@playwright/test');

const tele = (page) => page.evaluate(() => window.__stickman || null);
const waitTele = async (page, predicate, timeout = 30000, interval = 120) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
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
  await waitTele(page, (t) => t.state === 'game');
  await page.waitForTimeout(1500);
};

// reach the Game scene instance via the exposed game handle
const gameScene = (page) => page.evaluate(() => {
  const game = window.__game;
  if (!game) return null;
  for (const sc of game.scene.scenes) if (sc && sc.constructor && sc.constructor.name === 'GameScene') return true;
  return null;
});

test.describe('QA regression', () => {

  test('corpses animate + are destroyed (no frozen Graphics leak)', async ({ page }) => {
    test.setTimeout(90000);
    await startGame(page);
    // fast-forward ~7 waves by force-killing spawns
    const ffDeadline = Date.now() + 55000;
    while (Date.now() < ffDeadline) {
      await page.evaluate(() => window.__test && window.__test.killEnemies && window.__test.killEnemies());
      await page.waitForTimeout(110);
      const t = await tele(page);
      if (t && t.wave >= 7) break;
    }
    await page.waitForTimeout(900); // let death tweens finish + destroy()
    const stats = await page.evaluate(() => {
      const game = window.__game;
      let arrayLen = 0, orphans = 0;
      const arrayIds = new Set();
      for (const sc of game.scene.scenes) if (sc && sc.enemies) for (const e of sc.enemies) arrayIds.add(e);
      for (const sc of game.scene.scenes) {
        if (!sc || !sc.children) continue;
        if (sc.enemies) arrayLen = sc.enemies.length;
        sc.children.each((c) => {
          if (c && c.constructor && /Enemy/.test(c.constructor.name) && !arrayIds.has(c)) orphans++;
          return true;
        });
      }
      return { arrayLen, orphans };
    });
    // a handful of corpses may still be mid-tween, but none should be orphaned
    // (in the display list yet removed from the enemies array).
    expect(stats.orphans).toBe(0);
  });

  test('on-screen pause button toggles pause and freezes the sim', async ({ page }) => {
    test.setTimeout(40000);
    await startGame(page);
    const overlayVisible = () => page.evaluate(() => {
      const game = window.__game;
      for (const sc of game.scene.scenes) if (sc && sc.pauseOverlay) return sc.pauseOverlay.visible;
      return null;
    });
    const playerX = () => page.evaluate(() => {
      const game = window.__game;
      for (const sc of game.scene.scenes) if (sc && sc.player) return sc.player.x;
      return null;
    });
    expect(await overlayVisible()).toBe(false);
    // pause button sits at game coords (350, 35) — desktop viewport is 1:1 with 1280x720
    await page.mouse.click(350, 35);
    await page.waitForTimeout(150);
    expect(await overlayVisible()).toBe(true);
    const x1 = await playerX();
    await page.waitForTimeout(450);
    const x2 = await playerX();
    expect(x1).toBe(x2); // frozen while paused
    // resume
    await page.mouse.click(350, 35);
    await page.waitForTimeout(150);
    expect(await overlayVisible()).toBe(false);
  });

  test('ESC pause still works (keyboard regression)', async ({ page }) => {
    test.setTimeout(40000);
    await startGame(page);
    const overlayVisible = () => page.evaluate(() => {
      const game = window.__game;
      for (const sc of game.scene.scenes) if (sc && sc.pauseOverlay) return sc.pauseOverlay.visible;
      return null;
    });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    expect(await overlayVisible()).toBe(true);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    expect(await overlayVisible()).toBe(false);
  });

  test('combo tier bonus honors scoreMul (daily modifiers)', async ({ page }) => {
    test.setTimeout(30000);
    await startGame(page);
    // white-box: drive _checkComboTier at combo=5 under a forced scoreMul and
    // verify the score delta == COMBO_TIER_BONUS * scoreMul.
    const result = await page.evaluate(() => {
      const game = window.__game;
      let gs = null;
      for (const sc of game.scene.scenes) if (sc && sc.constructor && sc.constructor.name === 'GameScene') gs = sc;
      if (!gs) return { err: 'no GameScene' };
      const bonus = gs.game.registry.cache || 0;
      const before = gs.score;
      gs.combo = 5;
      gs.mods.scoreMul = 2.0;
      gs._checkComboTier();
      const after = gs.score;
      return { before, after, delta: after - before, tierBonuses: gs.tierBonuses };
    });
    expect(result.err).toBeUndefined();
    // CONFIG.COMBO_TIER_BONUS === 100; with scoreMul 2.0 the grant is 200.
    expect(result.delta).toBe(200);
    expect(result.tierBonuses).toBeGreaterThanOrEqual(1);
  });

  test('enemies spread out (no perfect overlap among living)', async ({ page }) => {
    test.setTimeout(60000);
    await startGame(page);
    // fast-forward to a wave with a fuller pack, letting AI settle
    const ffDeadline = Date.now() + 25000;
    while (Date.now() < ffDeadline) {
      const t = await tele(page);
      if (t && t.enemiesAlive >= 3) break;
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(1200); // let separation steering settle
    const minPairDist = await page.evaluate(() => {
      const game = window.__game;
      let arr = null;
      for (const sc of game.scene.scenes) if (sc && sc.enemies) arr = sc.enemies.filter((e) => !e.dead);
      if (!arr || arr.length < 2) return 9999;
      let best = 1e9;
      for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
        best = Math.min(best, Math.abs(arr[i].x - arr[j].x));
      }
      return best;
    });
    // living enemies should keep at least a little horizontal separation rather
    // than stacking on the exact same X (the old behavior).
    expect(minPairDist).toBeGreaterThan(8);
  });

  test('AudioManager teardown cancels pending sequence timers', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/');
    await waitTele(page, (t) => t.state === 'title');
    const counts = await page.evaluate(() => {
      const a = window.__audio;
      // kick off a multi-note sequence, then destroy immediately
      a.wave(5);
      a.gameover();
      const before = a._timers.size;
      a.destroy();
      const after = a._timers.size;
      return { before, after };
    });
    expect(counts.before).toBeGreaterThan(0);
    expect(counts.after).toBe(0);
  });
});
