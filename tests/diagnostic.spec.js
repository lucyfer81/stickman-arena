const { test } = require('@playwright/test');

const telemetry = (page) => page.evaluate(() => window.__stickman || null);

const startGame = async (page) => {
  await page.goto('/');
  for (let i = 0; i < 100; i++) {
    const t = await telemetry(page);
    if (t && t.state === 'title') break;
    await page.waitForTimeout(120);
  }
  await page.keyboard.press('Space');
  for (let i = 0; i < 100; i++) {
    const t = await telemetry(page);
    if (t && t.state === 'game') break;
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(1500); // let enemies spawn
};

const run = async (page, fn, durMs) => {
  const deadline = Date.now() + durMs;
  let samples = [];
  while (Date.now() < deadline) {
    await fn(page);
    await page.waitForTimeout(110);
    if (samples.length < 40) {
      const t = await telemetry(page);
      samples.push(t ? t.hitsTaken : -1);
    }
  }
  return await telemetry(page);
};

const log = (name, t) => console.log(`STRATEGY [${name}] => hp=${t.health} wave=${t.wave} score=${t.score} hits=${t.hitsTaken} healed=${t.healed} alive=${t.enemiesAlive}`);

test.describe('Combat exploit diagnostic (fresh page each)', () => {
  test('pure-punch-spam', async ({ page }) => {
    test.setTimeout(60000);
    await startGame(page);
    const t = await run(page, async (p) => { await p.keyboard.press('J'); }, 30000);
    log('pure-punch-spam', t);
  });
  test('punch+kick J/K', async ({ page }) => {
    test.setTimeout(60000);
    await startGame(page);
    const t = await run(page, async (p) => { await p.keyboard.press('J'); await p.keyboard.press('K'); }, 30000);
    log('punch+kick', t);
  });
  test('jump-spam only', async ({ page }) => {
    test.setTimeout(60000);
    await startGame(page);
    const t = await run(page, async (p) => { await p.keyboard.down('Space'); await p.waitForTimeout(40); await p.keyboard.up('Space'); }, 30000);
    log('jump-spam', t);
  });
  test('stationary (no input)', async ({ page }) => {
    test.setTimeout(60000);
    await startGame(page);
    const t = await run(page, async () => {}, 30000);
    log('stationary', t);
  });
  test('hardcore 150s (late-game threat)', async ({ page }) => {
    test.setTimeout(200000);
    await startGame(page);
    let i = 0;
    const deadline = Date.now() + 150000;
    const traj = [];
    while (Date.now() < deadline) {
      const r = i % 5;
      if (r === 0) await page.keyboard.press('J');
      else if (r === 1) await page.keyboard.press('K');
      else if (r === 2) await page.keyboard.press('D');
      else if (r === 3) await page.keyboard.press('J');
      else { await page.keyboard.down('Space'); await page.waitForTimeout(40); await page.keyboard.up('Space'); }
      await page.waitForTimeout(95);
      const t = await telemetry(page);
      if (i % 12 === 0) traj.push({ hp: t.health, wave: t.wave, hits: t.hitsTaken });
      i++;
      if (t.state === 'gameover') break;
    }
    const t = await telemetry(page);
    log('hardcore-150s', t);
    console.log('HARDCORE150 trajectory:', JSON.stringify(traj));
  });
});
