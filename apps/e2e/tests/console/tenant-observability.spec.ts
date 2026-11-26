import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

/**
 * HU-7.08 (MAP-301) sobre el stack real: enciende `mapit.s6.tenant-observability`, recorre
 * resumen y detalle y vuelve a apagarla. Solo en el proyecto `console` porque la flag es
 * compartida.
 */
const UNLEASH = (process.env['UNLEASH_URL'] ?? 'http://localhost:4242/api').replace(
  /\/api\/?$/,
  '',
);
const ENVIRONMENT = process.env['UNLEASH_ENVIRONMENT'] ?? 'development';
const FLAG = '/api/admin/projects/default/features/mapit.s6.tenant-observability';
const EMAIL = process.env['E2E_SUPER_ADMIN_EMAIL'] ?? 'superadmin@mapit.local';
const PASSWORD = process.env['E2E_SUPER_ADMIN_PASSWORD'] ?? 'super-admin-dev';

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

async function open(page: Page, testId: string): Promise<void> {
  await expect(async () => {
    await page.goto('/admin/observability');
    await expect(page.getByTestId(testId)).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 60_000 });
}

test.describe('HU-7.08 — observabilidad de empresas', () => {
  test('flag ON: resumen y detalle sin datos personales; OFF: no habilitada', async ({
    page,
    request,
  }, info) => {
    test.skip(info.project.name !== 'console', 'La flag es compartida: un solo proyecto la usa');
    test.setTimeout(180_000);
    await flip(request, true);
    try {
      await login(page);
      await open(page, 'observability-totals');
      const tenants = page.getByTestId('observability-tenants');
      await expect(tenants.getByRole('listitem').first()).toBeVisible();
      // Ninguna dirección de correo en pantalla.
      await expect(page.locator('main, body').first()).not.toContainText('@mapit');

      await tenants.getByRole('link', { name: 'Ver detalle' }).first().click();
      await expect(page).toHaveURL(/\/admin\/observability\/.+/);
      await expect(page.getByTestId('tenant-health')).toBeVisible();

      await page.setViewportSize({ width: 390, height: 844 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.setViewportSize({ width: 1280, height: 720 });
    } finally {
      await flip(request, false);
    }
    await open(page, 'observability-disabled');
  });
});
