import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

/**
 * HU-7.07 (MAP-300): configuración de plataforma sobre el stack real.
 *
 * Enciende `mapit.s6.platform-settings` en Unleash, hace el recorrido del Super Admin y la vuelve
 * a apagar. Ningún otro E2E depende de esa flag; corre solo en el proyecto `console` para que
 * dos proyectos no la conmuten a la vez.
 */
const UNLEASH = (process.env['UNLEASH_URL'] ?? 'http://localhost:4242/api').replace(
  /\/api\/?$/,
  '',
);
const ENVIRONMENT = process.env['UNLEASH_ENVIRONMENT'] ?? 'development';
const FLAG = '/api/admin/projects/default/features/mapit.s6.platform-settings';
const EMAIL = process.env['E2E_SUPER_ADMIN_EMAIL'] ?? 'superadmin@mapit.local';
const PASSWORD = process.env['E2E_SUPER_ADMIN_PASSWORD'] ?? 'super-admin-dev';
const LINK = 'setting-customer-history.link-ttl-minutes';

async function flip(request: APIRequestContext, on: boolean): Promise<void> {
  const response = await request.post(
    `${UNLEASH}${FLAG}/environments/${ENVIRONMENT}/${on ? 'on' : 'off'}`,
    {
      headers: {
        Authorization: process.env['UNLEASH_ADMIN_TOKEN'] ?? '*:*.unleash-insecure-admin-token',
      },
    },
  );
  expect(response.ok()).toBe(true);
}

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(EMAIL);
  await page.getByTestId('login-password').fill(PASSWORD);
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/\/admin\//, { timeout: 15_000 });
}

/** El backend refresca las flags cada pocos segundos: se recarga hasta ver el estado esperado. */
async function openSettings(page: Page, testId: string): Promise<void> {
  await expect(async () => {
    await page.goto('/admin/settings');
    await expect(page.getByTestId(testId)).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 60_000 });
}

async function apply(page: Page, reason: string, restore = false): Promise<void> {
  await page.getByTestId(LINK).getByTestId('setting-edit').click();
  if (!restore) await page.getByLabel(/nuevo valor/i).fill('45');
  await page.getByLabel(/motivo del cambio/i).fill(reason);
  await page.getByTestId(restore ? 'setting-restore' : 'setting-review').click();
  await expect(page.getByTestId('setting-confirm')).toBeVisible();
  await page.getByTestId('setting-apply').click();
  await expect(page.getByTestId('settings-notice')).toBeVisible();
}

test.describe('HU-7.07 — configuración de plataforma', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Solo Chromium');

  test('flag ON: cambiar, auditar y restaurar; flag OFF: sección no habilitada', async ({
    page,
    request,
  }, info) => {
    test.skip(info.project.name !== 'console', 'La flag es compartida: un solo proyecto la usa');
    test.setTimeout(180_000);
    await flip(request, true);
    try {
      await login(page);
      await openSettings(page, LINK);
      const value = page.getByTestId(LINK).getByTestId('setting-value');
      await expect(value).toHaveText('15');
      await expect(page.getByTestId('settings-flags')).toContainText('mapit.s6.platform-settings');

      await apply(page, 'Prueba E2E: ampliar vigencia del enlace');
      await expect(value).toHaveText('45');
      await expect(page.getByTestId('settings-history')).toContainText('15 → 45');

      // Móvil: la página no desborda en horizontal.
      await page.setViewportSize({ width: 390, height: 844 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.setViewportSize({ width: 1280, height: 720 });

      await apply(page, 'Prueba E2E: volver al valor del despliegue', true);
      await expect(value).toHaveText('15');
    } finally {
      await flip(request, false);
    }
    await openSettings(page, 'settings-disabled');
  });
});
