import { expect, test, type WebSocketRoute } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fixtureFile, type LiveFixture } from './setup';
import type { PublicAvailabilityMap } from '../../../../libs/api-client/src/lib/generated/model/public-availability-map';

test('QR-first → inspector → mapa por intervalo → policy ADMIN → webhook/STOMP/HTTP → recibo sin llegada', async ({
  page,
  context,
  request,
}, testInfo) => {
  test.setTimeout(180000);
  const fixture = JSON.parse(readFileSync(fixtureFile, 'utf8')) as LiveFixture;
  const database = (sql: string): Record<string, unknown> =>
    JSON.parse(
      execFileSync(
        'docker',
        ['exec', fixture.container, 'psql', '-U', 'mapit', '-d', 'mapit', '-At', '-c', sql],
        { encoding: 'utf8' },
      ),
    ) as Record<string, unknown>;
  const persistedState = (): Record<string, unknown> => {
    expect(reservationId).toMatch(/^[0-9a-f-]{36}$/i);
    return database(`select json_build_object(
      'reservation', (select status from reservation where tenant_id='${fixture.tenant}' and id='${reservationId}'),
      'space', (select state from space_element where tenant_id='${fixture.tenant}' and id='${fixture.element}'),
      'events', (select count(*) from payment_webhook_event where tenant_id='${fixture.tenant}' and payment_id in (select id from payment where tenant_id='${fixture.tenant}' and reservation_id='${reservationId}'))
    )`);
  };
  const paymentEvents: Record<string, unknown>[] = [];
  const failures: string[] = [];
  const publicAuthorization: string[] = [];
  const simulationRequests: string[] = [];
  const publicStaffRequests: string[] = [];
  const policyWrites: string[] = [];
  let publicReservationWrites = 0;
  let initialStart: { url: string; methodId: string; requestId: string } | null = null;
  let reservationId = '';

  await context.route('**/assets/config.json', (route) =>
    route.fulfill({
      json: {
        apiBaseUrl: fixture.api,
        wsUrl: fixture.ws,
        consoleBaseUrl: 'http://localhost:4400',
        paymentPublicOrigin: 'http://localhost:4500',
        environment: 'development',
        paymentPreviewEnabled: false,
        unleashProxyUrl: '',
        unleashClientKey: '',
      },
    }),
  );
  page.on('pageerror', (error) => failures.push(error.message));
  context.on('request', (outgoing) => {
    if (outgoing.url().endsWith('/payment-policy') && outgoing.method() === 'PUT')
      policyWrites.push(outgoing.url());
    if (
      outgoing.url().startsWith(fixture.api) &&
      outgoing.frame().page().url().startsWith('http://localhost:4500') &&
      !outgoing.url().startsWith(fixture.api + '/public/')
    )
      publicStaffRequests.push(outgoing.url());
    if (
      outgoing.url().startsWith(fixture.api + '/public/') &&
      outgoing.url().endsWith('/reservations') &&
      outgoing.method() === 'POST'
    )
      publicReservationWrites++;
    if (outgoing.url().startsWith(fixture.api + '/public/') && outgoing.headers()['authorization'])
      publicAuthorization.push(outgoing.url());
    if (
      outgoing.url().startsWith(fixture.api + '/public/') &&
      outgoing.url().endsWith('/simulate') &&
      outgoing.method() === 'POST'
    )
      simulationRequests.push(outgoing.url());
    if (
      !initialStart &&
      outgoing.url().startsWith(fixture.api + '/public/') &&
      outgoing.url().includes('/payments') &&
      !outgoing.url().endsWith('/simulate') &&
      outgoing.method() === 'POST'
    ) {
      const body = outgoing.postDataJSON() as { methodId?: unknown; requestId?: unknown };
      if (typeof body.methodId === 'string' && typeof body.requestId === 'string')
        initialStart = { url: outgoing.url(), methodId: body.methodId, requestId: body.requestId };
    }
  });
  page.on('websocket', (socket) => {
    socket.on('framereceived', ({ payload }) => {
      const frame = String(payload);
      const separator = frame.indexOf('\n\n');
      if (separator < 0) return;
      try {
        const event = JSON.parse(frame.slice(separator + 2).replace(/\0+$/, '')) as Record<
          string,
          unknown
        >;
        if (
          event['eventType'] === 'payment.status.changed' &&
          event['reservationId'] === reservationId
        )
          paymentEvents.push(event);
      } catch {
        // STOMP control frames are not JSON application events.
      }
    });
  });
  await context.addInitScript((session) => {
    if (location.origin === 'http://localhost:4400')
      sessionStorage.setItem('mapit.auth.session', JSON.stringify(session));
  }, fixture.session);
  const consolePage = await context.newPage();
  await consolePage.goto('http://localhost:4400/administration/settings/payment-methods');
  await expect(
    consolePage.getByRole('heading', { name: 'Configuración QR propio', exact: true }),
  ).toBeVisible({ timeout: 60000 });

  const venue = consolePage.getByRole('combobox', { name: 'Establecimiento', exact: true });
  const country = consolePage.getByRole('combobox', { name: 'País', exact: true });
  const save = consolePage.getByRole('button', { name: 'Guardar configuración', exact: true });
  await expect(venue).toBeEnabled();
  await venue.fill('Navegador — Norte');
  await expect(consolePage.getByRole('option')).toContainText('Navegador — Norte');
  await venue.press('ArrowDown');
  await venue.press('Enter');
  await country.fill('BO');
  await consolePage.getByRole('option', { name: 'Bolivia (BO)', exact: true }).click();
  await consolePage.getByLabel('Banco', { exact: true }).fill('Banco de prueba');
  await consolePage.getByLabel('Titular de la cuenta', { exact: true }).fill('Titular simulado');
  await consolePage.getByLabel('Referencia de cuenta', { exact: true }).fill('REFERENCIA-DEMO');
  const qrCreatedResponse = consolePage.waitForResponse(
    (response) =>
      response.url() === fixture.api + '/payment-methods/mock-qr' &&
      response.request().method() === 'POST',
  );
  await save.click();
  const qrCreated = await qrCreatedResponse;
  expect(qrCreated.status()).toBe(201);
  const qrConfiguration = (await qrCreated.json()) as {
    enabled: boolean;
    establishmentId: string;
    simulationPath: string;
  };
  expect(qrConfiguration).toMatchObject({ enabled: true, establishmentId: fixture.venue });
  expect(qrConfiguration.simulationPath).toMatch(/^\/simulacion\/qr\/[0-9a-f-]{36}$/i);
  await expect(consolePage.getByRole('img', { name: /QR de prueba de MapIt/ })).toBeVisible();
  const staffHeaders = { Authorization: 'Bearer ' + String(fixture.session['accessToken']) };
  const readinessEndpoint = fixture.api + `/establishments/${fixture.venue}/payment-readiness`;
  const readiness = await request.get(readinessEndpoint, { headers: staffHeaders });
  expect(await readiness.json()).toMatchObject({
    qrEnabled: true,
    ready: false,
    policy: null,
    blockers: ['POLICY_MISSING'],
  });
  await expect(consolePage.getByTestId('readiness-blockers')).toBeVisible();
  await testInfo.attach('qr-first-policy-missing', {
    body: await consolePage.screenshot({
      mask: [consolePage.getByRole('img'), consolePage.getByRole('link')],
    }),
    contentType: 'image/png',
  });
  await expect(consolePage.getByTestId('policy-currency')).toHaveValue('');
  await expect(consolePage.getByTestId('policy-deposit')).toHaveValue('');
  await expect(consolePage.getByTestId('policy-window')).toHaveValue('');
  expect(policyWrites).toHaveLength(0);

  // The fixture has geometry, not labels: exercise the actual inspector and authenticated CRUD.
  const editor = await context.newPage();
  editor.on('pageerror', (error) => failures.push(error.message));
  const editorUrl = `http://localhost:4400/spaces/editor/${fixture.sector}?establishmentId=${fixture.venue}`;
  await editor.goto(editorUrl);
  await editor.getByRole('option').filter({ hasText: '(100, 90)' }).click();
  await expect(editor.getByTestId('element-metadata-label')).toHaveValue('');
  await expect(editor.getByTestId('element-metadata-capacity')).toHaveValue('');
  const elementEndpoint = fixture.api + `/sectors/${fixture.sector}/elements/${fixture.element}`;
  await editor.getByTestId('element-metadata-label').fill('Mesa ventana QA');
  await editor.getByTestId('element-metadata-capacity').fill('4');
  const metadataSaved = editor.waitForResponse(
    (response) => response.url() === elementEndpoint && response.request().method() === 'PUT',
  );
  await editor.getByTestId('element-metadata-save').click();
  expect((await metadataSaved).ok()).toBe(true);
  await editor.reload();
  await editor.getByRole('option').filter({ hasText: '(100, 90)' }).click();
  await expect(editor.getByTestId('element-metadata-label')).toHaveValue('Mesa ventana QA');
  await expect(editor.getByTestId('element-metadata-capacity')).toHaveValue('4');
  const persistedElementResponse = await request.get(elementEndpoint, { headers: staffHeaders });
  expect(persistedElementResponse.ok()).toBe(true);
  const descriptor = (await persistedElementResponse.json()) as {
    id: string;
    name: string;
    label: string;
    capacity: number;
    x: number;
    y: number;
  };
  expect(descriptor).toMatchObject({
    id: fixture.element,
    name: 'Mesa ventana QA',
    label: 'Mesa ventana QA',
    capacity: 4,
  });
  await editor.close();

  await page.goto('/reservas?tenantSlug=' + fixture.tenant);
  await expect(page.getByTestId('catalog-establishment-' + fixture.venue)).toContainText(
    'Navegador — Norte',
  );
  await expect(page.getByTestId('catalog-establishment-' + fixture.otherVenue)).toContainText(
    'Navegador — Centro',
  );
  await page
    .getByTestId('catalog-establishment-' + fixture.venue)
    .getByTestId('catalog-availability')
    .click();
  await expect(page).toHaveURL(new RegExp('/disponibilidad/' + fixture.tenant + '/venue'));
  const searchMap = async (
    slug: string,
    startTime: string,
    endTime: string,
  ): Promise<PublicAvailabilityMap> => {
    await page.getByLabel('Fecha de reserva', { exact: true }).fill(fixture.date);
    await page.getByLabel('Hora de inicio', { exact: true }).fill(startTime);
    await page.getByLabel('Hora de fin', { exact: true }).fill(endTime);
    const mapResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/establishments/${slug}/availability/map?`) &&
        response.request().method() === 'GET',
    );
    await page.getByRole('button', { name: 'Buscar espacios', exact: true }).click();
    const response = await mapResponse;
    expect(response.ok()).toBe(true);
    const data = (await response.json()) as PublicAvailabilityMap;
    expect(data).toMatchObject({
      establishmentSlug: slug,
      mode: 'INTERVAL',
      date: fixture.date,
      startTime,
      endTime,
      timezone: 'America/La_Paz',
    });
    const forbidden = [
      'attributes',
      'state',
      'customer',
      'email',
      'phone',
      'reservationId',
      'accessToken',
      'merchantReference',
    ];
    const assertAllowlist = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) {
        expect(forbidden.includes(key)).toBe(false);
        assertAllowlist(child);
      }
    };
    assertAllowlist(data);
    return data;
  };
  await searchMap('venue', '10:30', '11:30');
  await expect(page.getByTestId('space-' + fixture.element)).toBeDisabled();
  await expect(page.getByTestId('space-' + fixture.unavailableElement)).toBeDisabled();
  await expect(page.getByTestId('availability-continue')).toHaveCount(0);
  await page.goto(`/disponibilidad/${fixture.tenant}/centro`);
  await searchMap('centro', fixture.start, fixture.end);
  await page.getByTestId('space-' + fixture.otherElement).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('space-' + fixture.otherElement)).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.goto(`/disponibilidad/${fixture.tenant}/venue`);
  const publicMap = await searchMap('venue', fixture.start, fixture.end);
  await expect(page.getByTestId('availability-selection')).toHaveCount(0);
  const sector = publicMap.floors
    .flatMap((floor) => floor.sectors)
    .find((item) => item.id === fixture.sector)!;
  const mappedElement = sector.elements.find((item) => item.id === fixture.element)!;
  expect(mappedElement).toMatchObject({
    id: descriptor.id,
    name: descriptor.name,
    capacity: descriptor.capacity,
    availability: 'AVAILABLE',
    selectable: true,
    x: descriptor.x,
    y: descriptor.y,
  });
  expect(sector.elements.find((item) => item.id === fixture.spareElement)).toMatchObject({
    label: null,
    capacity: null,
    name: 'Mesa sin nombre',
  });
  const mapHost = page.getByRole('img', { name: /^Plano/ });
  await expect(mapHost).toBeVisible();
  await expect(mapHost.locator('canvas').first()).toBeVisible();
  await mapHost.scrollIntoViewIfNeeded();
  const bounds = await mapHost.boundingBox();
  expect(bounds).not.toBeNull();
  const radians = (mappedElement.rotation * Math.PI) / 180;
  const point = {
    x:
      bounds!.x +
      mappedElement.x +
      (mappedElement.width / 2) * Math.cos(radians) -
      (mappedElement.height / 2) * Math.sin(radians),
    y:
      bounds!.y +
      mappedElement.y +
      (mappedElement.width / 2) * Math.sin(radians) +
      (mappedElement.height / 2) * Math.cos(radians),
  };
  await page.mouse.click(point.x, point.y);
  await expect(page.getByTestId('space-' + fixture.element)).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByTestId('availability-selection')).toContainText(descriptor.name);
  await testInfo.attach('real-canvas-selection', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  const pixels = async (): Promise<string> =>
    mapHost.evaluate(async (host) => {
      await new Promise<void>((done) =>
        requestAnimationFrame(() => requestAnimationFrame(() => done())),
      );
      return host.querySelector('canvas')!.toDataURL();
    });
  await page.mouse.move(bounds!.x + 2, bounds!.y + 2);
  const selectedPixels = await pixels();
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + mappedElement.width / 2, point.y + mappedElement.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
  await page.mouse.move(bounds!.x + 2, bounds!.y + 2);
  await expect.poll(async () => (await pixels()) === selectedPixels).toBe(true);
  await page.getByTestId('space-' + fixture.spareElement).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('space-' + fixture.spareElement)).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect.poll(async () => (await pixels()) !== selectedPixels).toBe(true);
  await page.getByTestId('space-' + fixture.element).focus();
  await page.keyboard.press('Enter');
  expect(publicReservationWrites).toBe(0);
  expect(publicStaffRequests).toEqual([]);
  await page.getByTestId('availability-continue').click();
  await expect(page).toHaveURL(
    new RegExp('/reservar/' + fixture.tenant + '/venue/' + fixture.element),
  );
  await expect(page.getByTestId('booking-descriptor')).toContainText(descriptor.name);
  await page.reload();
  await expect(page.getByTestId('booking-descriptor')).toContainText(descriptor.name);
  await expect(page.getByTestId('booking-descriptor')).toContainText('Terraza');
  await page.getByTestId('booking-confirm').click();
  await page.getByLabel('Nombre completo').fill('Cliente navegador');
  await page.getByLabel('Correo electrónico').fill('guest@browser.test');
  const bookingCreated = page.waitForResponse(
    (response) =>
      response.url().endsWith('/establishments/venue/reservations') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Crear reserva', exact: true }).click();
  const bookingResponse = await bookingCreated;
  expect(bookingResponse.status()).toBe(201);
  const bookingPayload: unknown = bookingResponse.request().postDataJSON();
  // Real contention response, not an intercepted 409; UI recovery has store coverage.
  const conflictingBooking = await request.post(bookingResponse.url(), {
    data: bookingPayload,
  });
  expect(conflictingBooking.status()).toBe(409);
  expect(bookingPayload).toMatchObject({
    date: fixture.date,
    startTime: fixture.start,
    endTime: fixture.end,
    spaceElementIds: [fixture.element],
  });
  await expect(page.getByTestId('booking-own-space')).toContainText(descriptor.name);
  await page.getByTestId('booking-checkout').click();
  await expect(page.getByTestId('checkout-page')).toBeVisible();
  await expect(page.getByText(descriptor.name, { exact: true })).toBeVisible();
  const checkoutUrl = new URL(page.url());
  const routeParts = checkoutUrl.pathname.split('/');
  reservationId = routeParts[4] ?? '';
  expect(routeParts.slice(1, 4)).toEqual(['pago', fixture.tenant, 'venue']);
  const reservationAccess = new URLSearchParams(checkoutUrl.hash.slice(1)).get('access');
  expect(reservationAccess).toMatch(/^[A-Za-z0-9_-]{43}$/);
  type CheckoutState = {
    reservation: {
      spaces: {
        id: string;
        name: string;
        label: string | null;
        capacity: number | null;
        floor: string;
        sector: string;
      }[];
    };
    available: boolean;
    amount: string | null;
    currency: string | null;
    methods: { id: string; provider: string; simulationPath: string | null }[];
    historicalMethod: { id: string; provider: string; simulationPath: string | null } | null;
    payment: {
      id: string;
      provider: string;
      status: string;
      amount: string;
      currency: string;
      expiresAt: string;
    } | null;
  };
  const checkoutEndpoint =
    `${fixture.api}/public/tenants/${fixture.tenant}` +
    `/establishments/venue/reservations/${reservationId}/checkout`;
  const readCheckout = async (): Promise<CheckoutState> => {
    const response = await request.get(checkoutEndpoint, {
      headers: { 'X-Reservation-Access': reservationAccess! },
    });
    expect(response.ok()).toBe(true);
    return (await response.json()) as CheckoutState;
  };
  const blocked = await readCheckout();
  expect(blocked).toMatchObject({
    available: false,
    amount: null,
    currency: null,
    payment: null,
    methods: [],
  });
  expect(blocked.reservation.spaces).toEqual([
    expect.objectContaining({
      id: descriptor.id,
      name: descriptor.name,
      label: descriptor.label,
      capacity: 4,
      floor: 'Planta principal',
      sector: 'Terraza',
    }),
  ]);
  await expect(page.getByTestId('attempt-qr')).toHaveCount(0);
  expect(
    database(
      `select json_build_object('policies',(select count(*) from payment_policy where tenant_id='${fixture.tenant}'), 'quotes',(select count(*) from reservation_payment_quote where tenant_id='${fixture.tenant}'), 'payments',(select count(*) from payment where tenant_id='${fixture.tenant}'))`,
    ),
  ).toEqual({ policies: 0, quotes: 0, payments: 0 });
  expect(policyWrites).toHaveLength(0);
  // Explicit TEST values, not authorization or defaults for any real business.
  await consolePage.getByTestId('policy-currency').fill('BOB');
  await consolePage.getByTestId('policy-deposit').fill('120.00');
  await consolePage.getByTestId('policy-total').fill('400.00');
  await consolePage.getByTestId('policy-window').fill('30');
  await consolePage.getByTestId('policy-enabled-true').check();
  const policySaved = consolePage.waitForResponse(
    (response) =>
      response.url() === fixture.api + `/establishments/${fixture.venue}/payment-policy` &&
      response.request().method() === 'PUT',
  );
  await consolePage.getByTestId('policy-save').click();
  expect((await policySaved).ok()).toBe(true);
  await consolePage.reload();
  await expect(consolePage.getByTestId('policy-deposit')).toHaveValue('120.00');
  expect(
    await (await request.get(readinessEndpoint, { headers: staffHeaders })).json(),
  ).toMatchObject({ ready: true, blockers: [] });
  expect(
    await (
      await request.get(fixture.api + `/establishments/${fixture.otherVenue}/payment-readiness`, {
        headers: staffHeaders,
      })
    ).json(),
  ).toMatchObject({ policy: null, ready: false });
  expect(policyWrites).toEqual([fixture.api + `/establishments/${fixture.venue}/payment-policy`]);
  await page.getByTestId('refresh-payment').click();
  await expect(page.getByTestId('method-mock')).toBeVisible();
  const checkout = await readCheckout();
  expect(persistedState()).toMatchObject({ reservation: 'CREATED', space: 'AVAILABLE', events: 0 });
  expect(checkout).toMatchObject({ available: true, amount: '120.00', currency: 'BOB' });
  const initialMockMethods = checkout.methods.filter(
    (method) => method.provider === 'MOCK_GATEWAY',
  );
  expect(initialMockMethods).toHaveLength(1);
  expect(initialMockMethods[0]?.simulationPath).toBe(qrConfiguration.simulationPath);
  const mockMethod = initialMockMethods[0]!;
  await expect(page.getByTestId('checkout-page')).toBeVisible();
  await expect(page.getByTestId('preview-banner')).toHaveCount(0);
  await expect(page.getByTestId('method-mock')).toBeVisible();
  await page.getByTestId('method-mock').check();
  const expectAttemptUrl = (url: URL, paymentId: string): void => {
    expect(url.origin).toBe('http://localhost:4500');
    expect(url.pathname).toBe(qrConfiguration.simulationPath);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      tenant: fixture.tenant,
      establecimiento: 'venue',
      reserva: reservationId,
      pago: paymentId,
    });
    expect(url.hash).toMatch(/^#access=[A-Za-z0-9_-]{43}$/);
  };

  const startedResponse = page.waitForResponse(
    (response) =>
      response.url().startsWith(fixture.api + '/public/') &&
      response.url().includes('/payments') &&
      !response.url().endsWith('/simulate') &&
      response.request().method() === 'POST',
  );
  await page.getByTestId('start-payment').click();
  const started = await startedResponse;
  expect(started.status()).toBe(201);
  await expect(page.getByTestId('payment-status')).toHaveAttribute('data-status', 'PENDING');
  const startedCheckout = await readCheckout();
  const cancelledPayment = startedCheckout.payment!;
  expect(cancelledPayment).toMatchObject({
    provider: 'MOCK_GATEWAY',
    status: 'PENDING',
  });
  expect(startedCheckout.historicalMethod).toMatchObject({
    id: mockMethod.id,
    provider: 'MOCK_GATEWAY',
    simulationPath: qrConfiguration.simulationPath,
  });
  await expect(page.getByTestId('attempt-qr').getByRole('img')).toBeVisible();
  await expect(page.getByTestId('checkout-qr')).toHaveCount(0);
  expect(cancelledPayment).toMatchObject({ amount: checkout.amount, currency: checkout.currency });

  const simulationHref = await page.getByTestId('payment-simulation-link').getAttribute('href');
  expect(simulationHref).toBeTruthy();
  const firstSimulationUrl = new URL(simulationHref!, page.url());
  expectAttemptUrl(firstSimulationUrl, cancelledPayment.id);
  expect(simulationRequests).toHaveLength(0);
  expect(persistedState()).toMatchObject({ reservation: 'CREATED', space: 'AVAILABLE', events: 0 });
  const simulationPage = await context.newPage();
  simulationPage.on('pageerror', (error) => failures.push(error.message));
  await simulationPage.goto(firstSimulationUrl.href);
  await expect(simulationPage.getByTestId('qr-simulation-page')).toBeVisible();
  await expect(simulationPage.getByTestId('simulate-confirm')).toBeVisible();
  await expect(simulationPage.getByTestId('simulate-cancel')).toBeVisible();
  await expect(simulationPage.getByTestId('simulate-fail')).toHaveCount(0);
  await expect(page.getByTestId('payment-status')).toHaveAttribute('data-status', 'PENDING');
  expect(simulationRequests).toHaveLength(0);
  expect(
    paymentEvents.some(
      (event) =>
        event['paymentId'] === cancelledPayment.id &&
        ['CONFIRMED', 'FAILED', 'EXPIRED', 'CANCELLED'].includes(String(event['status'])),
    ),
  ).toBe(false);

  const cancelledResponse = simulationPage.waitForResponse(
    (response) =>
      response.url().startsWith(fixture.api + '/public/') &&
      response.url().endsWith('/payments/' + cancelledPayment.id + '/simulate') &&
      response.request().method() === 'POST',
  );
  await simulationPage.getByTestId('simulate-cancel').click();
  const cancelled = await cancelledResponse;
  expect(cancelled.ok()).toBe(true);
  expect((await readCheckout()).payment).toMatchObject({
    id: cancelledPayment.id,
    status: 'CANCELLED',
  });
  await expect
    .poll(() =>
      paymentEvents.some(
        (event) =>
          event['reservationId'] === reservationId &&
          event['paymentId'] === cancelledPayment.id &&
          event['status'] === 'CANCELLED',
      ),
    )
    .toBe(true);
  await expect(page.getByTestId('payment-status')).toHaveAttribute('data-status', 'CANCELLED');
  expect(persistedState()).toMatchObject({ reservation: 'CREATED', space: 'AVAILABLE', events: 1 });
  await simulationPage.reload();
  await expect(simulationPage.getByTestId('simulation-result')).toBeVisible();
  await expect(simulationPage.getByTestId('simulate-confirm')).toHaveCount(0);
  await expect(simulationPage.getByTestId('simulate-cancel')).toHaveCount(0);
  expect(simulationRequests).toHaveLength(1);
  await page.reload();
  await expect(page.getByTestId('payment-status')).toHaveAttribute('data-status', 'CANCELLED');
  expect((await readCheckout()).available).toBe(true);
  expect(initialStart).not.toBeNull();
  const access = new URLSearchParams(new URL(page.url()).hash.slice(1)).get('access');
  expect(access).toMatch(/^[A-Za-z0-9_-]{43}$/);
  const replayedStart = await request.post(initialStart!.url, {
    headers: { 'X-Reservation-Access': access! },
    data: { methodId: initialStart!.methodId, requestId: initialStart!.requestId },
  });
  expect(replayedStart.ok()).toBe(true);
  expect(await replayedStart.json()).toMatchObject({
    id: cancelledPayment.id,
    status: 'CANCELLED',
  });
  if (!simulationPage.isClosed()) await simulationPage.close();
  await page.setViewportSize({ width: 390, height: 844 });

  const confirmedStartedResponse = page.waitForResponse(
    (response) =>
      response.url().startsWith(fixture.api + '/public/') &&
      response.url().includes('/payments') &&
      !response.url().endsWith('/simulate') &&
      response.request().method() === 'POST',
  );
  await page.getByTestId('start-payment').click();
  const confirmedStarted = await confirmedStartedResponse;
  expect(confirmedStarted.status()).toBe(201);
  await expect(page.getByTestId('payment-status')).toHaveAttribute('data-status', 'PENDING');
  const confirmedCheckout = await readCheckout();
  const confirmedPayment = confirmedCheckout.payment!;
  const forgedWebhook = await request.post(fixture.api + '/public/payments/mock/webhook', {
    headers: {
      'X-Mock-Timestamp': String(Math.floor(Date.now() / 1000)),
      'X-Mock-Signature': '0'.repeat(64),
    },
    data: { paymentId: confirmedPayment.id, outcome: 'CONFIRMED' },
  });
  expect(forgedWebhook.status()).toBe(401);
  expect(persistedState()).toMatchObject({ reservation: 'CREATED', space: 'AVAILABLE', events: 1 });
  expect(confirmedPayment.id).not.toBe(cancelledPayment.id);
  expect(confirmedPayment).toMatchObject({
    provider: 'MOCK_GATEWAY',
    status: 'PENDING',
    amount: cancelledPayment.amount,
    currency: cancelledPayment.currency,
    expiresAt: cancelledPayment.expiresAt,
  });
  expect(confirmedCheckout.historicalMethod).toMatchObject({
    id: mockMethod.id,
    provider: 'MOCK_GATEWAY',
    simulationPath: qrConfiguration.simulationPath,
  });
  const confirmationSimulationHref = await page
    .getByTestId('payment-simulation-link')
    .getAttribute('href');
  expect(confirmationSimulationHref).toBeTruthy();
  await expect(page.getByTestId('attempt-qr').getByRole('img')).toBeVisible();
  const confirmationSimulationUrl = new URL(confirmationSimulationHref!, page.url());
  expectAttemptUrl(confirmationSimulationUrl, confirmedPayment.id);
  expect(confirmationSimulationUrl.href).not.toBe(firstSimulationUrl.href);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await testInfo.attach('mobile-live-attempt-qr-redacted', {
    body: await page.screenshot({ mask: [page.getByRole('img'), page.getByRole('link')] }),
    contentType: 'image/png',
  });

  const recoveryPage = await context.newPage();
  recoveryPage.on('pageerror', (error) => failures.push(error.message));
  const sockets: WebSocketRoute[] = [];
  let disconnected = false;
  await recoveryPage.routeWebSocket('**/ws', async (socket) => {
    if (disconnected) await socket.close({ code: 1011, reason: 'E2E transport unavailable' });
    else {
      socket.connectToServer();
      sockets.push(socket);
    }
  });
  await recoveryPage.goto(page.url());
  await expect(recoveryPage.getByTestId('payment-status')).toHaveAttribute(
    'data-status',
    'PENDING',
  );
  await expect.poll(() => sockets.length).toBeGreaterThan(0);
  disconnected = true;
  for (const socket of sockets)
    await socket.close({ code: 1011, reason: 'E2E transport unavailable' });
  await expect(recoveryPage.getByTestId('refresh-payment')).toBeEnabled();

  const confirmationPage = await context.newPage();
  confirmationPage.on('pageerror', (error) => failures.push(error.message));
  await confirmationPage.goto(confirmationSimulationUrl.href);
  await expect(confirmationPage.getByTestId('qr-simulation-page')).toBeVisible();
  await expect(confirmationPage.getByTestId('simulate-confirm')).toBeVisible();
  expect(simulationRequests).toHaveLength(1);
  const confirmationResponse = confirmationPage.waitForResponse(
    (response) =>
      response.url().startsWith(fixture.api + '/public/') &&
      response.url().endsWith('/payments/' + confirmedPayment.id + '/simulate') &&
      response.request().method() === 'POST',
  );
  const authoritativeRefresh = page.waitForResponse(
    (response) => response.url() === checkoutEndpoint && response.request().method() === 'GET',
  );
  await confirmationPage.getByTestId('simulate-confirm').click();
  const confirmed = await confirmationResponse;
  expect(confirmed.ok()).toBe(true);
  expect((await readCheckout()).payment).toMatchObject({
    id: confirmedPayment.id,
    status: 'CONFIRMED',
  });
  expect(simulationRequests).toHaveLength(2);
  await expect
    .poll(() =>
      paymentEvents.some(
        (event) =>
          event['reservationId'] === reservationId &&
          event['paymentId'] === confirmedPayment.id &&
          event['status'] === 'CONFIRMED',
      ),
    )
    .toBe(true);
  await expect(page.getByTestId('payment-status')).toHaveAttribute('data-status', 'CONFIRMED');
  expect((await authoritativeRefresh).ok()).toBe(true);
  expect(persistedState()).toMatchObject({
    reservation: 'CONFIRMED',
    space: 'AVAILABLE',
    events: 2,
  });
  // Replay the same provider event through the real authenticated loopback webhook.
  const event = database(`select json_build_object('id', event_id) from payment_webhook_event
    where tenant_id='${fixture.tenant}' and payment_id='${confirmedPayment.id}'`);
  const duplicate = await request.post(confirmed.url(), {
    headers: { 'X-Reservation-Access': reservationAccess! },
    data: { outcome: 'CONFIRMED', eventId: event['id'] },
  });
  expect(duplicate.ok()).toBe(true);
  expect(persistedState()).toMatchObject({
    reservation: 'CONFIRMED',
    space: 'AVAILABLE',
    events: 2,
  });
  await expect(recoveryPage.getByTestId('payment-status')).toHaveAttribute(
    'data-status',
    'PENDING',
  );
  const recoveredResponse = recoveryPage.waitForResponse(
    (response) => response.url() === checkoutEndpoint && response.request().method() === 'GET',
  );
  await recoveryPage.getByTestId('refresh-payment').click();
  expect((await recoveredResponse).ok()).toBe(true);
  expect((await readCheckout()).payment).toMatchObject({
    id: confirmedPayment.id,
    status: 'CONFIRMED',
  });
  await expect(recoveryPage.getByTestId('payment-status')).toHaveAttribute(
    'data-status',
    'CONFIRMED',
  );
  await recoveryPage.reload();
  await expect(recoveryPage.getByTestId('payment-status')).toHaveAttribute(
    'data-status',
    'CONFIRMED',
  );
  expect(simulationRequests).toHaveLength(2);
  await page.getByTestId('receipt-link').click();
  await expect(page.getByTestId('receipt-page')).toBeVisible();
  await expect(page.getByText(descriptor.name, { exact: true })).toBeVisible();
  await expect(page.getByTestId('receipt-qr').getByRole('img')).toBeVisible();
  await expect(page.getByTestId('mock-receipt-notice')).toBeVisible();
  await expect(page.getByTestId('preview-banner')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await testInfo.attach('mobile-live-receipt-qr-redacted', {
    body: await page.screenshot({ mask: [page.getByRole('img'), page.getByRole('link')] }),
    contentType: 'image/png',
  });
  const receiptUrl = page.url();
  const token = new URL(receiptUrl).pathname.split('/').at(-1);
  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  const persisted = await request.get(
    `${fixture.api}/public/tenants/${fixture.tenant}/establishments/venue/receipts/${token}`,
  );
  expect(persisted.ok()).toBe(true);
  expect(await persisted.json()).toMatchObject({
    checkIn: 'NOT_CHECKED_IN',
    payment: { id: confirmedPayment.id, status: 'CONFIRMED' },
    reservation: {
      id: reservationId,
      status: 'CONFIRMED',
      spaces: [
        expect.objectContaining({
          id: descriptor.id,
          name: descriptor.name,
          label: descriptor.label,
          capacity: 4,
        }),
      ],
    },
  });

  await page.reload();
  await expect(page.getByTestId('receipt-page')).toBeVisible();
  await expect(page.getByTestId('receipt-qr').getByRole('img')).toBeVisible();
  const reloadedReceipt = await request.get(
    `${fixture.api}/public/tenants/${fixture.tenant}/establishments/venue/receipts/${token}`,
  );
  expect(reloadedReceipt.ok()).toBe(true);
  expect(await reloadedReceipt.json()).toMatchObject({
    checkIn: 'NOT_CHECKED_IN',
    payment: { id: confirmedPayment.id, status: 'CONFIRMED' },
    reservation: {
      id: reservationId,
      status: 'CONFIRMED',
      spaces: [
        expect.objectContaining({
          id: descriptor.id,
          name: descriptor.name,
          label: descriptor.label,
          capacity: 4,
        }),
      ],
    },
  });
  expect(persistedState()).toMatchObject({
    reservation: 'CONFIRMED',
    space: 'AVAILABLE',
    events: 2,
  });
  expect(failures).toEqual([]);
  expect(publicAuthorization).toEqual([]);
  expect(publicStaffRequests).toEqual([]);
  await testInfo.attach('live-evidence', {
    contentType: 'application/json',
    body: Buffer.from(
      JSON.stringify(
        {
          provider: 'MOCK_GATEWAY (no real money)',
          transport: 'real HTTP + authenticated loopback webhook + PostgreSQL + STOMP',
          businessApiInterception: false,
          policyConfiguredByConsoleUi: true,
          metadataConfiguredByInspector: true,
          realCanvasClickAndKeyboardSelection: true,
          conflictStatus: conflictingBooking.status(),
          forgedWebhookStatus: forgedWebhook.status(),
          duplicateEventCount: persistedState()['events'],
          mobileCheckoutViewport: { width: 390, height: 844 },
          checkoutAndReceiptReload: true,
          httpRecoveryWithoutStomp: true,
          finalState: persistedState(),
        },
        null,
        2,
      ),
    ),
  });
});
