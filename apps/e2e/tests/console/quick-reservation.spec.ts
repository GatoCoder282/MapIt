import { expect, test } from '@playwright/test';
import { companyAdminFixture } from './company-admin-fixture';

const API = process.env['API_BASE_URL'] ?? 'http://localhost:8080/api/v1';

test('crea una reserva rápida real, conserva el estado físico y bloquea el solapamiento', async ({
  page,
  request,
  baseURL,
}, testInfo) => {
  test.setTimeout(120_000);
  const company = await companyAdminFixture(request);
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
  const floor = await create(`/establishments/${company.venueId}/floors`, { name: 'Planta baja' });
  const sector = await create(`/floors/${floor}/sectors`, {
    name: 'Salón',
    slug: 'salon',
    maxCapacity: 40,
  });
  const table = await create(`/sectors/${sector}/elements`, {
    type: 'TABLE',
    label: 'Mesa 1',
    capacity: 4,
    x: 344,
    y: 244,
    width: 112,
    height: 112,
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
  page.on('console', (message) => {
    if (message.type() === 'error') {
      void testInfo.attach('browser-error.txt', {
        body: message.text(),
        contentType: 'text/plain',
      });
    }
  });
  await page.setViewportSize({ width: 1672, height: 1050 });
  const open = async () => {
    await page.goto(`/map?floorId=${floor}&sectorId=${sector}`);
    await expect(page.getByRole('heading', { name: 'Mapa', exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId('monitor-count-AVAILABLE')).toHaveText('1');
    await page.getByTestId('monitor-canvas').click();
    await page.getByRole('tab', { name: 'Reserva rápida', exact: true }).click();
    await expect(page.getByRole('tabpanel')).toHaveAccessibleName('Reserva rápida');
  };
  await page.goto(`/reservations/new?elementId=${table}&establishmentId=${company.venueId}`);
  await expect(page).toHaveURL(/\/map\?.*panel=quick/, { timeout: 30_000 });
  const panel = page.getByRole('tabpanel');
  await expect(
    panel.getByRole('heading', { name: 'Crear reserva rápida', exact: true }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(panel.getByRole('img', { name: /MapIt/i })).toHaveCount(0);
  await expect(panel.getByText('MapIt', { exact: true })).toHaveCount(0);
  await expect(panel.getByLabel(/Hora de fin|Duración/)).toHaveCount(0);
  const name = panel.getByRole('textbox', { name: /^Nombre completo/ });
  const phoneCountry = panel.getByRole('combobox', { name: 'Código de país' });
  const phoneFlag = panel.getByTestId('quick-booking-phone-flag');
  const phone = panel.getByRole('textbox', { name: /^Número de celular/ });
  const email = panel.getByRole('textbox', { name: /^Correo electrónico/ });
  const date = panel.getByLabel(/^Fecha de reserva/);
  const time = panel.getByLabel(/^Hora de inicio/);
  const people = panel.getByRole('spinbutton', { name: /^Personas/ });
  const notes = panel.getByRole('textbox', { name: /^Notas/ });
  const submit = panel.getByRole('button', { name: 'Crear reserva', exact: true });
  await expect(phoneFlag).toHaveAttribute('src', /\/bo\.png$/);
  await phoneCountry.selectOption('US');
  await expect(phoneFlag).toHaveAttribute('src', /\/us\.png$/);
  await phoneCountry.selectOption('CA');
  await expect(phoneFlag).toHaveAttribute('src', /\/ca\.png$/);
  await phoneCountry.selectOption('ES');
  await expect(phoneFlag).toHaveAttribute('src', /\/es\.png$/);
  await phoneCountry.selectOption('BO');
  await expect
    .poll(() => phoneFlag.evaluate((flag) => (flag as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  await expect(submit).toBeDisabled();
  await name.fill('Ana Reserva');
  await phone.fill('123');
  await expect(submit).toBeDisabled();
  await phone.fill('70001234');
  await phone.focus();
  await page.keyboard.press('Tab');
  await expect(email).toBeFocused();
  await email.fill('correo-invalido');
  await expect(submit).toBeDisabled();
  await email.fill('');
  const future = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/La_Paz' }).format(
    new Date(Date.now() + 2 * 24 * 60 * 60_000),
  );
  await date.fill('2000-01-01');
  await expect(submit).toBeDisabled();
  await date.fill(future);
  await time.fill('18:00');
  await people.fill('5');
  await expect(submit).toBeDisabled();
  await people.fill('3');
  await notes.fill('Cumpleaños. Preferencia junto a la ventana.');
  await expect(panel.getByText('Disponible para reservar.', { exact: true })).toBeVisible();
  await expect(submit).toBeEnabled();
  await page.screenshot({
    path: testInfo.outputPath('reserva-rapida-desktop.png'),
    animations: 'disabled',
  });
  await page.getByRole('complementary', { name: 'Panel del mapa', exact: true }).screenshot({
    path: testInfo.outputPath('reserva-rapida-panel.png'),
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(submit).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: testInfo.outputPath('reserva-rapida-mobile.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 1672, height: 1050 });
  const reservationPath = `/establishments/${company.venueId}/reservations`;
  const createdResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname.endsWith(reservationPath),
  );
  await submit.click();
  const created = await createdResponse;
  const body = await created.text();
  await testInfo.attach('quick-reservation-response.json', {
    body: JSON.stringify(
      { status: created.status(), requestId: created.headers()['x-request-id'], body },
      null,
      2,
    ),
    contentType: 'application/json',
  });
  expect(created.status(), body).toBe(201);
  const submitted = created.request().postDataJSON() as {
    personId: string;
    spaceElementIds: string[];
    startsAt: string;
    endsAt: string;
    partySize: number;
    notes: string;
  };
  expect(submitted).toMatchObject({
    spaceElementIds: [table],
    partySize: 3,
    notes: 'Cumpleaños. Preferencia junto a la ventana.',
  });
  expect(Date.parse(submitted.endsAt) - Date.parse(submitted.startsAt)).toBe(90 * 60_000);
  await expect(page.getByText('Reserva creada.', { exact: true })).toBeVisible();
  const saved = JSON.parse(body) as { id: string };
  const list = await request.get(API + '/reservations', {
    headers,
    params: { establishmentId: company.venueId },
  });
  expect(list.ok()).toBe(true);
  const reservations = (await list.json()) as { id: string; startsAt: string; endsAt: string }[];
  const persisted = reservations.find(({ id }) => id === saved.id)!;
  const { startsAt, endsAt, ...metadata } = submitted;
  expect(persisted).toMatchObject({ id: saved.id, ...metadata });
  expect(Date.parse(persisted.startsAt)).toBe(Date.parse(startsAt));
  expect(Date.parse(persisted.endsAt)).toBe(Date.parse(endsAt));
  const resources = await request.get(API + `/sectors/${sector}/elements`, { headers });
  expect(resources.ok()).toBe(true);
  expect((await resources.json()) as unknown[]).toContainEqual(
    expect.objectContaining({ id: table, state: 'AVAILABLE' }),
  );
  const duplicate = await request.post(API + reservationPath, { headers, data: submitted });
  expect(duplicate.status(), await duplicate.text()).toBe(409);
  await open();
  await name.fill('Ana Segunda');
  await phone.fill('70004321');
  await date.fill(future);
  await time.fill('18:00');
  await people.fill('3');
  await expect(
    panel.getByText('La mesa no está disponible para ese horario.', { exact: true }),
  ).toBeVisible();
  await expect(panel.getByText('Disponible para reservar.', { exact: true })).toHaveCount(0);
  await expect(submit).toBeDisabled();
  await page.screenshot({
    path: testInfo.outputPath('reserva-rapida-solapamiento.png'),
    animations: 'disabled',
  });
  expect(errors).toEqual([]);
});
