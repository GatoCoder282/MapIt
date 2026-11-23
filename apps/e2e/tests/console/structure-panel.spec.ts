import { expect, test } from '@playwright/test';
import { companyAdminFixture } from './company-admin-fixture';

const API = process.env['API_BASE_URL'] ?? 'http://localhost:8080/api/v1';

test('gestiona y conserva la estructura sin bloquear sectores recién creados', async ({
  page,
  request,
  baseURL,
}, testInfo) => {
  const company = await companyAdminFixture(request);
  const login = await request.post(API + '/auth/global-login', {
    data: { email: company.email, password: company.password },
  });
  expect(login.ok()).toBe(true);
  const session = (await login.json()) as { accessToken: string };
  await page.addInitScript(
    ({ session, company, origin }) => {
      if (location.origin !== origin) return;
      sessionStorage.setItem(
        'mapit.auth.session',
        JSON.stringify({ ...session, tenantSlug: company.slug }),
      );
      localStorage.setItem(
        `mapit.establishment.${company.tenantId}.${company.userId}`,
        company.venueId,
      );
    },
    { session, company, origin: new URL(baseURL!).origin },
  );
  await page.route('**/assets/config.json', async (route) => {
    const response = await route.fetch();
    const config = (await response.json()) as Record<string, unknown>;
    await route.fulfill({
      response,
      json: { ...config, apiBaseUrl: API, unleashProxyUrl: '', unleashClientKey: '' },
    });
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/spaces/editor');
  const tree = page.getByRole('complementary', { name: 'Estructura del espacio' });
  await expect(tree).not.toContainText('Sede Home');
  for (const floorName of ['Principal', 'Superior']) {
    await tree.getByRole('button', { name: 'Agregar piso', exact: true }).click();
    await tree.getByRole('textbox', { name: 'Nombre' }).fill(floorName);
    await tree.getByRole('button', { name: 'Crear planta', exact: true }).click();
    await expect(tree.getByRole('button', { name: floorName, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  }
  await tree.getByRole('button', { name: 'Principal', exact: true }).click();
  for (const name of ['Salón', 'Terraza']) {
    const floor = tree
      .getByRole('listitem')
      .filter({ has: page.getByRole('button', { name: 'Principal', exact: true }) });
    await floor.getByRole('button', { name: 'Agregar sector', exact: true }).click();
    await floor.getByRole('textbox', { name: 'Nombre' }).fill(name);
    await floor.getByRole('spinbutton', { name: 'Capacidad' }).fill('20');
    await floor.getByRole('button', { name: 'Crear sector', exact: true }).click();
    await expect(tree.getByRole('button', { name, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByTestId('map-save')).toHaveCount(0);
    await expect(floor.getByRole('button', { name: 'Agregar sector', exact: true })).toBeEnabled();
  }
  const expand = tree.getByRole('button', { name: 'Expandir o contraer piso · Principal' });
  await expand.click();
  await expect(tree.getByRole('button', { name: 'Salón', exact: true })).toHaveCount(0);
  await expand.focus();
  await page.keyboard.press('Enter');
  await expect(tree.getByRole('button', { name: 'Salón', exact: true })).toBeVisible();
  await tree.getByLabel('Acciones · Terraza', { exact: true }).click();
  await tree.getByRole('button', { name: 'Editar', exact: true }).click();
  await tree.getByRole('textbox', { name: 'Nombre' }).fill('Terraza exterior');
  await tree.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(tree.getByRole('button', { name: 'Terraza exterior', exact: true })).toBeVisible();
  page.on('dialog', (dialog) => void dialog.accept());
  await tree.getByLabel('Acciones · Principal', { exact: true }).click();
  await tree.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await expect(tree.getByRole('alert')).toBeVisible();
  await expect(tree.getByRole('button', { name: 'Principal', exact: true })).toBeVisible();
  await page.reload();
  await expect(tree.getByRole('button', { name: 'Superior', exact: true })).toBeVisible();
  await tree.getByRole('button', { name: 'Principal', exact: true }).click();
  await expect(tree.getByRole('button', { name: 'Terraza exterior', exact: true })).toBeVisible();
  await tree.getByLabel('Acciones · Terraza exterior', { exact: true }).click();
  await tree.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await expect(tree.getByRole('button', { name: 'Terraza exterior', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(tree.getByRole('button', { name: 'Salón', exact: true })).toBeVisible();
  await expect(tree.getByRole('button', { name: 'Terraza exterior', exact: true })).toHaveCount(0);
  await expect(tree).toHaveJSProperty('scrollWidth', await tree.evaluate((el) => el.clientWidth));
  await page.screenshot({ path: testInfo.outputPath('estructura-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 1100, height: 850 });
  await expect(tree).toHaveJSProperty('scrollWidth', await tree.evaluate((el) => el.clientWidth));
  await page.screenshot({ path: testInfo.outputPath('estructura-compacta.png'), fullPage: true });
  await tree.getByLabel('Acciones · Superior', { exact: true }).click();
  await tree.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await expect(tree.getByRole('button', { name: 'Superior', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(tree.getByRole('button', { name: 'Superior', exact: true })).toHaveCount(0);
  const floorId = new URL(page.url()).searchParams.get('floorId')!;
  await Promise.all(
    Array.from({ length: 24 }, async (_, index) => {
      const response = await request.post(API + `/floors/${floorId}/sectors`, {
        headers: { Authorization: 'Bearer ' + session.accessToken },
        data: { name: `Sector adicional ${index}`, slug: `extra-${index}`, maxCapacity: 10 },
      });
      expect(response.status()).toBe(201);
    }),
  );
  await page.reload();
  await expect(
    tree.getByRole('button', { name: 'Sector adicional 23', exact: true }),
  ).toBeAttached();
  expect(await tree.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  expect(await tree.evaluate((el) => el.scrollWidth === el.clientWidth)).toBe(true);
  expect(errors).toEqual([]);
});
