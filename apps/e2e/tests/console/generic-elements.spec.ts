import { expect, test, type Dialog } from '@playwright/test';
import { companyAdminFixture } from './company-admin-fixture';

const API = process.env['API_BASE_URL'] ?? 'http://localhost:8080/api/v1';

test('configura modelos genéricos y copia su apariencia dentro del mismo sector', async ({
  page,
  request,
  baseURL,
}, testInfo) => {
  test.setTimeout(90_000);
  const company = await companyAdminFixture(request);
  const login = await request.post(API + '/auth/global-login', {
    data: { email: company.email, password: company.password },
  });
  expect(login.ok()).toBe(true);
  const session = (await login.json()) as { accessToken: string };
  const headers = { Authorization: 'Bearer ' + session.accessToken };
  const floor = await request.post(API + `/establishments/${company.venueId}/floors`, {
    headers,
    data: { name: 'Principal' },
  });
  expect(floor.status()).toBe(201);
  const floorId = ((await floor.json()) as { id: string }).id;
  const sector = await request.post(API + `/floors/${floorId}/sectors`, {
    headers,
    data: { name: 'Salón', slug: 'salon', maxCapacity: 80 },
  });
  expect(sector.status()).toBe(201);
  const sectorId = ((await sector.json()) as { id: string }).id;
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
  await page.goto(`/spaces/editor/${sectorId}?floorId=${floorId}`);
  await page.getByTestId('map-elements-tab').click();
  const library = page.getByRole('region', { name: 'Agregar elemento', exact: true });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(library).toBeVisible();
  await expect(library.getByRole('button', { name: 'Redonda', exact: true })).toBeVisible();
  await expect(library.getByRole('button', { name: 'Ovalada', exact: true })).toBeVisible();
  await expect(library.getByRole('button', { name: 'Asientos y salas', exact: true })).toHaveCount(
    0,
  );
  await page.screenshot({ path: testInfo.outputPath('sidebar-elementos-desktop.png') });
  await page.setViewportSize({ width: 430, height: 932 });
  expect(await library.evaluate((el) => el.scrollWidth === el.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('sidebar-elementos-mobile.png') });
  await page.setViewportSize({ width: 1600, height: 1000 });
  await library.getByRole('button', { name: 'Ovalada', exact: true }).click();
  const capacity = library.getByRole('spinbutton', { name: /Capacidad/ });
  await capacity.fill('');
  await expect(capacity).toHaveValue('');
  await capacity.fill('6');
  await expect(capacity).toHaveValue('6');
  await library
    .getByRole('textbox', { name: 'Nombre (opcional)', exact: true })
    .fill('Mesa ventana');
  const canvas = page.getByTestId('map-canvas');
  await page.getByTestId('library-card-model:TABLE:oval').dragTo(canvas);
  await expect(library).toBeVisible();
  const elements = page.getByTestId('map-element-row');
  await expect(elements).toHaveCount(1);
  await expect(page.getByTestId('element-metadata-label')).toHaveValue('Mesa ventana');
  await expect(page.getByTestId('element-metadata-capacity')).toHaveValue('6');
  const x = Number(await page.getByTestId('map-element-x').inputValue());
  await canvas.click();
  await page.keyboard.press('Control+c');
  await page.getByRole('button', { name: 'Estilo', exact: true }).click();
  await page
    .getByRole('group', { name: 'Forma', exact: true })
    .getByRole('button', { name: 'Cuadrada', exact: true })
    .click();
  await page.keyboard.press('Control+v');
  await expect(elements).toHaveCount(2);
  await expect(page.getByTestId('map-element-x')).toHaveValue(String(x + 24));
  await expect(page.getByTestId('element-metadata-label')).toHaveValue('Mesa ventana');
  await expect(page.getByTestId('element-metadata-capacity')).toHaveValue('6');
  await page.getByRole('button', { name: 'Estilo', exact: true }).click();
  await expect(
    page
      .getByRole('group', { name: 'Forma', exact: true })
      .getByRole('button', { name: 'Ovalada', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('map-copy').focus();
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  await expect(elements).toHaveCount(3);
  await page.keyboard.press('Control+z');
  await expect(elements).toHaveCount(2);
  await page.keyboard.press('Control+y');
  await expect(elements).toHaveCount(3);
  const undo = page.getByTestId('map-undo');
  const redo = page.getByTestId('map-redo');
  await expect(undo).toHaveText('Deshacer');
  expect((await undo.boundingBox())!.y).toBeLessThan((await canvas.boundingBox())!.y);
  await undo.click();
  await expect(elements).toHaveCount(2);
  await undo.click();
  await expect(elements).toHaveCount(1);
  await redo.click();
  await expect(elements).toHaveCount(2);
  await redo.click();
  await expect(elements).toHaveCount(3);
  await page.getByTestId('map-elements-tab').click();
  await expect(library).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(library).toBeVisible();
  await expect(elements).toHaveCount(3);
  let confirmations = 0;
  const cancelDelete = async (dialog: Dialog) => {
    expect(dialog.type()).toBe('confirm');
    confirmations++;
    await dialog.dismiss();
  };
  page.on('dialog', cancelDelete);
  await elements.first().click();
  for (const key of ['Delete', 'Backspace']) {
    await page.getByTestId('element-metadata-label').focus();
    await page.keyboard.press(key);
    expect(confirmations).toBe(0);
    await expect(elements).toHaveCount(3);
  }
  await canvas.click();
  for (const [index, key] of ['Delete', 'Backspace'].entries()) {
    await page.keyboard.press(key);
    expect(confirmations).toBe(index + 1);
    await expect(elements).toHaveCount(3);
  }
  page.off('dialog', cancelDelete);
  for (const key of ['Delete', 'Backspace']) {
    await canvas.click();
    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm');
      await dialog.accept();
    });
    await page.keyboard.press(key);
    await expect(elements).toHaveCount(2);
    await page.keyboard.press('Control+z');
    await expect(elements).toHaveCount(3);
  }
  await page.screenshot({ path: testInfo.outputPath('elementos-copiados.png') });
  expect(errors).toEqual([]);
});
