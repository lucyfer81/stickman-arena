const { test, expect } = require('@playwright/test');

const collectErrors = (page) => {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
  return errors;
};

const telemetry = (page) => page.evaluate(() => window.__stickman || null);
const playerState = (page) => page.evaluate(() => window.__test && window.__test.playerState && window.__test.playerState());
const waitTele = async (page, predicate, timeout = 20000, interval = 120) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const t = await telemetry(page);
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
};
const waitForIdle = async (page) => {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    const s = await playerState(page);
    if (s && s.state === 'idle' && s.attackType === null) return true;
    await page.waitForTimeout(40);
  }
  return false;
};
// sample the kick's resolved `total` once it's into its recover window. The
// whiff extension switches total from 0.46 -> 0.62 at ~t=0.20; we capture the
// total at the deepest observed point of the swing. Deterministic (no wall clock).
const sampleKickTotalInRecover = async (page) => {
  let best = null; // { t, total }
  const deadline = Date.now() + 2800;
  while (Date.now() < deadline) {
    const s = await playerState(page);
    if (s && s.attackType === 'kick' && s.t !== null && s.total !== null) {
      // past the active window (windup 0.08 + active 0.12 = 0.20) => recover,
      // where the whiff extension has already been applied (if it will be).
      if (s.t > 0.20 && (!best || s.t > best.t)) best = { t: s.t, total: s.total };
      // once we've seen a solid recover sample, we can stop early
      if (best && s.t > 0.30) return best.total;
    }
    await page.waitForTimeout(15);
  }
  return best ? best.total : null;
};

test.describe('Combat depth: punch vs kick role split', () => {
  test('punch does 11 damage (no longer strictly dominated by kick)', async ({ page }) => {
    test.setTimeout(60000);
    const errors = collectErrors(page);
    await startGame(page);
    await page.waitForTimeout(600);
    await page.evaluate(() => window.__test.clearEnemies());
    const hp0 = await page.evaluate(() => window.__test.spawnDummy(60));
    expect(await waitForIdle(page), 'player should be idle to start').toBe(true);

    await page.keyboard.press('J'); // punch
    let hp1 = null;
    const deadline = Date.now() + 2500;
    while (Date.now() < deadline) {
      hp1 = await page.evaluate(() => window.__test.firstEnemyHp());
      if (hp1 !== null && hp1 < hp0) break;
      await page.waitForTimeout(30);
    }
    expect(hp1, 'punch should land on the dummy').not.toBeNull();
    expect(hp0 - hp1).toBe(11); // CONFIG.PLAYER.PUNCH.DAMAGE
    expect(errors).toEqual([]);
  });

  test('a missed kick uses a longer recover than a connecting kick (whiff punishable)', async ({ page }) => {
    test.setTimeout(60000);
    const errors = collectErrors(page);
    await startGame(page);
    await page.waitForTimeout(600);

    // WHIFF: no target -> the kick's recover extends (total grows).
    await page.evaluate(() => window.__test.clearEnemies());
    expect(await waitForIdle(page), 'player idle before whiff kick').toBe(true);
    await page.keyboard.press('K');
    const whiffTotal = await sampleKickTotalInRecover(page);
    expect(whiffTotal, 'whiff kick should reach its recover window').not.toBeNull();
    // whiff total = windup 0.08 + active 0.12 + RECOVER_WHIFF 0.42 = 0.62

    // CONNECT: a passive dummy in range (won't swing back -> won't interrupt the
    // kick) -> the kick lands and its recover stays normal (total smaller).
    await page.evaluate(() => window.__test.clearEnemies());
    await page.evaluate(() => window.__test.spawnDummy(60, true));
    expect(await waitForIdle(page), 'player idle before connecting kick').toBe(true);
    await page.keyboard.press('K');
    const connTotal = await sampleKickTotalInRecover(page);
    expect(connTotal, 'connecting kick should reach its recover window').not.toBeNull();

    // Whiff must be materially longer than connect (0.62 vs 0.46 = +0.16s endlag).
    expect(whiffTotal).toBeGreaterThan(connTotal + 0.1);
    expect(errors).toEqual([]);
  });

  test('punch cancels into kick within the swing (combo rhythm, input not dropped)', async ({ page }) => {
    test.setTimeout(60000);
    const errors = collectErrors(page);
    await startGame(page);
    await page.waitForTimeout(600);
    await page.evaluate(() => window.__test.clearEnemies());
    expect(await waitForIdle(page), 'player idle before cancel combo').toBe(true);

    // Press J then K — the punch should cancel into a kick. (Old code dropped
    // the K mid-punch, so no kick ever started.)
    await page.keyboard.press('J');
    await page.waitForTimeout(60);
    await page.keyboard.press('K');
    let kickSeen = false;
    const deadline = Date.now() + 600;
    while (Date.now() < deadline) {
      const s = await playerState(page);
      if (s && s.attackType === 'kick') { kickSeen = true; break; }
      await page.waitForTimeout(20);
    }
    expect(kickSeen, 'punch should cancel into a kick within the swing window').toBe(true);
    expect(errors).toEqual([]);
  });
});
