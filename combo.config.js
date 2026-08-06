const { defineConfig, devices } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests', timeout: 90000, fullyParallel: false, workers: 1, reporter: [['list']],
  use: { baseURL: 'http://localhost:8080' },
  projects: [{ name: 'combo', testMatch: /combo\.spec\.js/, use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'python3 -m http.server 8080', port: 8080, reuseExistingServer: true, timeout: 15000 },
});
