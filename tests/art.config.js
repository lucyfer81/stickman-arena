// Temporary config for the art-direction screenshot sweep only.
const { defineConfig, devices } = require('@playwright/test');
const path = require('path');
const repoRoot = path.resolve(__dirname, '..');
module.exports = defineConfig({
  testDir: __dirname,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  expect: { timeout: 10000 },
  use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:8080', viewport: { width: 1280, height: 720 } },
  projects: [
    { name: 'art', testMatch: /art-review\.spec\.js/, timeout: 200000 },
  ],
  webServer: {
    command: 'python3 -m http.server 8080',
    cwd: repoRoot,
    port: 8080,
    reuseExistingServer: true,
    timeout: 15000,
  },
});
