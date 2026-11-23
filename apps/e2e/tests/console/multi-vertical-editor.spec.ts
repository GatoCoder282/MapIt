import { expect, test } from '@playwright/test';
import { companyAdminFixture, type CompanyVertical } from './company-admin-fixture';

const API = process.env['API_BASE_URL'] ?? 'http://localhost:8080/api/v1';
const cases: {
  vertical: CompanyVertical;
  category: string;
  model: string;
  variant: string;
  type: string;
  capacity: string;
}[] = [
  {
    vertical: 'RESTAURANT',
    category: 'Mesas',
    model: 'base:TABLE',
    variant: 'round',
    type: 'TABLE',
    capacity: '4',
  },
  {
    vertical: 'NIGHTCLUB',
    category: 'Mesas y VIP',
    model: 'model:vip-round',
    variant: 'vip-round',
    type: 'TABLE',
    capacity: '6',
  },
  {
    vertical: 'HOTEL',
    category: 'Habitaciones',
    model: 'model:room-single',
    variant: 'room-single',
    type: 'ROOM',
    capacity: '1',
  },
  {
    vertical: 'EVENT_HALL',
    category: 'Mesas y montaje',
    model: 'base:TABLE',
    variant: 'round',
    type: 'TABLE',
    capacity: '8',
  },
];

for (const scenario of cases) {
  test(`${scenario.vertical}: inserta, edita y recupera el modelo del editor compartido`, async ({
    page,
    request,
    baseURL,
  }, testInfo) => {
    test.setTimeout(90_000);
    const company = await companyAdminFixture(request, scenario.vertical);
    const login = await request.post(API + '/auth/global-login', {
      data: { email: company.email, password: company.password },
    });
    expect(login.ok()).toBe(true);
    const session = (await login.json()) as { accessToken: string };
    const headers = { Authorization: 'Bearer ' + session.accessToken };
    const create = async (path: string, data: Record<string, unknown>) => {
      const response = await request.post(API + path, { headers, data });
      expect(response.status(), await response.text()).toBe(201);
      return ((await response.json()) as { id: string }).id;
    };
    const floorId = await create(`/establishments/${company.venueId}/floors`, {
      name: 'Principal',
    });
    const sectorId = await create(`/floors/${floorId}/sectors`, {
      name: 'Sector de prueba',
      slug: 'sector-prueba',
      maxCapacity: 100,
    });
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
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
      void testInfo.attach('javascript-error.txt', {
        body: error.stack ?? error.message,
        contentType: 'text/plain',
      });
    });
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(`/spaces/editor/${sectorId}?floorId=${floorId}`);
    await page.getByTestId('map-elements-tab').click();
    const library = page.getByRole('region', { name: 'Agregar elemento', exact: true });
    const category = library.getByRole('button', { name: scenario.category, exact: true });
    await expect(category).toBeVisible();
    await expect(category).toHaveAttribute('aria-pressed', 'true');
    const model = page.getByTestId('library-card-' + scenario.model);
    await expect(model).toBeVisible();
    if (scenario.vertical === 'HOTEL') {
      await expect(page.getByTestId('library-card-base:TABLE')).toHaveCount(0);
    }
    await model.click();
    const label = scenario.vertical === 'HOTEL' ? 'Habitación 101' : 'Recurso ' + scenario.vertical;
    await library
      .getByRole('textbox', {
        name: scenario.vertical === 'HOTEL' ? 'Identificación de habitación' : 'Nombre (opcional)',
        exact: true,
      })
      .fill(label);
    await library.getByRole('spinbutton', { name: /Capacidad/ }).fill(scenario.capacity);
    await page.getByTestId('library-insert').click();
    await expect(page.getByTestId('map-element-row')).toHaveCount(1);
    await expect(page.getByTestId('element-metadata-label')).toHaveValue(label);
    await expect(page.getByTestId('element-metadata-capacity')).toHaveValue(scenario.capacity);
    await page.getByTestId('map-element-x').fill('80');
    await page.getByTestId('map-element-x').blur();
    const savedResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        new URL(response.url()).pathname.endsWith(`/sectors/${sectorId}/layout`),
    );
    await page.getByTestId('map-save').click();
    const saved = await savedResponse;
    const savedBody = await saved.text();
    await testInfo.attach('layout-save.json', {
      body: JSON.stringify(
        { status: saved.status(), requestId: saved.headers()['x-request-id'], body: savedBody },
        null,
        2,
      ),
      contentType: 'application/json',
    });
    expect(saved.status(), savedBody).toBe(200);
    await expect(page.getByTestId('map-save')).toHaveCount(0);
    const persisted = await request.get(API + `/floors/${floorId}/layout`, { headers });
    expect(persisted.status(), await persisted.text()).toBe(200);
    const layout = (await persisted.json()) as {
      sectors: {
        id: string;
        elements: { id: string; type: string; label: string; capacity: number; x: number }[];
        appearance: { elements: Record<string, { variant?: string }> };
      }[];
    };
    const sector = layout.sectors.find((item) => item.id === sectorId)!;
    expect(sector.elements).toHaveLength(1);
    const element = sector.elements[0]!;
    expect(element).toMatchObject({
      type: scenario.type,
      label,
      capacity: Number(scenario.capacity),
      x: 80,
    });
    expect(sector.appearance.elements[element.id]?.variant).toBe(scenario.variant);
    await page.reload();
    await page.getByTestId('map-elements-tab').click();
    const row = page.getByTestId('map-element-row');
    await expect(row).toHaveCount(1);
    await row.click();
    await expect(page.getByTestId('element-metadata-label')).toHaveValue(label);
    await expect(page.getByTestId('element-metadata-capacity')).toHaveValue(scenario.capacity);
    await expect(page.getByTestId('map-element-x')).toHaveValue('80');
    await expect(page.getByTestId('map-save')).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath(scenario.vertical.toLowerCase() + '-editor.png'),
      animations: 'disabled',
    });
    await page.setViewportSize({ width: 430, height: 932 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      430,
    );
    await page.screenshot({
      path: testInfo.outputPath(scenario.vertical.toLowerCase() + '-mobile.png'),
      fullPage: true,
      animations: 'disabled',
    });
    expect(errors).toEqual([]);
  });
}
