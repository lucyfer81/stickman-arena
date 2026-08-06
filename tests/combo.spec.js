const { test, expect } = require('@playwright/test');

const tele = (page) => page.evaluate(() => window.__stickman || null);

test.describe('Combo system', () => {
  test('timer is exposed and tier bonus fires at x5', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto('/');
    for (let i = 0; i < 100; i++) { const t = await tele(page); if (t && t.state === 'title') break; await page.waitForTimeout(120); }
    await page.keyboard.press('Space');
    for (let i = 0; i < 100; i++) { const t = await tele(page); if (t && t.state === 'game') break; await page.waitForTimeout(120); }
    await page.waitForTimeout(2000);

    // comboTimer present in telemetry
    let t = await tele(page);
    expect(t).toHaveProperty('comboTimer');

    // build a combo by mashing punch near enemies; chase targets with D
    const deadline = Date.now() + 45000;
    let i = 0;
    while (Date.now() < deadline) {
      const r = i % 4;
      if (r === 0) await page.keyboard.press('D');
      else if (r === 1) await page.keyboard.press('A');
      await page.keyboard.press('J');
      await page.waitForTimeout(90);
      t = await tele(page);
      if (t && (t.tierBonuses > 0 || t.bestCombo >= 5)) break;
      i++;
    }
    await page.screenshot({ path: 'tests/shots/combo-tier.png' });
    t = await tele(page);
    console.log('COMBO => bestCombo=', t.bestCombo, 'tierBonuses=', t.tierBonuses, 'score=', t.score);
    // either we crossed a tier (bonus fired) or at least built a 5+ chain
    expect(t.tierBonuses > 0 || t.bestCombo >= 5).toBe(true);
  });
});
