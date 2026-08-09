// Visual verification of the Round-14 game-feel pass: capture impact frames
// (punch hit, kick hit, K.O., boss slam) and dump ASCII + pixel stats so we
// can "see" the new shake / squash / debris / trails / rings without a display.
const { test } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SHOTS = path.resolve(__dirname, 'shots', 'feel14');
fs.mkdirSync(SHOTS, { recursive: true });

const ASCII = path.resolve(__dirname, '..', 'tools', 'ascii.py');
const STAT = path.resolve(__dirname, '..', 'tools', 'imgstat.py');
const HAVE_PY = fs.existsSync('/home/ubuntu/projects/stickman-arena/.venv/bin/python') || true;
const PY = '/home/ubuntu/projects/stickman-arena/.venv/bin/python';
const pyOK = fs.existsSync(PY);

async function snap(page, name) {
  const file = path.join(SHOTS, name + '.png');
  await page.screenshot({ path: file });
  let ascii = '', stat = '';
  if (pyOK) {
    try { ascii = execSync(`${PY} ${ASCII} ${file} 100 40`, { encoding: 'utf8' }); } catch (e) { ascii = '(ascii err: ' + e.message + ')'; }
    try { stat = execSync(`${PY} ${STAT} ${file}`, { encoding: 'utf8' }); } catch (e) { stat = '(stat err)'; }
  }
  console.log('\n=== ' + name + ' ===');
  console.log(stat.trim());
  console.log(ascii);
}

test('feel-14 captures: hit / kick / kill / boss-slam with new juice', async ({ page }) => {
  test.setTimeout(120000);
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
  await page.goto('http://localhost:8080');
  await page.waitForFunction(() => window.__game && window.__game.scene);
  await page.evaluate(() => { try { localStorage.removeItem('stickman_arena_hs'); } catch (e) {} });
  // start the game (title -> gameplay)
  await page.keyboard.press('Space');
  await page.waitForFunction(() => {
    const s = window.__game && window.__game.scene && window.__game.scene.getScene('Game');
    return s && s.player && window.__stickman && window.__stickman.state !== 'title';
  }, { timeout: 10000 });

  // helper to drive an attack + capture the impact frame
  const setup = await page.evaluate(() => {
    const s = window.__game.scene.getScene('Game');
    s.wave1Truce = false;
    window.__test.clearEnemies();
    return { ok: true };
  });

  // 1. PUNCH IMPACT — dummy just in range, screenshot exactly when the hit lands.
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('Game');
    s.player.x = 640; s.player.facing = 1;
    window.__test.spawnDummy(70, true);
  });
  // wait a tick for spawn, then punch, then capture mid-active
  await page.waitForTimeout(120);
  await page.keyboard.press('KeyJ');
  // punch windup 0.05 + into-active 0.05 ~= 0.10s — capture at ~150ms
  await page.waitForTimeout(150);
  await snap(page, '01-punch-hit');

  // 2. KICK IMPACT — heavier, more shake, bigger squash
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('Game');
    window.__test.clearEnemies();
    s.player.x = 640; s.player.facing = 1;
    window.__test.spawnDummy(80, true);
  });
  await page.waitForTimeout(120);
  await page.keyboard.press('KeyK');
  await page.waitForTimeout(220);
  await snap(page, '02-kick-hit');

  // 3. K.O. — kill a dummy, capture the debris + launch sparks + ring + zoom
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('Game');
    window.__test.clearEnemies();
    s.player.x = 640; s.player.facing = 1;
    // weak dummy so one kick kills (triggers full K.O. stack)
    const e = window.__test.spawnDummy(80, true);
    if (e && e.health !== undefined) e.health = 1;
  });
  await page.waitForTimeout(120);
  await page.keyboard.press('KeyK');
  // capture right at the kill frame (kick hit-pause + slow-mo + debris burst)
  await page.waitForTimeout(240);
  await snap(page, '03-ko-kill');

  // 4. BOSS SLAM — full slam impact stack (heavy shake + downward shove)
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('Game');
    window.__test.clearEnemies();
    window.__test.spawnBossKind('slammer');
    s.boss.slam = { phase: 'windup', t: 0 };
    s.boss.slamCd = 0;
  });
  await page.waitForTimeout(900); // let the slam windup + leap + impact play
  await snap(page, '04-boss-slam');

  // 5. IDLE/BASELINE — to compare camera framing (look-ahead + base zoom)
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('Game');
    window.__test.clearEnemies();
    s.player.x = 640; s.player.facing = 1;
  });
  await page.waitForTimeout(400);
  await snap(page, '05-idle-baseline');

  // 6. OVERDRIVE — biggest player-chosen feedback peak
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('Game');
    window.__test.clearEnemies();
    s.player.x = 640;
    // spawn a few dummies so the wave has targets to hit
    for (let i = 0; i < 3; i++) window.__test.spawnDummy(80 + i * 20, true);
    window.__test.fillBurst();
  });
  await page.waitForTimeout(150);
  await page.keyboard.press('KeyL');
  await page.waitForTimeout(280); // windup 0.22 + into release
  await snap(page, '06-overdrive');

  console.log('\nerrors:', errors.length ? errors : '(none)');
});
