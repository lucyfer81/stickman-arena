const { test, expect } = require('@playwright/test');

test('mobile portrait: rotate hint shown', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'tests/shots/06-portrait.png' });
  await expect(page.locator('#rotate-hint')).toBeVisible();
});
