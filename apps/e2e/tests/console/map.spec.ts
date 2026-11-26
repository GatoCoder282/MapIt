import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { companyAdminFixture } from './company-admin-fixture';

const API = process.env['API_BASE_URL'] ?? 'http://localhost:8080/api/v1';

test('Mapa conserva la selección entre pestañas y actualiza el estado en vivo', async ({
  page,
  request,
  baseURL,
}) => {
  test.setTimeout(90_000);
  const company = await companyAdminFixture(request);
  const login = await request.post(API + '/auth/global-login', {
    data: { email: company.email, password: company.password },
  });
  expect(login.ok()).toBe(true);
  const session = (await login.json()) as { accessToken: string };
  const headers = { Authorization: 'Bearer ' + session.accessToken };
  const create = async (path: string, data: Record<string, unknown>) => {
    const response = await request.post(API + path, { data, headers });
    expect(response.status(), path).toBe(201);
    return ((await response.json()) as { id: string }).id;
  };
  const floor = await create(`/establishments/${company.venueId}/floors`, { name: 'Piso 1' });
  const sector = await create(`/floors/${floor}/sectors`, {
    name: 'Salón principal',
    slug: 'salon-principal',
    maxCapacity: 40,
  });
  const elementPath = `/sectors/${sector}/elements`;
  const table = await create(elementPath, {
    type: 'TABLE',
    label: 'Mesa 06',
    capacity: 4,
    x: 344,
    y: 244,
    width: 112,
    height: 112,
  });
  const positions = [
    ['Mesa 01', 164, 96, 'CLEANING'],
    ['Mesa 02', 344, 96, 'AVAILABLE'],
    ['Mesa 03', 164, 244, 'AVAILABLE'],
    ['Mesa 04', 524, 244, 'OCCUPIED'],
    ['Mesa 05', 164, 392, 'AVAILABLE'],
    ['Mesa 07', 344, 392, 'OUT_OF_SERVICE'],
    ['Mesa 08', 524, 392, 'AVAILABLE'],
  ] as const;
  await Promise.all(
    positions.map(([label, x, y, initialState]) =>
      create(elementPath, {
        type: 'TABLE',
        label,
        x,
        y,
        initialState,
        capacity: 4,
        width: 112,
        height: 112,
      }),
    ),
  );
  const furniture = [
    { type: 'BAR', x: 48, y: 232, width: 66, height: 270 },
    { type: 'DECOR', x: 46, y: 44, width: 48, height: 48 },
    { type: 'DECOR', x: 694, y: 46, width: 48, height: 48 },
    { type: 'DECOR', x: 694, y: 494, width: 48, height: 48 },
  ];
  await Promise.all(furniture.map((element) => create(elementPath, element)));
  const upperFloor = await create(`/establishments/${company.venueId}/floors`, {
    name: 'Piso 2',
  });
  const terrace = await create(`/floors/${upperFloor}/sectors`, {
    name: 'Terraza',
    slug: 'terraza',
    maxCapacity: 40,
  });
  const alternative = await create(`/sectors/${terrace}/elements`, {
    type: 'TABLE',
    label: 'Mesa 09',
    capacity: 2,
    x: 40,
    y: 40,
    width: 112,
    height: 112,
  });
  const person = await create('/people', { fullName: 'María Gómez' });
  const start = Date.now() + 18 * 60_000;
  await create(`/establishments/${company.venueId}/reservations`, {
    personId: person,
    partySize: 2,
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(start + 90 * 60_000).toISOString(),
    spaceElementIds: [table],
  });
  const statePath = `${API}${elementPath}/${table}/state`;
  expect((await request.patch(statePath, { headers, data: { state: 'RESERVED' } })).status()).toBe(
    200,
  );

  if (process.env['API_BASE_URL']) {
    const wsUrl = new URL('/ws', API);
    wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    await page.route('**/assets/config.json', async (route) => {
      const response = await route.fetch();
      const config = (await response.json()) as Record<string, unknown>;
      await route.fulfill({
        response,
        json: { ...config, apiBaseUrl: API, wsUrl: wsUrl.toString() },
      });
    });
  }
  await page.addInitScript(
    ({ slug, venueId, selectionKey, session, origin }) => {
      if (location.origin !== origin) return;
      sessionStorage.setItem(
        'mapit.auth.session',
        JSON.stringify({ ...session, tenantSlug: slug }),
      );
      localStorage.setItem(selectionKey, venueId);
    },
    {
      slug: company.slug,
      venueId: company.venueId,
      session,
      selectionKey: `mapit.establishment.${company.tenantId}.${company.userId}`,
      origin: new URL(baseURL!).origin,
    },
  );
  let stateFrameReceived = false;
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(message.text());
  });
  page.on('websocket', (socket) => {
    socket.on('framereceived', ({ payload }) => {
      const frame = payload.toString();
      if (
        frame.includes('space-element.state.changed.v1') &&
        frame.includes(table) &&
        /"state"\s*:\s*"OCCUPIED"/.test(frame)
      ) {
        stateFrameReceived = true;
      }
    });
  });

  await page.setViewportSize({ width: 1672, height: 941 });
  await page.goto('/home');
  const mapLink = page.getByRole('link', { name: 'Mapa', exact: true });
  await mapLink.click();
  await expect(page).toHaveURL(/\/map$/);
  await expect(mapLink).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('link', { name: 'Monitoreo de espacios' })).toHaveCount(0);
  await page.goto(`/spaces/monitor?floorId=${floor}&sectorId=${sector}`);
  await expect(page).toHaveURL(new RegExp(`/map.*sectorId=${sector}`), { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Mapa', exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId('monitor-count-AVAILABLE')).toHaveText('5');
  await expect(page.getByTestId('monitor-count-CLEANING')).toHaveText('1');
  await expect(page.getByTestId('monitor-count-RESERVED')).toHaveText('1');

  const detail = page.getByRole('tab', { name: 'Mesa', exact: true });
  const operations = page.getByRole('tab', { name: 'Operaciones', exact: true });
  const quick = page.getByRole('tab', { name: 'Reserva rápida', exact: true });
  const panel = page.getByRole('tabpanel');
  const options = page.getByRole('button', { name: 'Opciones', exact: true });
  const canvas = page.getByTestId('monitor-canvas');
  const mapBounds = await canvas.boundingBox();
  const screenshots = process.env['MAPIT_MAP_QA_SCREENSHOTS'];
  await expect(panel).toHaveCount(0);
  await expect(page.getByText('Conectado', { exact: true })).toBeVisible();
  if (screenshots) {
    await page.screenshot({
      path: join(screenshots, 'mapa-escritorio.png'),
      animations: 'disabled',
    });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await options.click();
  await expect(detail).toBeFocused();
  await expect(page.getByRole('complementary', { name: 'Panel del mapa' })).toHaveCSS(
    'transition-duration',
    '0s',
  );
  const side = page.getByRole('complementary', { name: 'Panel del mapa' });
  const splitMap = await canvas.boundingBox();
  const splitSide = await side.boundingBox();
  expect(splitMap!.width).toBeLessThan(mapBounds!.width);
  expect(splitMap!.width).toBeGreaterThan(splitSide!.width);
  expect(splitMap!.x + splitMap!.width).toBeLessThan(splitSide!.x);
  await detail.focus();
  await detail.press('ArrowRight');
  await expect(operations).toBeFocused();
  await expect(panel).toHaveAccessibleName('Operaciones');
  await expect(panel.getByRole('heading', { name: 'Mesa 06' })).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Mesa 01' })).toHaveCount(0);
  await operations.press('End');
  await expect(quick).toBeFocused();
  await expect(panel).toHaveAccessibleName('Reserva rápida');

  // The central table lies at the center of the fitted 800 × 600 sector.
  await quick.press('Escape');
  await expect(options).toBeFocused();
  expect((await canvas.boundingBox())!.width).toBe(mapBounds!.width);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await canvas.hover();
  const preview = page.getByTestId('monitor-preview');
  await expect(preview).toContainText('Mesa 06');
  await expect(preview).toContainText('María Gómez');
  await expect(preview).toContainText('Capacidad');
  if (screenshots) {
    await page.screenshot({ path: join(screenshots, 'mapa-ficha.png'), animations: 'disabled' });
  }
  await canvas.click();
  await expect(detail).toHaveAttribute('aria-selected', 'true');
  await expect(panel.getByRole('heading', { name: 'Mesa 06' })).toBeVisible();
  await expect(panel.getByText('María Gómez', { exact: true })).toBeVisible();
  await operations.click();
  await detail.click();
  await expect(panel.getByRole('heading', { name: 'Mesa 06' })).toBeVisible();
  await expect(panel).toHaveCount(1);
  await expect
    .poll(async () => {
      const map = await canvas.boundingBox();
      const sidebar = await side.boundingBox();
      return map!.x + map!.width <= sidebar!.x;
    })
    .toBe(true);

  if (screenshots) {
    await page.screenshot({
      path: join(screenshots, 'mapa-opciones.png'),
      animations: 'disabled',
    });
  }
  const changed = await request.patch(statePath, {
    headers,
    data: { state: 'OCCUPIED' },
  });
  expect(changed.status()).toBe(200);
  await expect.poll(() => stateFrameReceived).toBe(true);
  await expect(page.getByTestId('monitor-count-RESERVED')).toHaveText('0');
  await expect(page.getByTestId('monitor-count-OCCUPIED')).toHaveText('2');
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileMap = await canvas.boundingBox();
  const mobileSide = await side.boundingBox();
  expect(mobileSide!.y).toBeGreaterThanOrEqual(mobileMap!.y + mobileMap!.height);
  await operations.click();
  await expect(panel).toHaveAccessibleName('Operaciones');
  await expect(panel.getByText(/Conflicto de reserva/)).toBeVisible();
  await panel.getByRole('button', { name: 'Buscar alternativa' }).click();
  await expect(panel).toHaveAccessibleName('Reserva rápida');
  await expect(panel.getByRole('heading', { name: 'Mesa 09' })).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Mesa 06' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  if (screenshots) {
    await page.screenshot({
      path: join(screenshots, 'mapa-movil.png'),
      fullPage: true,
      animations: 'disabled',
    });
  }
  const result = panel.getByRole('listitem').filter({
    has: page.getByRole('heading', { name: 'Mesa 09' }),
  });
  await result.getByRole('link', { name: 'Reservar' }).click();
  await expect(page).toHaveURL(new RegExp(`/map\\?.*elementId=${alternative}`));
  await expect(panel).toHaveAccessibleName('Reserva rápida');
  await expect(panel.getByRole('heading', { name: 'Mesa 09' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Piso' })).toHaveValue(upperFloor);
  await expect(panel.getByLabel(/^Hora de inicio/)).toHaveValue(/^\d{2}:\d{2}$/);
  await expect(panel.getByLabel(/^Personas/)).toHaveValue('2');
  await detail.click();
  await panel.getByRole('button', { name: 'Crear reserva' }).click();
  await expect(panel.getByRole('heading', { name: 'Crear reserva rápida' })).toBeVisible();

  const name = panel.getByRole('textbox', { name: /^Nombre completo/ });
  await name.fill('Cliente de prueba');
  const discard = page.waitForEvent('dialog');
  const leaving = page.getByRole('link', { name: 'Inicio', exact: true }).first().click();
  const dialog = await discard;
  expect(dialog.message()).toBe(
    'Tienes cambios sin guardar. ¿Quieres descartarlos y salir de esta pantalla?',
  );
  await dialog.dismiss();
  await leaving;
  await expect(name).toHaveValue('Cliente de prueba');
  expect(pageErrors).toEqual([]);
});
