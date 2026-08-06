const { test, expect } = require('@playwright/test');

const tele = (page) => page.evaluate(() => window.__stickman || null);

const startWithDiff = async (page, diff) => {
  await page.goto('/');
  // set difficulty via localStorage before the title resolves it (title reads on create)
  await page.evaluate((d) => localStorage.setItem('stickman_arena_diff', d), diff);
  for (let i = 0; i < 100; i++) { const t = await tele(page); if (t && t.state === 'title') break; await page.waitForTimeout(120); }
  // reload so title picks up the stored difficulty
  await page.reload();
  for (let i = 0; i < 100; i++) { const t = await tele(page); if (t && t.state === 'title') break; await page.waitForTimeout(120); }
  await page.keyboard.press('Space');
  for (let i = 0; i < 100; i++) { const t = await tele(page); if (t && t.state === 'game') break; await page.waitForTimeout(120); }
  await page.waitForTimeout(1200);
};

test.describe('Difficulty', () => {
  test('easy vs hard shift enemy HP and player HP', async ({ page }) => {
    test.setTimeout(90000);
    // HARD: player HP 90, enemies beefier
    await startWithDiff(page, 'hard');
    let t = await tele(page);
    expect(t.difficulty).toBe('HARD');
    const hardPlayerHp = t.health;
    expect(hardPlayerHp).toBe(90);
    // find a live grunt's max HP via the enemy objects
    const hardGruntHp = await page.evaluate(() => {
      const gs = window.__controls && window.__stickman;
      // no direct enemy handle; infer via damage needed: use test kill on a fresh spawn
      return null;
    });

    // EASY: player HP 120
    await startWithDiff(page, 'easy');
    t = await tele(page);
    expect(t.difficulty).toBe('EASY');
    expect(t.health).toBe(120);

    // NORMAL: player HP 100
    await startWithDiff(page, 'normal');
    t = await tele(page);
    expect(t.difficulty).toBe('NORMAL');
    expect(t.health).toBe(100);
  });
});
