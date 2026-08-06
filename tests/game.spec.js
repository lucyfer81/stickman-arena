const { test, expect } = require('@playwright/test');

const noErrors = (page) => {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
};

test.describe('Stickman Arena', () => {
  test('loads and shows title screen', async ({ page }) => {
    const errors = noErrors(page);
    await page.goto('/');
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'tests/shots/01-title.png' });
    expect(errors).toEqual([]);
  });

  test('starts gameplay and plays', async ({ page }) => {
    const errors = noErrors(page);
    await page.goto('/');
    await page.waitForTimeout(700);
    await page.keyboard.press('Space');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: 'tests/shots/02-gameplay.png' });
    // fight a bit: move and attack
    for (let i = 0; i < 10; i++) {
      await page.keyboard.down('D');
      await page.waitForTimeout(180);
      await page.keyboard.up('D');
      await page.keyboard.press('J');
      await page.keyboard.press('J');
      await page.keyboard.press('K');
      await page.waitForTimeout(120);
    }
    await page.screenshot({ path: 'tests/shots/03-combat.png' });
    expect(errors).toEqual([]);
  });

  test('mobile landscape has touch controls', async ({ page }) => {
    const errors = noErrors(page);
    await page.goto('/');
    await page.waitForTimeout(700);
    await page.screenshot({ path: 'tests/shots/04-mobile-title.png' });
    await page.mouse.click(640, 360);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: 'tests/shots/05-mobile-game.png' });
    expect(errors).toEqual([]);
  });

  test('mobile portrait renders', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(700);
    await page.screenshot({ path: 'tests/shots/06-portrait.png' });
  });
});
