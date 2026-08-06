const { test, expect } = require('@playwright/test');

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

// ---------- FIRST-TIME PLAYER: does nothing, just observes ----------
test.describe('Persona: First-time player', () => {
  test('idle observation (AFK 30s)', async ({ page }) => {
    test.setTimeout(90000);
    const errors = collectErrors(page);
    await startGame(page);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'tests/shots/p-firstspawn.png' });
    // do NOTHING for 30 seconds — does the player survive? how does it feel?
    const samples = [];
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      const t = await telemetry(page);
      samples.push({ at: Math.round((Date.now() - deadline + 30000) / 1000), hp: t && t.health, wave: t && t.wave, alive: t && t.enemiesAlive });
      await page.waitForTimeout(1000);
    }
    await page.screenshot({ path: 'tests/shots/p-firstspawn-afk.png' });
    const final = await telemetry(page);
    console.log('FIRST-TIME AFK samples:', JSON.stringify(samples));
    console.log('FIRST-TIME final:', JSON.stringify(final));
    expect(errors).toEqual([]);
  });
});

// ---------- CASUAL PLAYER: presses attacks slowly & sporadically ----------
test.describe('Persona: Casual player', () => {
  test('slow sporadic combat (60s)', async ({ page }) => {
    test.setTimeout(120000);
    const errors = collectErrors(page);
    await startGame(page);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'tests/shots/p-casual-start.png' });
    const samples = [];
    const deadline = Date.now() + 60000;
    let i = 0;
    while (Date.now() < deadline) {
      // slow, clumsy: move sometimes, punch sometimes, often idle
      const r = i % 6;
      if (r === 0) await page.keyboard.press('D');
      else if (r === 1) await page.keyboard.press('J');
      else if (r === 2) await page.keyboard.press('A');
      else if (r === 3) { /* idle gap */ }
      else if (r === 4) await page.keyboard.press('J');
      else await page.keyboard.press('K');
      await page.waitForTimeout(450); // slow reactions
      const t = await telemetry(page);
      samples.push({ hp: t && t.health, wave: t && t.wave, score: t && t.score, combo: t && t.combo });
      i++;
    }
    await page.screenshot({ path: 'tests/shots/p-casual-end.png' });
    const final = await telemetry(page);
    console.log('CASUAL final:', JSON.stringify(final));
    console.log('CASUAL score trajectory:', samples.map(s => s.score).join(','));
    expect(errors).toEqual([]);
  });
});

// ---------- HARDCORE PLAYER: aggressive, optimal-ish combat, survives long ----------
test.describe('Persona: Hardcore player', () => {
  test('aggressive optimal combat (survive 90s)', async ({ page }) => {
    test.setTimeout(150000);
    const errors = collectErrors(page);
    await startGame(page);
    await page.waitForTimeout(1500);
    const samples = [];
    const deadline = Date.now() + 90000;
    let i = 0;
    while (Date.now() < deadline) {
      // aggressive: alternate punch/kick, move toward action, jump to dodge
      const r = i % 5;
      if (r === 0) await page.keyboard.press('J');
      else if (r === 1) await page.keyboard.press('K');
      else if (r === 2) await page.keyboard.press('D');
      else if (r === 3) await page.keyboard.press('J');
      else { await page.keyboard.down('Space'); await page.waitForTimeout(40); await page.keyboard.up('Space'); }
      await page.waitForTimeout(95);
      const t = await telemetry(page);
      if (i % 5 === 0) samples.push({ hp: t && t.health, wave: t && t.wave, score: t && t.score, combo: t && t.bestCombo, hits: t && t.hitsTaken, healed: t && t.healed });
      i++;
      if (t && t.state === 'gameover') break;
    }
    await page.screenshot({ path: 'tests/shots/p-hardcore-end.png' });
    const final = await telemetry(page);
    console.log('HARDCORE final:', JSON.stringify(final));
    console.log('HARDCORE trajectory:', JSON.stringify(samples));
    expect(errors).toEqual([]);
  });
});

// ---------- MOBILE PLAYER: touch controls via injected control state ----------
test.describe('Persona: Mobile player', () => {
  test('touch combat landscape (45s)', async ({ browser }) => {
    test.setTimeout(120000);
    const context = await browser.newContext({
      viewport: { width: 915, height: 412 },
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    const errors = collectErrors(page);
    await startGame(page);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'tests/shots/p-mobile-start.png' });
    const samples = [];
    const deadline = Date.now() + 45000;
    let i = 0;
    while (Date.now() < deadline) {
      await page.evaluate((step) => {
        const c = window.__controls; if (!c) return;
        c.touchActive = true;
        c.touchDir = (step % 4 === 0) ? -1 : 1;
        c.punchPressed = true;
        if (step % 3 === 0) c.kickPressed = true;
        if (step % 7 === 0) { c.jumpPressed = true; c.jumpHeldTouch = true; }
        else c.jumpHeldTouch = false;
      }, i);
      await page.waitForTimeout(150);
      const t = await telemetry(page);
      if (i % 4 === 0) samples.push({ hp: t && t.health, wave: t && t.wave, score: t && t.score });
      i++;
      if (t && t.state === 'gameover') break;
    }
    await page.screenshot({ path: 'tests/shots/p-mobile-end.png' });
    const final = await telemetry(page);
    console.log('MOBILE final:', JSON.stringify(final));
    console.log('MOBILE trajectory:', JSON.stringify(samples));
    await context.close();
    expect(errors).toEqual([]);
  });
});
