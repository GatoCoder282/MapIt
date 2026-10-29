import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const camera = resolve(__dirname, '.tmp/payments-camera.y4m');

/** Recorrido frontend con mocks explícitos; no constituye E2E financiero. */
export default defineConfig({
  testDir: './tests/payment-preview',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120000,
  expect: { timeout: 45000 },
  globalSetup: './tests/payment-preview/camera-setup.ts',
  outputDir: './test-results/payment-preview',
  snapshotPathTemplate: '{testDir}/snapshots/{arg}-{projectName}{ext}',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/payments', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4500',
    locale: 'es-BO',
    timezoneId: 'America/La_Paz',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--use-file-for-fake-video-capture=' + camera,
      ],
    },
  },
  webServer: [
    {
      command: 'pnpm exec ng serve console --host 127.0.0.1 --port 4400',
      cwd: root,
      env: { NG_BUILD_MAX_WORKERS: '2' },
      url: 'http://127.0.0.1:4400',
      reuseExistingServer: !process.env['CI'],
      timeout: 240000,
    },
    {
      command: 'pnpm exec ng serve public-web --host 127.0.0.1 --port 4500',
      cwd: root,
      env: { NG_BUILD_MAX_WORKERS: '2' },
      url: 'http://127.0.0.1:4500',
      reuseExistingServer: !process.env['CI'],
      timeout: 240000,
    },
  ],
  projects: [
    {
      name: 'payments-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
    { name: 'payments-tablet', use: { ...devices['iPad Pro 11'], browserName: 'chromium' } },
    {
      name: 'payments-mobile',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    },
  ],
});
