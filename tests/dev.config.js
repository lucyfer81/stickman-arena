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
    project('combo',       /combo\.spec\.js/,        90000),
    project('diag',        /diagnostic\.spec\.js/,  300000),
    project('difficulty',  /difficulty\.spec\.js/,   90000),
    project('meta',        /meta\.spec\.js/,         60000),
    project('onboard',     /onboard\.spec\.js/,      60000),
    project('playthrough', /playthrough\.spec\.js/, 180000),
    project('volume',      /volume\.spec\.js/,       30000),
  ],
  webServer: {
    command: 'python3 -m http.server 8080',
    cwd: repoRoot,
    port: 8080,
    reuseExistingServer: true,
    timeout: 15000,
  },
});
