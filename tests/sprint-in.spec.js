const { test, expect } = require('@playwright/test');

// Round 10 backlog #5: dead-time fix. Wave-4+ enemies spawn at the walls and
// had a ~3.8s walk to mid (a dead gap). They now get a brief entrance "sprint"
// (2x approach speed for 0.6s) so the action stays dense past the early game.

const startGame = async (page) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__stickman && window.__stickman.state === 'title', null, { timeout: 15000 });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__stickman && window.__stickman.state === 'game' && window.__stickman.wave >= 1, null, { timeout: 15000 });
};

const WALL_LEFT = 64, WALL_RIGHT = 1216;

test.describe('Dead-time fix (entrance sprint)', () => {
  test('a wave-4 wall spawn arms the entrance sprint', async ({ page }) => {
    test.setTimeout(60000);
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
    await startGame(page);

    const r = await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      window.__test.clearEnemies();
      s.wave = 4;            // wall-spawn wave (past INNER_SPAWN_WAVES)
      s.spawnOne();
      const e = s.enemies[s.enemies.length - 1];
      return { sprintT: e.sprintT, x: e.x, nearWall: e.x < 120 || e.x > 1100 };
    });
    expect(r.sprintT).toBeGreaterThan(0);
    expect(r.nearWall).toBe(true);
    expect(errors).toEqual([]);
  });

  test('an early-wave inner-band spawn does NOT sprint', async ({ page }) => {
    test.setTimeout(60000);
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
    await startGame(page);

    const r = await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      window.__test.clearEnemies();
      s.wave = 3;            // inner-band wave (<= INNER_SPAWN_WAVES)
      s.spawnOne();
      const e = s.enemies[s.enemies.length - 1];
      return { sprintT: e.sprintT };
    });
    expect(r.sprintT).toBe(0);
    expect(errors).toEqual([]);
  });

  test('a sprinting enemy closes faster than its base speed allows', async ({ page }) => {
    test.setTimeout(60000);
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
    await startGame(page);

    // spawn a wall grunt at wave 4 (sprint armed). Poll its horizontal speed
    // during the sprint window — it must exceed the unit's base top speed.
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('Game');
      window.__test.clearEnemies();
      s.wave = 4;
      s.spawnOne();
    });
    let exceeded = false;
    const deadline = Date.now() + 2500;
    while (Date.now() < deadline) {
      const st = await page.evaluate(() => {
        const s = window.__game.scene.getScene('Game');
        const e = s.enemies[s.enemies.length - 1];
        if (!e) return null;
        // base top speed for a grunt at this wave, no sprint
        const base = e.v.speed * e.speedMul;
        return { vx: Math.abs(e.vx), base, sprintT: e.sprintT };
      });
      if (st && st.sprintT > 0 && st.vx > st.base * 1.4) { exceeded = true; break; }
      await page.waitForTimeout(60);
    }
    expect(exceeded).toBe(true);
    expect(errors).toEqual([]);
  });
});
