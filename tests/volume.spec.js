const { test, expect } = require('@playwright/test');

test('volume cycles through 3 levels and persists', async ({ page }) => {
  test.setTimeout(30000);
  await page.goto('/');
  await page.waitForTimeout(500);
  const result = await page.evaluate(async () => {
    const a = window.__audio;
    a.setVolume(0.6);
    const seq = [];
    seq.push(a.volume);          // 0.6
    seq.push(a.cycleVolume());   // 0.3
    seq.push(a.cycleVolume());   // 0
    seq.push(a.cycleVolume());   // 0.6 (wraps)
    const mutedAtZero = (function () { a.setVolume(0); return a.muted; })();
    a.setVolume(0.3);
    const stored = parseFloat(localStorage.getItem('stickman_arena_vol'));
    return { seq, stored, mutedAtZero };
  });
  expect(result.seq).toEqual([0.6, 0.3, 0, 0.6]);
  expect(result.mutedAtZero).toBe(true);
  expect(result.stored).toBe(0.3);
});
