// Dev / QA test suites — focused checks that are NOT part of CI (`npm test`).
// Consolidated from the old root-level combo/diag/difficulty/meta/onboard/
// playthrough/volume configs.
//
// Run all dev suites:  npx playwright test --config=tests/dev.config.js
// Run one by project:  npx playwright test --config=tests/dev.config.js --project=combo
// Run one by title:    npx playwright test --config=tests/dev.config.js -g "leaper"
//
// Note: config lives in tests/, so testDir is this folder and the static
// server's cwd is set back to the repo root so it serves the game.
const { defineConfig, devices } = require('@playwright/test');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

const project = (name, match, timeout = 90000) => ({
  name,
  testMatch: match,
  use: { ...devices['Desktop Chrome'], timeout },
});

module.exports = defineConfig({
  testDir: __dirname,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  expect: { timeout: 10000 },
  use: { baseURL: 'http://localhost:8080' },
  projects: [
    project('boss',        /boss\.spec\.js/,        120000),
    project('burst',       /burst\.spec\.js/,        90000),
    project('bossvariety', /bossvariety\.spec\.js/, 120000),
    project('depth',       /depth\.spec\.js/,        90000),
    project('combo',       /combo\.spec\.js/,          90000),
    project('bridge',      /combo-bridge\.spec\.js/,   60000),
    project('diag',        /diagnostic\.spec\.js/, 300000),
    project('difficulty',  /difficulty\.spec\.js/,   90000),
    project('eval',        /eval-secondwind\.spec\.js/, 90000),
    project('evalburst',   /eval-burst\.spec\.js/,    120000),
    project('firstminute', /firstminute\.spec\.js/,   90000),
    project('laststand',   /laststand\.spec\.js/,    90000),
    project('magnet',      /magnet\.spec\.js/,        60000),
    project('mercy',       /mercy\.spec\.js/,         90000),
    project('meta',        /meta\.spec\.js/,         60000),
    project('music',       /music\.spec\.js/,         60000),
    project('options',     /options\.spec\.js/,       60000),
    project('roundc',      /roundc\.spec\.js/,        90000),
    project('onboard',     /onboard\.spec\.js/,      60000),
    project('assist',      /onboarding-assist\.spec\.js/, 60000),
    project('autofire',    /mobile-autofire\.spec\.js/,  60000),
    project('sprint',      /sprint-in\.spec\.js/,        60000),
    project('swarm',       /pack-pressure\.spec\.js/,   60000),
    project('playthrough', /playthrough\.spec\.js/, 180000),
    project('qa',          /qa-regression\.spec\.js/, 120000),
    project('retention',   /retention\.spec\.js/,     60000),
    project('variety',     /variety.*\.spec\.js/,     90000),
    project('volume',      /volume\.spec\.js/,       30000),
    project('feel14',      /feel14-visual\.spec\.js/, 120000),
  ],
  webServer: {
    command: 'python3 -m http.server 8080',
    cwd: repoRoot,
    port: 8080,
    reuseExistingServer: true,
    timeout: 15000,
  },
});
