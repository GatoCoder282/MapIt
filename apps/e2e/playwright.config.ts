import { defineConfig, devices } from '@playwright/test';

/**
 * Configuración de los tests E2E de MapIt.
 *
 * Dos proyectos, uno por aplicación, porque son superficies distintas con
 * autenticación distinta: `console` requiere JWT de staff y `public-web` es anónima.
 */
const CONSOLE_URL = process.env['CONSOLE_URL'] ?? 'http://localhost:4200';
const PUBLIC_URL = process.env['PUBLIC_WEB_URL'] ?? 'http://localhost:4300';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,

  // En CI, un `test.only` olvidado haría pasar el pipeline sin correr el resto.
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  ...(process.env['CI'] ? { workers: 1 } : {}),

  reporter: process.env['CI']
    ? [['html', { open: 'never' }], ['github']]
    : [['html', { open: 'never' }], ['list']],

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // RNF07: la consola se usa en tablet durante la operación.
    testIdAttribute: 'data-testid',
  },

  // Baseline única cross-OS: el spec de login fija su propio viewport
  // (1440x900), así que sin {-projectName}/{-platform} console y
  // console-tablet —y win32 y linux— comparten la misma referencia.
  snapshotPathTemplate: '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{ext}',

  projects: [
    {
      name: 'console',
      testMatch: /console\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: CONSOLE_URL },
    },
    {
      name: 'console-tablet',
      testMatch: /console\/.*\.spec\.ts/,
      // El "modo operación" en recepción se usa en tablet (RNF07): mismo
      // viewport de iPad, con Chromium. El WebKit de Playwright se crashea
      // en el flujo del shell (renderer) y en CI es inestable; el objetivo
      // aquí es probar el viewport, no el motor — el staff usa tablets con Chrome.
      use: {
        ...devices['iPad Pro 11'],
        browserName: 'chromium',
        defaultBrowserType: 'chromium',
        baseURL: CONSOLE_URL,
      },
    },
    {
      name: 'public-web',
      testMatch: /public-web\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: PUBLIC_URL },
    },
    {
      name: 'public-web-mobile',
      testMatch: /public-web\/.*\.spec\.ts/,
      // El cliente final reserva desde el móvil.
      use: { ...devices['Pixel 7'], baseURL: PUBLIC_URL },
    },
  ],
});
