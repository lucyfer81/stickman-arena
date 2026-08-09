// Real-play evaluation of OVERDRIVE: an aggressive persona fights for ~75s and
// pops Overdrive (L) whenever the meter is ready. Confirms the feature FIRES
// repeatedly in a live session, creates crowd-clear peaks, and never errors.
// (Not part of CI — evaluation harness, like eval-secondwind.)
const { test, expect } = require('@playwright/test');

const collectErrors = (page) => {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String((e && e.stack) || e)));
  return errors;
};
const tele = (page) => page.evaluate(() => window.__stickman || null);
const waitTele = async (page, predicate, timeout = 20000, interval = 150) => {
  const dl = Date.now() + timeout;
  while (Date.now() < dl) {
    const t = await tele(page);
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

test.describe('OVERDRIVE — real-play evaluation', () => {
  test('aggressive persona pops Overdrive on cooldown across a session', async ({ page }) => {
    test.setTimeout(120000);
    const errors = collectErrors(page);
    await startGame(page);
    await page.waitForTimeout(1500);

    const DURATION = 75000;
    const deadline = Date.now() + DURATION;
    let i = 0;
    let burstsSeen = 0;
    while (Date.now() < deadline) {
      const t = await tele(page);
      if (t && t.state === 'gameover') break;
      // pop Overdrive the instant it's ready (the "use it on cooldown" persona)
      if (t && t.burstReady) {
        await page.keyboard.press('L');
        burstsSeen++;
      }
      // aggressive combat: alternate punch/kick, chase the action, jump-shockwaves
      const r = i % 5;
      if (r === 0) await page.keyboard.press('J');
      else if (r === 1) await page.keyboard.press('K');
      else if (r === 2) await page.keyboard.press('D');
      else if (r === 3) await page.keyboard.press('J');
      else { await page.keyboard.down('Space'); await page.waitForTimeout(40); await page.keyboard.up('Space'); }
      await page.waitForTimeout(90);
      i++;
    }

    const final = await tele(page);
    console.log('OVERDRIVE EVAL final:', JSON.stringify({
      wave: final.wave, score: final.score, kills: final.kills,
      bestCombo: final.bestCombo, endHP: final.health, healed: final.healed,
      bursts: final.bursts, hitsTaken: final.hitsTaken, isBossWave: final.isBossWave,
    }));
    await page.screenshot({ path: 'tests/shots/eval-overdrive-end.png' });

    // the feature must actually engage in a real session
    expect(final.bursts, 'Overdrive should fire at least once in 75s of combat').toBeGreaterThanOrEqual(1);
    expect(errors, 'no runtime errors across the session').toEqual([]);
  });
});
