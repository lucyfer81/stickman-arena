// Options menu + rebindable controls + shake toggle (Round 3 review-driven fix).
// Covers the data layer (Options module), the UI flow (open/rebind/close), and
// the in-game effect of a rebind. Drives the real capture path + the real
// combat pipeline so the rebind is proven to reach `_setupKeyboard`.
//
// Run: npx playwright test --config=tests/dev.config.js --project=options
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
const optionsState = (page) => page.evaluate(() => window.__options || null);
const waitOptions = async (page, predicate, timeout = 8000, interval = 100) => {
  const dl = Date.now() + timeout;
  while (Date.now() < dl) {
    const o = await optionsState(page);
    if (o && predicate(o)) return o;
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
  await page.waitForTimeout(600);
};

test.describe('Options: rebindable controls + shake toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // start from a clean options state every time
    await page.evaluate(() => {
      localStorage.removeItem('stickman_arena_options');
      window.__options_module && window.__options_module.resetBindings && window.__options_module.resetBindings();
    });
  });

  test('defaults reproduce the original layout (zero-regression guard)', async ({ page }) => {
    test.setTimeout(20000);
    const errors = collectErrors(page);
    await waitTele(page, (t) => t.state === 'title');
    const b = await page.evaluate(() => window.__options_module.bindings());
    expect(b).toEqual({ left: 'A', right: 'D', jump: 'W', punch: 'J', kick: 'K', burst: 'L', spare: 'H' });
    expect(await page.evaluate(() => window.__options_module.shakeMode())).toBe('full');
    expect(errors).toEqual([]);
  });

  test('options overlay opens from the title (O key) and does not start the game', async ({ page }) => {
    test.setTimeout(30000);
    const errors = collectErrors(page);
    await waitTele(page, (t) => t.state === 'title');
    // pressing O opens the overlay
    await page.keyboard.press('KeyO');
    const open = await waitOptions(page, (o) => o.open === true);
    expect(open, 'options overlay should report open').not.toBeNull();
    // game must still be on the title (O didn't start a run)
    const t = await tele(page);
    expect(t.state).toBe('title');
    // SPACE while options are open must NOT start the game
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    const t2 = await tele(page);
    expect(t2.state).toBe('title');
    expect(errors).toEqual([]);
  });

  test('rebind via the real capture UI: click PUNCH row, press U, binding updates', async ({ page }) => {
    test.setTimeout(30000);
    const errors = collectErrors(page);
    await waitTele(page, (t) => t.state === 'title');
    await page.keyboard.press('KeyO');
    await waitOptions(page, (o) => o.open === true);
    // PUNCH is action index 3 -> row centre at (cx=640, y=196+3*44=328)
    await page.mouse.move(640, 328);
    await page.mouse.click(640, 328);
    const capturing = await waitOptions(page, (o) => o.capturing === 'punch');
    expect(capturing, 'should enter capture mode for punch').not.toBeNull();
    // press the new key
    await page.keyboard.press('KeyU');
    const bound = await waitOptions(page, (o) => !o.capturing && o.bindings.punch === 'U');
    expect(bound, 'punch should be rebound to U').not.toBeNull();
    // persisted to localStorage
    const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('stickman_arena_options') || '{}'));
    expect(persisted.bindings && persisted.bindings.punch).toBe('U');
    expect(errors).toEqual([]);
  });

  test('ESC closes the options overlay (and frees the game to start again)', async ({ page }) => {
    test.setTimeout(30000);
    const errors = collectErrors(page);
    await waitTele(page, (t) => t.state === 'title');
    await page.keyboard.press('KeyO');
    await waitOptions(page, (o) => o.open === true);
    await page.keyboard.press('Escape');
    const closed = await waitOptions(page, (o) => o.open === false);
    expect(closed, 'options should report closed after ESC').not.toBeNull();
    // now SPACE starts the game (guard released)
    await page.keyboard.press('Space');
    const t = await waitTele(page, (tt) => tt.state === 'game');
    expect(t, 'game should start after options closed').not.toBeNull();
    expect(errors).toEqual([]);
  });

  test('rebound key takes effect in the real combat pipeline (press U punches, J no longer does)', async ({ page }) => {
    test.setTimeout(60000);
    const errors = collectErrors(page);
    await waitTele(page, (t) => t.state === 'title');
    // rebind punch J -> U via the data layer (GameScene reads this in _setupKeyboard)
    await page.evaluate(() => window.__options_module.setBinding('punch', 'U'));
    await page.keyboard.press('Space');
    await waitTele(page, (t) => t.state === 'game' && t.wave >= 1);
    await page.waitForTimeout(600);
    await page.evaluate(() => window.__test.clearEnemies());
    const hp0 = await page.evaluate(() => window.__test.spawnDummy(60));

    // NEW key (U) should now throw a punch and land (11 dmg = CONFIG.PLAYER.PUNCH.DAMAGE)
    await page.keyboard.press('KeyU');
    let hpU = null;
    const dl1 = Date.now() + 2500;
    while (Date.now() < dl1) {
      hpU = await page.evaluate(() => window.__test.firstEnemyHp());
      if (hpU !== null && hpU < hp0) break;
      await page.waitForTimeout(30);
    }
    expect(hpU, 'punch (U) should land').not.toBeNull();
    expect(hp0 - hpU).toBe(11);

    // OLD key (J) is no longer bound to anything -> must NOT punch. Use the
    // real combat hook (killFirstEnemy fires _onPlayerHit only on a real hit):
    // a J press must not change enemy HP. (We re-spawn a fresh dummy so the
    // punch-loop from the harness's repeated keydowns can't mask the result.)
    await page.evaluate(() => window.__test.clearEnemies());
    const hpJ0 = await page.evaluate(() => window.__test.spawnDummy(-60));
    await page.keyboard.press('KeyJ');
    await page.waitForTimeout(500);
    const hpJ1 = await page.evaluate(() => window.__test.firstEnemyHp());
    expect(hpJ1, 'freed key J must not damage the enemy').toBe(hpJ0);
    expect(errors).toEqual([]);
  });

  test('fixed alternate keys survive a rebind (SPACE still jumps, arrows still move)', async ({ page }) => {
    test.setTimeout(40000);
    const errors = collectErrors(page);
    await waitTele(page, (t) => t.state === 'title');
    // rebind punch (irrelevant to movement/jump, but proves a rebind happened)
    await page.evaluate(() => window.__options_module.setBinding('punch', 'U'));
    await page.keyboard.press('Space');
    await waitTele(page, (t) => t.state === 'game' && t.wave >= 1);
    await page.waitForTimeout(600);
    await page.evaluate(() => window.__test.clearEnemies()); // no enemies -> no combat lock
    await page.waitForTimeout(400);
    const ground = await page.evaluate(() => window.__game.scene.getScene('Game').player.y);

    // SPACE (fixed alternate jump) — hold and poll for a rise
    await page.keyboard.down('Space');
    let y = ground;
    const jdl = Date.now() + 900;
    while (Date.now() < jdl) {
      y = await page.evaluate(() => window.__game.scene.getScene('Game').player.y);
      if (y < ground - 4) break;
      await page.waitForTimeout(30);
    }
    await page.keyboard.up('Space');
    expect(y, 'SPACE still jumps after rebind (fixed alternate intact)').toBeLessThan(ground - 4);

    // LEFT arrow (fixed alternate move) — wait for landing, then hold LEFT and
    // confirm the player's x decreases.
    await page.waitForTimeout(500); // let any jump land
    const x0 = await page.evaluate(() => window.__game.scene.getScene('Game').player.x);
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(450);
    const x1 = await page.evaluate(() => window.__game.scene.getScene('Game').player.x);
    await page.keyboard.up('ArrowLeft');
    expect(x1, 'LEFT arrow still moves the player left after rebind').toBeLessThan(x0);
    expect(errors).toEqual([]);
  });

  test('shake toggle scales the impulse shake (full / reduced / off)', async ({ page }) => {
    test.setTimeout(40000);
    const errors = collectErrors(page);
    await startGame(page);

    const shake = (amp) => page.evaluate((a) => {
      const s = window.__game.scene.getScene('Game');
      s.shakeAmp = 0; s.shakeT = 0;
      s._shake(a, 0.25, 30, 0, 0);
      return s.shakeAmp;
    }, amp);

    // FULL: amplitude passes through unchanged
    await page.evaluate(() => window.__options_module.setShakeMode('full'));
    expect(await shake(5)).toBeCloseTo(5, 5);
    // REDUCED: 40% amplitude (2.0), still above the 0.25 cutoff
    await page.evaluate(() => window.__options_module.setShakeMode('reduced'));
    expect(await shake(5)).toBeCloseTo(2.0, 5);
    // OFF: no shake at all (short-circuited, stays 0)
    await page.evaluate(() => window.__options_module.setShakeMode('off'));
    expect(await shake(5)).toBe(0);
    // persistence
    const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('stickman_arena_options') || '{}'));
    expect(persisted.shakeMode).toBe('off');
    expect(errors).toEqual([]);
  });

  test('duplicate bind swaps the keys (no two actions ever share a key)', async ({ page }) => {
    test.setTimeout(20000);
    const errors = collectErrors(page);
    await waitTele(page, (t) => t.state === 'title');
    // bind punch to K (which is currently kick) -> kick should take punch's old key
    const ok = await page.evaluate(() => window.__options_module.setBinding('punch', 'K'));
    expect(ok).toBe(true);
    const b = await page.evaluate(() => window.__options_module.bindings());
    expect(b.punch).toBe('K');
    expect(b.kick).toBe('J'); // swapped, not orphaned
    // invariant: every primary binding is unique
    const vals = Object.values(b);
    expect(new Set(vals).size).toBe(vals.length);
    expect(errors).toEqual([]);
  });

  test('reset restores the default bindings', async ({ page }) => {
    test.setTimeout(20000);
    const errors = collectErrors(page);
    await waitTele(page, (t) => t.state === 'title');
    await page.evaluate(() => {
      window.__options_module.setBinding('punch', 'U');
      window.__options_module.setBinding('jump', 'P');
    });
    await page.evaluate(() => window.__options_module.resetBindings());
    const b = await page.evaluate(() => window.__options_module.bindings());
    expect(b).toEqual({ left: 'A', right: 'D', jump: 'W', punch: 'J', kick: 'K', burst: 'L', spare: 'H' });
    expect(errors).toEqual([]);
  });

  test('options reachable from a paused run (mid-session rebind)', async ({ page }) => {
    test.setTimeout(50000);
    const errors = collectErrors(page);
    await startGame(page);
    // pause via ESC, then open options from the pause overlay's OPTIONS button
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const paused = await page.evaluate(() => window.__game.scene.getScene('Game').paused);
    expect(paused).toBe(true);
    // the OPTIONS button sits in the pause overlay at container centre + (0, 92)
    // container is at (640, 360) => button centre ~ (640, 452)
    await page.mouse.click(640, 452);
    const open = await waitOptions(page, (o) => o.open === true && o.from === 'game');
    expect(open, 'options should open from the pause overlay').not.toBeNull();
    // game stays paused underneath
    const stillPaused = await page.evaluate(() => window.__game.scene.getScene('Game').paused);
    expect(stillPaused).toBe(true);
    // closing options returns to the (still paused) game
    await page.keyboard.press('Escape');
    await waitOptions(page, (o) => o.open === false);
    await page.waitForTimeout(200);
    const pausedAfter = await page.evaluate(() => window.__game.scene.getScene('Game').paused);
    expect(pausedAfter, 'closing options must not auto-resume the run').toBe(true);
    expect(errors).toEqual([]);
  });
});
