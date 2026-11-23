import { expect as baseExpect, test } from '@playwright/test';
import { companyAdminFixture } from './company-admin-fixture';

const API = process.env['API_BASE_URL'] ?? 'http://localhost:8080/api/v1';
const expect = baseExpect.configure({ timeout: 15_000 });

test('gestiona y conserva las plantas del plano', async ({ page, request, baseURL }, testInfo) => {
  test.setTimeout(90_000);
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
  await expect(tree).toBeVisible();
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
  await expect(page).toHaveURL(/\/spaces\/editor\?floorId=[^&]+$/);
  const floorId = new URL(page.url()).searchParams.get('floorId')!;
  const headers = { Authorization: 'Bearer ' + session.accessToken };
  const legacySector = await request.post(API + '/floors/' + floorId + '/sectors', {
    headers,
    data: { name: 'Salón anterior', slug: 'salon-anterior', maxCapacity: 20 },
  });
  expect(legacySector.status()).toBe(201);

  await page.reload();
  const expand = tree.getByRole('button', { name: 'Expandir o contraer piso · Principal' });
  await expect(expand).toHaveAttribute('aria-expanded', 'true');
  await expand.click();
  await expect(expand).toHaveAttribute('aria-expanded', 'false');
  await expand.focus();
  await page.keyboard.press('Enter');
  await expect(expand).toHaveAttribute('aria-expanded', 'true');
  await expect(tree.getByRole('button', { name: 'Salón anterior', exact: true })).toHaveCount(0);
  await expect(tree.getByRole('button', { name: /Agregar sector/ })).toHaveCount(0);

  const floors = tree.getByRole('button', { name: /^(Principal|Superior)$/ });
  await expect(floors).toHaveText(['Principal', 'Superior']);
  await tree.getByRole('button', { name: 'Orden', exact: true }).click();
  const upperFloor = tree
    .getByRole('listitem')
    .filter({ has: page.getByRole('button', { name: 'Superior', exact: true }) });
  await upperFloor.getByRole('button', { name: 'Mover arriba' }).click();
  await expect(floors).toHaveText(['Superior', 'Principal']);
  await page.reload();
  await expect(floors).toHaveText(['Superior', 'Principal']);

  await tree.getByLabel('Acciones · Superior', { exact: true }).click();
  await tree.getByRole('button', { name: 'Editar', exact: true }).click();
  await tree.getByRole('textbox', { name: 'Nombre' }).fill('Entrepiso');
  await tree.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(tree.getByRole('button', { name: 'Entrepiso', exact: true })).toBeVisible();

  page.once('dialog', (dialog) => void dialog.dismiss());
  await tree.getByLabel('Acciones · Principal', { exact: true }).click();
  await tree.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await expect(tree.getByRole('button', { name: 'Principal', exact: true })).toBeVisible();

  await expect(tree).toHaveJSProperty('scrollWidth', await tree.evaluate((el) => el.clientWidth));
  await page.screenshot({ path: testInfo.outputPath('estructura-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 1100, height: 850 });
  await expect(tree).toHaveJSProperty('scrollWidth', await tree.evaluate((el) => el.clientWidth));
  await page.screenshot({ path: testInfo.outputPath('estructura-compacta.png'), fullPage: true });

  page.once('dialog', (dialog) => void dialog.accept());
  await tree.getByLabel('Acciones · Entrepiso', { exact: true }).click();
  await tree.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await expect(tree.getByRole('button', { name: 'Entrepiso', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(tree.getByRole('button', { name: 'Principal', exact: true })).toBeVisible();
  await expect(tree.getByRole('button', { name: 'Entrepiso', exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});
