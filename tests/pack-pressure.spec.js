const { test, expect } = require('@playwright/test');

// Round 10 backlog #4: pack pressure. A skilled player could stunlock a single
// file of enemies and never lose. Now, once SWARM_THRESHOLD enemies are alive
// (wave >= MIN_WAVE), each adds aggression + speed (capped) — rewarding fast
// clears and punishing passive play, without touching 1-2-enemy fights.

const startGame = async (page) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__stickman && window.__stickman.state === 'title', null, { timeout: 15000 });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__stickman && window.__stickman.state === 'game' && window.__stickman.wave >= 1, null, { timeout: 15000 });
};

// set up a crowd at a given wave, let one update tick write swarmMul, then read it.
const swarmStateAt = async (page, wave, count) => {
  await page.evaluate(({ wave, count }) => {
    const s = window.__game.scene.getScene('Game');
    window.__test.clearEnemies();
    s.wave = wave;
    s.waveActive = true;   // hold the wave so it doesn't advance during the read
    s.spawnQueue = 0;
    for (let i = 0; i < count; i++) window.__test.spawnVariant('grunt', 80 + i * 40);
  }, { wave, count });
  await page.waitForTimeout(220); // let GameScene.update write swarmMul
  return page.evaluate(() => {
    const s = window.__game.scene.getScene('Game');
    const e = s.enemies[0];
    return { aggr: e ? e.swarmMul : null, speed: e ? e.swarmSpeedMul : null, alive: s.enemies.filter((x) => !x.dead).length };
  });
};

test.describe('Pack pressure (crowd escalation)', () => {
  test('a small fight (<=2) has no swarm bonus at any wave', async ({ page }) => {
    test.setTimeout(60000);
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
    await startGame(page);
    const r = await swarmStateAt(page, 5, 2);
    expect(r.aggr).toBe(1);
    expect(r.speed).toBe(1);
    expect(errors).toEqual([]);
  });

  test('a crowd (>= threshold) escalates aggression + speed past the gate wave', async ({ page }) => {
    test.setTimeout(60000);
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
    await startGame(page);
    const r = await swarmStateAt(page, 5, 6); // full crowd, wave 5
    expect(r.alive).toBeGreaterThanOrEqual(5);
    expect(r.aggr).toBeGreaterThan(1);
    expect(r.speed).toBeGreaterThan(1);
    // aggression scales faster than speed (AGGR_PER > SPEED_PER)
    expect(r.aggr).toBeGreaterThan(r.speed);
    expect(errors).toEqual([]);
  });

  test('the opening waves (wave < MIN_WAVE) are exempt even with a crowd', async ({ page }) => {
    test.setTimeout(60000);
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
    await startGame(page);
    const r = await swarmStateAt(page, 2, 5); // crowd, but wave 2 (< MIN_WAVE 3)
    expect(r.aggr).toBe(1);
    expect(r.speed).toBe(1);
    expect(errors).toEqual([]);
  });
});
