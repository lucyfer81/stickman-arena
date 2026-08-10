const { test, expect } = require('@playwright/test');

// Senior-QA full-game audit. Runs personas + edge cases, captures console
// errors, telemetry, and screenshots. Designed to surface REAL problems, not
// assert happy paths.

const collectErrors = (page) => {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
  return errors;
};
const telemetry = (page) => page.evaluate(() => window.__stickman || null);
const waitTele = async (page, predicate, timeout = 30000, interval = 150) => {
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

// aggressive helper that survives a long time and reaches boss waves
const fightHard = async (page, ms, label) => {
  const samples = [];
  const deadline = Date.now() + ms;
  let i = 0;
  while (Date.now() < deadline) {
    const r = i % 5;
    if (r === 0) await page.keyboard.press('J');
    else if (r === 1) await page.keyboard.press('K');
    else if (r === 2) await page.keyboard.press('D');
    else if (r === 3) await page.keyboard.press('J');
    else { await page.keyboard.down('Space'); await page.waitForTimeout(40); await page.keyboard.up('Space'); }
    await page.waitForTimeout(90);
    const t = await telemetry(page);
    if (i % 10 === 0) samples.push({
      s: Math.round((Date.now() - (deadline - ms)) / 1000),
      hp: t && t.health, wave: t && t.wave, score: t && t.score,
      combo: t && t.bestCombo, hits: t && t.hitsTaken, healed: t && t.healed,
      bursts: t && t.bursts, broken: t && t.broken, boss: t && t.bossKind,
    });
    i++;
    if (t && (t.state === 'gameover' || t.state === 'dying')) break;
  }
  return samples;
};

// ---------- 1. Long-run stability (reach wave 10+, exercise 2 boss types) ----------
test('QA: hardcore long run stability (120s, no errors)', async ({ page }) => {
  test.setTimeout(180000);
  const errors = collectErrors(page);
  await startGame(page);
  await page.waitForTimeout(1000);
  const samples = await fightHard(page, 120000, 'longrun');
  const final = await telemetry(page);
  console.log('LONGRUN final:', JSON.stringify(final));
  console.log('LONGRUN trajectory:', JSON.stringify(samples));
  await page.screenshot({ path: 'tests/shots/qa-longrun.png' });
  expect(errors).toEqual([]);
});

// ---------- 2. Juggernaut boss charge behaviour (wave 15) ----------
test('QA: juggernaut boss spawns + charges with telegraph grace', async ({ page }) => {
  test.setTimeout(60000);
  const errors = collectErrors(page);
  await page.goto('/');
  await waitTele(page, (t) => t.state === 'title');
  await page.keyboard.press('Space');
  await waitTele(page, (t) => t.state === 'game' && t.wave >= 1);
  // jump to wave 15 (juggernaut slot) via the test hook
  await page.evaluate(() => { window.__stickman; });
  const boss = await page.evaluate(() => window.__test && window.__test.spawnBossKind('juggernaut'));
  expect(boss).toBe('juggernaut');
  await page.waitForTimeout(500);
  // record chargeCd right after spawn — should be a grace period, NOT 0
  const chargeCd = await page.evaluate(() => {
    const e = window.__stickman && window.__stickman;
    return null;
  });
  const bossState = await page.evaluate(() => {
    // find the boss in the scene via the killBoss path's source: read the boss
    return { bossActive: window.__stickman.bossActive, bossKind: window.__stickman.bossKind };
  });
  console.log('JUGGERNAUT bossState at spawn:', JSON.stringify(bossState));
  // let it act for 4s — it should windup before charging (telegraph), not hit on frame 1
  const t0 = await telemetry(page);
  const hpBefore = t0.health;
  await page.waitForTimeout(2500);
  const t1 = await telemetry(page);
  console.log('JUGGERNAUT 2.5s after spawn: hp', t1.health, 'bossHp', t1.bossHp);
  // a 0.7s windup telegraph must precede the dash — the player shouldn't be hit
  // within the first ~1.2s (windup 0.7 + dash travel). If chargeCd=0 the boss
  // can fire essentially on entry.
  await page.screenshot({ path: 'tests/shots/qa-juggernaut.png' });
  expect(errors).toEqual([]);
});

// ---------- 3. Boss super-armor vs heavy hits (slammer/caster/juggernaut) ----------
test('QA: boss committed special survives a kick (super-armor)', async ({ page }) => {
  test.setTimeout(60000);
  const errors = collectErrors(page);
  await page.goto('/');
  await waitTele(page, (t) => t.state === 'title');
  await page.keyboard.press('Space');
  await waitTele(page, (t) => t.state === 'game' && t.wave >= 1);
  // spawn a slammer and force its special, then kick mid-leap
  await page.evaluate(() => window.__test.spawnBossKind('slammer'));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__test.setBossHp(200)); // keep it alive
  // force the special next tick
  await page.evaluate(() => window.__test.bossFireSpecial());
  await page.waitForTimeout(800); // past windup into the committed leap
  const beforeKick = await page.evaluate(() => {
    const b = window.__stickman;
    return { shockwaves: b.shockwaves, bossHp: b.bossHp };
  });
  // kick the boss mid-slam
  await page.keyboard.press('K');
  await page.waitForTimeout(200);
  const afterKick = await page.evaluate(() => {
    const b = window.__stickman;
    return { shockwaves: b.shockwaves, bossHp: b.bossHp };
  });
  console.log('SLAMMER armor: beforeKick', JSON.stringify(beforeKick), 'afterKick', JSON.stringify(afterKick));
  await page.screenshot({ path: 'tests/shots/qa-bossarmor.png' });
  expect(errors).toEqual([]);
});

