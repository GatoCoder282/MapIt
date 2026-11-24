import { defineConfig, devices } from '@playwright/test';

/** QA opt-in de MAP-286 contra stack real con cadena V40–V45 verificada. */
export default defineConfig({
  testDir: './tests/console',
  testMatch: 'notification-center-live.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 240000,
  expect: { timeout: 15000 },
  reporter: [
    ['./tests/payment-live/redacted-reporter.ts'],
    ['list'],
    ['html', { outputFolder: 'playwright-report/notifications', open: 'never' }],
  ],
  outputDir: 'test-results/notifications',
  use: {
    baseURL: process.env['CONSOLE_URL'] ?? 'http://localhost:4200',
    actionTimeout: 15000,
    navigationTimeout: 30000,
    trace: 'off',
    video: 'off',
    screenshot: 'off',
    launchOptions: { channel: process.env['E2E_BROWSER_CHANNEL'] ?? 'chrome' },
  },
  projects: [
    {
      name: 'notifications-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
    { name: 'notifications-mobile', use: { ...devices['Pixel 7'] } },
  ],
});
