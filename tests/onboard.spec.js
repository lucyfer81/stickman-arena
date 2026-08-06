const { test, expect } = require('@playwright/test');

const tele = (page) => page.evaluate(() => window.__stickman || null);

test.describe('Onboarding', () => {
  test('hints appear then clear as actions are performed', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/');
    for (let i = 0; i < 100; i++) { const t = await tele(page); if (t && t.state === 'title') break; await page.waitForTimeout(120); }
    await page.keyboard.press('Space');
    for (let i = 0; i < 100; i++) { const t = await tele(page); if (t && t.state === 'game') break; await page.waitForTimeout(120); }
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'tests/shots/onb-1-appear.png' });
    let t = await tele(page);
    expect(t.onboard).toBeTruthy();
    expect(t.onboard.move).toBe(false);
    expect(t.onboard.punch).toBe(false);

    // perform the actions one by one and confirm flags flip
    await page.keyboard.press('D');
    await page.waitForTimeout(150);
    t = await tele(page);
    expect(t.onboard.move).toBe(true);

    await page.keyboard.press('J');
    await page.waitForTimeout(150);
    t = await tele(page);
    expect(t.onboard.punch).toBe(true);

    await page.keyboard.press('K');
    await page.waitForTimeout(150);
    t = await tele(page);
    expect(t.onboard.kick).toBe(true);

    await page.keyboard.down('Space'); await page.waitForTimeout(50); await page.keyboard.up('Space');
    await page.waitForTimeout(150);
    t = await tele(page);
    expect(t.onboard.jump).toBe(true);
    expect(t.onboard.move && t.onboard.jump && t.onboard.punch && t.onboard.kick).toBe(true);
    await page.screenshot({ path: 'tests/shots/onb-2-cleared.png' });
  });
});