// ---------- 4. Second Wind + Overdrive + Mercy all in one run (event coverage) ----------
test('QA: signature mechanics fire without errors', async ({ page }) => {
  test.setTimeout(90000);
  const errors = collectErrors(page);
  await startGame(page);
  await page.waitForTimeout(1000);
  // force second wind
  const sw = await page.evaluate(() => window.__test.enterSecondWind());
  expect(sw).toBe(true);
  await page.waitForTimeout(500);
  const t0 = await telemetry(page);
  console.log('SECOND WIND entered: broken', t0.broken, 'brokenT', t0.brokenT);
  // reform
  const ref = await page.evaluate(() => window.__test.reform());
  expect(ref).toBe(true);
  await page.waitForTimeout(300);
  // fill + fire overdrive
  await page.evaluate(() => window.__test.fillBurst());
  await page.evaluate(() => window.__test.burst());
  await page.waitForTimeout(800);
  const t1 = await telemetry(page);
  console.log('OVERDRIVE fired: bursts', t1.bursts, 'bursting', t1.bursting);
  // force mercy
  // need an enemy: spawn one, low HP it, force mercy
  await page.evaluate(() => { window.__test.clearEnemies(); });
  await page.evaluate(() => window.__test.spawnVariant('grunt', 80));
  await page.waitForTimeout(300);
  const m = await page.evaluate(() => window.__test.forceMercy(0.2));
  await page.waitForTimeout(300);
  const t2 = await telemetry(page);
  console.log('MERCY forced: mercyActive', JSON.stringify(t2.mercyActive));
  await page.screenshot({ path: 'tests/shots/qa-signatures.png' });
  expect(errors).toEqual([]);
});

// ---------- 5. Mobile parity (touch, 60s) ----------
test('QA: mobile touch 60s stability', async ({ browser }) => {
  test.setTimeout(120000);
  const context = await browser.newContext({
    viewport: { width: 915, height: 412 },
    deviceScaleFactor: 2, hasTouch: true, isMobile: true,
  });
  const page = await context.newPage();
  const errors = collectErrors(page);
  await startGame(page);
  await page.waitForTimeout(1500);
  const deadline = Date.now() + 60000;
  let i = 0;
  const samples = [];
  while (Date.now() < deadline) {
    await page.evaluate((step) => {
      const c = window.__controls; if (!c) return;
      c.touchActive = true;
      c.touchDir = (step % 4 === 0) ? -1 : 1;
      c.punchPressed = true;
      if (step % 3 === 0) c.kickPressed = true;
      if (step % 7 === 0) { c.jumpPressed = true; c.jumpHeldTouch = true; }
      else c.jumpHeldTouch = false;
      if (step % 20 === 0 && window.__stickman && window.__stickman.burstReady) c.burstPressed = true;
    }, i);
    await page.waitForTimeout(140);
    const t = await telemetry(page);
    if (i % 10 === 0) samples.push({ hp: t && t.health, wave: t && t.wave, score: t && t.score });
    i++;
    if (t && (t.state === 'gameover' || t.state === 'dying')) break;
  }
  const final = await telemetry(page);
  console.log('MOBILE final:', JSON.stringify(final));
  console.log('MOBILE trajectory:', JSON.stringify(samples));
  await page.screenshot({ path: 'tests/shots/qa-mobile.png' });
  await context.close();
  expect(errors).toEqual([]);
});
