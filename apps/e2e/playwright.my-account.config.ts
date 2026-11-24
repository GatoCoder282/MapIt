import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

// La suite cambia una flag compartida: solo esta configuración serial la habilita.
process.env['MAPIT_MY_ACCOUNT_LIVE'] = '1';

/** QA real de MAP-285; un worker porque el rollback modifica una única flag compartida. */
export default defineConfig({
  ...base,
  testMatch: /console\/(my-account|unified-login)\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  use: {
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    ...(process.env['E2E_BROWSER_CHANNEL'] ? { channel: process.env['E2E_BROWSER_CHANNEL'] } : {}),
  },
  projects: [
    {
      name: 'console',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env['CONSOLE_URL'] ?? 'http://localhost:4200',
      },
    },
    {
      name: 'console-mobile',
      use: {
        ...devices['Pixel 7'],
        baseURL: process.env['CONSOLE_URL'] ?? 'http://localhost:4200',
      },
    },
  ],
});
