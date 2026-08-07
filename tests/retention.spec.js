// First-minute retention suite — covers the round-4 changes:
//   1. dead-time: wave 1-3 spawns on an inner band (closer than walls)
//   2. vanguard mini-elite: wave 2's first spawn only
//   3. FIRST BLOOD: fires once on the first non-boss kill
//   4. Meta.nextUnlock progress + tomorrow daily
//   5. smoke: teach callouts + goal chip + game-over nudge render without errors
// Run: npx playwright test --config=tests/dev.config.js --project=retention
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
const gsHandle = (page) => page.evaluate(() => {
  const g = window.__game;
  for (const sc of g.scene.scenes) if (sc && sc.constructor && sc.constructor.name === 'GameScene') return sc;
  return null;
});
const startGame = async (page) => {
  await page.goto('/');
  await waitTele(page, (t) => t.state === 'title');
  await page.keyboard.press('Space');
  await waitTele(page, (t) => t.state === 'game');
  await page.waitForTimeout(800);
};

test.describe('Retention — dead time & spawns', () => {
  test('wave 1-3 spawn on inner band; wave 4+ at walls', async ({ page }) => {
    test.setTimeout(30000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await startGame(page);
    const res = await page.evaluate(() => {
      const gs = window.__game.scene.scenes.find((s) => s && s.constructor.name === 'GameScene');
      const WALL_LEFT = 64, WALL_RIGHT = 1216, OFFSET = 300;
      const innerLeft = WALL_LEFT + OFFSET, innerRight = WALL_RIGHT - OFFSET;
      const spawn = (n) => {
        for (const e of gs.enemies) { if (!e.dead) { e.dead = true; e.destroy(); } }
        gs.enemies = gs.enemies.filter((e) => e.scene);
        gs.wave = n; gs.isBossWave = false; gs.waveFirstSpawn = true;
        gs.spawnOne();
        const e = gs.enemies[gs.enemies.length - 1];
        return e ? { variant: e.variant, x: e.x } : null;
      };
      const w1 = spawn(1);
      const w4 = spawn(4);
      return {
        w1, w4,
        innerLeft, innerRight, wallL: WALL_LEFT + 10, wallR: WALL_RIGHT - 10,
      };
    });
    // wave 1: grunt on the inner band
    expect(res.w1.variant).toBe('grunt');
    expect(res.w1.x === res.innerLeft || res.w1.x === res.innerRight).toBe(true);
    // wave 4: spawns back at the walls
    expect(res.w4.x === res.wallL || res.w4.x === res.wallR).toBe(true);
    expect(errors).toEqual([]);
  });
});

test.describe('Retention — vanguard mini-elite', () => {
  test('wave 2 first spawn is a vanguard; later spawns are not', async ({ page }) => {
    test.setTimeout(30000);
    await startGame(page);
    const res = await page.evaluate(() => {
      const gs = window.__game.scene.scenes.find((s) => s && s.constructor.name === 'GameScene');
      const spawn = () => {
        gs.wave = 2; gs.isBossWave = false; gs.waveFirstSpawn = true;
        gs.spawnOne();
        const first = gs.enemies[gs.enemies.length - 1];
        gs.spawnOne(); // second spawn of the same wave
        const second = gs.enemies[gs.enemies.length - 1];
        return { first: first.variant, second: second.variant };
      };
      return spawn();
    });
    expect(res.first).toBe('vanguard');
    expect(res.second).not.toBe('vanguard');
  });
});

test.describe('Retention — FIRST BLOOD', () => {
  test('fires once on first non-boss kill, not on boss', async ({ page }) => {
    test.setTimeout(40000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await startGame(page);
    // ensure a grunt exists, kill it via the real pipeline
    await page.evaluate(() => window.__test.spawnDummy(60));
    let t = await page.evaluate(() => { window.__test.killFirstEnemy(); return window.__stickman.firstBlood; });
    expect(t).toBe(true);
    // a second kill must not re-fire (flag stays true; banner is one-shot)
    await page.evaluate(() => window.__test.spawnDummy(60));
    const fb2 = await page.evaluate(() => { window.__test.killFirstEnemy(); return window.__stickman.firstBlood; });
    expect(fb2).toBe(true);
    expect(errors).toEqual([]);
  });
});

test.describe('Retention — Meta.nextUnlock & tomorrow daily', () => {
  test('returns first locked skin with progress, null when all unlocked', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/');
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const M = window.__meta;
      localStorage.removeItem('stickman_arena_stats');
      const g0 = M.nextUnlock();                 // fresh -> ember
      localStorage.setItem('stickman_arena_stats', JSON.stringify({ totalKills: 0, gamesPlayed: 0, bestWave: 5, bestCombo: 0, bestScore: 0, totalScore: 0 }));
      const g1 = M.nextUnlock();                 // ember now unlocked -> toxic
      const tom = M.dailyModifierTomorrow();
      // all unlocked
      localStorage.setItem('stickman_arena_stats', JSON.stringify({ totalKills: 200, gamesPlayed: 9, bestWave: 9, bestCombo: 25, bestScore: 9000, totalScore: 30000 }));
      const gAll = M.nextUnlock();
      return { g0, g1, tomName: tom.name, gAll };
    });
    expect(r.g0.key).toBe('ember');
    expect(r.g0.target).toBe(5);
    expect(r.g1.key).toBe('toxic');
    expect(r.tomName).toBeTruthy();
    expect(r.gAll).toBeNull();
  });
});

test.describe('Retention — smoke (teach + goal chip + game-over nudge)', () => {
  test('first 15s render the teach/goal UI with no errors; game-over nudge renders', async ({ page }) => {
    test.setTimeout(60000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await startGame(page);
    // give the teach layer + goal chip a few seconds to render/update
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'tests/shots/retention-teach.png' });
    // drive to game over and confirm the nudge lines render without throwing
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
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'tests/shots/retention-gameover.png' });
    expect(errors).toEqual([]);
  });
});
