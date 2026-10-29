import { defineConfig } from '@playwright/test';
import preview from './playwright.payments.config';

export default defineConfig({
  ...preview,
  testDir: './tests/payment-live',
  globalSetup: './tests/payment-live/setup.ts',
  outputDir: './test-results/payment-live',
  reporter: [
    ['./tests/payment-live/redacted-reporter.ts'],
    ['list'],
    ['html', { outputFolder: 'playwright-report/payment-live', open: 'never' }],
  ],
  // Capabilities live in URLs/QRs: never persist browser traces or screenshots.
  use: { ...preview.use, trace: 'off', screenshot: 'off', launchOptions: {} },
  projects: [
    {
      name: 'payment-live',
      use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } },
    },
  ],
});
