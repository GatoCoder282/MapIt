import { expect, test } from '@playwright/test';
import { companyAdminFixture } from './company-admin-fixture';

const API = process.env['API_BASE_URL'] ?? 'http://localhost:8080/api/v1';

test('diseña una planta sin crear sectores y abre una vista de zona', async ({
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
    const ws = new URL('/ws', API);
    ws.protocol = ws.protocol === 'https:' ? 'wss:' : 'ws:';
    await route.fulfill({
      response,
      json: {
        ...config,
        apiBaseUrl: API,
        wsUrl: ws.toString(),
        unleashProxyUrl: '',
        unleashClientKey: '',
      },
    });
  });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto('/spaces/editor');
  const tree = page.getByRole('complementary', { name: 'Estructura del espacio' });
  await tree.getByRole('button', { name: 'Agregar piso' }).click();
  await tree.getByRole('textbox', { name: 'Nombre' }).fill('Planta nueva');
  await tree.getByRole('button', { name: 'Crear planta' }).click();
  await expect(page).toHaveURL(/\/spaces\/editor\?floorId=[^&]+$/);
  const floorId = new URL(page.url()).searchParams.get('floorId')!;
  await expect(page.getByRole('heading', { name: 'Configurar plano', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('map-canvas')).toBeVisible();
  const dimensions = page.getByTestId('map-plan-dimensions');
  const width = dimensions.getByRole('spinbutton', { name: 'Ancho' });
  const height = dimensions.getByRole('spinbutton', { name: 'Alto' });
  const applyDimensions = dimensions.getByRole('button', { name: 'Aplicar dimensiones' });
  await expect(width).toHaveValue('1200');
  await expect(height).toHaveValue('800');
  await expect(applyDimensions).toBeDisabled();
  await width.fill('10');
  await expect(applyDimensions).toBeDisabled();
  await width.fill('1600');
  await height.fill('1000');
  const resized = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      new URL(response.url()).pathname.endsWith(`/floors/${floorId}/layout`),
  );
  await applyDimensions.click();
  expect((await resized).status()).toBe(200);
  await expect(applyDimensions).toBeDisabled();
  await expect(dimensions.getByRole('link', { name: 'Configurar plano' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Biblioteca de sectores' })).toHaveCount(0);
  await expect(page.getByText('Este piso no tiene sectores.', { exact: true })).toHaveCount(0);
  const configuredLayout = await request.get(API + `/floors/${floorId}/layout`, { headers });
  expect(configuredLayout.ok()).toBe(true);
  expect((await configuredLayout.json()) as { floor: unknown }).toMatchObject({
    floor: { canvasWidth: 1600, canvasHeight: 1000 },
  });
  await page.screenshot({ path: testInfo.outputPath('plano-sin-sectores.png') });
  await page.reload();
  await expect(page.getByTestId('map-canvas')).toBeVisible();
  await expect(width).toHaveValue('1600');
  await expect(height).toHaveValue('1000');
  await page.getByTestId('map-elements-tab').click();
  const library = page.getByRole('region', { name: 'Agregar elemento', exact: true });
  await expect(library).toBeVisible();
  await library.getByRole('button', { name: 'Zonas y escenarios' }).click();
  await page.getByTestId('library-card-base:SECTOR_ZONE').click();
  await library.getByRole('textbox', { name: 'Nombre (opcional)' }).fill('Terraza marcada');
  await page.getByTestId('library-insert').click();
  await library.getByRole('button', { name: 'Mesas', exact: true }).click();
  await page.getByTestId('library-card-base:TABLE').click();
  await library.getByRole('textbox', { name: 'Nombre (opcional)' }).fill('Mesa de terraza');
  await page.getByTestId('library-insert').click();
  await page.getByTestId('map-save').click();
  await expect(page.getByTestId('map-save')).toHaveCount(0);

  const stored = await request.get(API + `/floors/${floorId}/layout`, { headers });
  expect(stored.ok()).toBe(true);
  const { sectors } = (await stored.json()) as {
    sectors: {
      width: number;
      height: number;
      elements: { id: string; type: string; label: string }[];
    }[];
  };
  expect(sectors).toHaveLength(1);
  expect(sectors[0]).toMatchObject({ width: 1600, height: 1000 });
  const items = sectors[0]!.elements;
  expect(items.map(({ label }) => label).sort()).toEqual(['Mesa de terraza', 'Terraza marcada']);
  const zone = items.find(({ type }) => type === 'SECTOR_ZONE')!;

  await page.reload();
  await expect(tree.getByRole('button', { name: 'Pisos y zonas' })).toBeVisible();
  await expect(tree.getByRole('button', { name: 'Agregar sector', exact: true })).toHaveCount(0);
  const zoneButton = tree.getByRole('button', { name: 'Terraza marcada', exact: true });
  await zoneButton.click();
  await expect(page).toHaveURL(new RegExp('zoneId=' + zone.id));
  await expect(zoneButton).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('map-elements-tab')).toBeDisabled();
  await expect(page.getByTestId('map-canvas')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('vista-zona.png') });

  await tree.getByRole('button', { name: 'Planta nueva', exact: true }).click();
  await expect(page).not.toHaveURL(/zoneId=/);
  await expect(page.getByTestId('map-elements-tab')).toBeEnabled();
});
