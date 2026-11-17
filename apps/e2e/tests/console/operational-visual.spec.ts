import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { companyAdminFixture } from './company-admin-fixture';

const routes = [
  { path: '/audit', link: 'Auditoría', heading: 'Auditoría' },
  {
    path: '/administration/settings/payment-methods',
    link: 'Métodos de pago',
    heading: 'Métodos de pago',
  },
  { path: '/check-in', link: 'Recepción y check-in', heading: 'Recepción y check-in' },
] as const;
const viewports = [
  { width: 1600, height: 900 },
  { width: 1366, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
] as const;
const diagnosticsByPage = new WeakMap<Page, () => Record<string, unknown>>();

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return;
  const details = diagnosticsByPage.get(page);
  if (!details) return;
  await testInfo.attach('operational-visual-diagnostics.json', {
    body: JSON.stringify({ landedPath: new URL(page.url()).pathname, ...details() }, null, 2),
    contentType: 'application/json',
  });
});

async function stabilizeForScreenshot(page: Page): Promise<void> {
  await page.evaluate(async () => {
    window.scrollTo(0, 0);
    await document.fonts.ready;
    const finiteAnimations = document
      .getAnimations()
      .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity);
    await Promise.all(
      finiteAnimations.map((animation) => animation.finished.catch(() => undefined)),
    );
  });
}

test('operational visual captures', async ({ page, request }, testInfo) => {
  test.setTimeout(180_000);
  const company = await companyAdminFixture(request);
  const phase = process.env['MAPIT_VISUAL_PHASE'] ?? 'current';
  const output = join(process.cwd(), 'screenshots', 'operational-redesign');
  await mkdir(output, { recursive: true });

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  const apiResponses: string[] = [];
  const apiRequests: string[] = [];
  diagnosticsByPage.set(page, () => ({
    mode: 'live-api',
    consoleErrors,
    pageErrors,
    failedRequests,
    apiRequests,
    apiResponses,
  }));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) =>
    failedRequests.push(`${request.method()} ${request.url()}`),
  );
  page.on('response', (response) => {
    if (response.url().includes('/api/')) {
      const url = new URL(response.url());
      apiResponses.push(`${response.status()} ${url.host}${url.pathname}`);
    }
  });
  page.on('request', (request) => {
    if (request.url().includes('/api/')) {
      const url = new URL(request.url());
      apiRequests.push(`${request.method()} ${url.host}${url.pathname}`);
    }
  });

  const apiBaseUrl = process.env['API_BASE_URL'] ?? 'http://localhost:8080/api/v1';
  const loginResponse = await request.post(`${apiBaseUrl}/auth/global-login`, {
    data: { email: company.email, password: company.password },
  });
  expect(loginResponse.ok()).toBe(true);
  const realSession = (await loginResponse.json()) as {
    accessToken: string;
    tokenType: 'Bearer';
    expiresAt: string;
    user: { id: string; tenantId: string; email: string; fullName: string; role: 'ADMIN' };
  };
  expect(realSession.accessToken).toBeTruthy();
  const baseURL = String(testInfo.project.use.baseURL ?? 'http://localhost:4200');
  const origin = new URL(baseURL).origin;
  const selectionKey = `mapit.establishment.${realSession.user.tenantId}.${realSession.user.id}`;
  await page.addInitScript(
    ({ origin, session, tenantSlug, selectionKey, venueId }) => {
      if (location.origin !== origin) return;
      sessionStorage.setItem('mapit.auth.session', JSON.stringify({ ...session, tenantSlug }));
      localStorage.setItem(selectionKey, venueId);
    },
    {
      origin,
      session: realSession,
      tenantSlug: company.slug,
      selectionKey,
      venueId: company.venueId,
    },
  );
  // El backend del stack Docker desactiva los endpoints del simulador.
  await page.route('**/assets/config.json', async (route) => {
    const response = await route.fetch();
    const config = (await response.json()) as Record<string, unknown>;
    await route.fulfill({
      response,
      json: { ...config, environment: 'production' },
    });
  });
  const accessibleLoad = page.waitForResponse(
    (response) => new URL(response.url()).pathname.endsWith('/establishments/accessible'),
    { timeout: 30_000 },
  );
  const [, establishmentsResponse] = await Promise.all([page.goto('/home'), accessibleLoad]);
  expect(establishmentsResponse.ok()).toBe(true);
  await expect(page.getByText('Sede Home', { exact: true })).toBeVisible({ timeout: 30_000 });
  const loginState = await page.evaluate((key) => {
    const raw = sessionStorage.getItem('mapit.auth.session');
    const session = raw
      ? (JSON.parse(raw) as {
          accessToken?: string;
          tenantSlug?: string;
          user?: { id?: string; tenantId?: string; role?: string };
        })
      : null;
    return {
      hasAccessToken: Boolean(session?.accessToken),
      tenantSlug: session?.tenantSlug ?? null,
      userId: session?.user?.id ?? null,
      tenantId: session?.user?.tenantId ?? null,
      role: session?.user?.role ?? null,
      selectedEstablishment: localStorage.getItem(key),
    };
  }, `mapit.establishment.${company.tenantId}.${company.userId}`);
  expect(loginState).toEqual({
    hasAccessToken: true,
    tenantSlug: company.slug,
    userId: company.userId,
    tenantId: company.tenantId,
    role: 'ADMIN',
    selectedEstablishment: company.venueId,
  });

  const records: Array<Record<string, unknown>> = [];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const route of routes) {
      const link = page.getByRole('link', { name: route.link, exact: true });
      if (!(await link.isVisible())) {
        const openNavigation = page.getByRole('button', { name: 'Abrir navegación' });
        if (await openNavigation.isVisible()) await openNavigation.click();
      }
      await expect(link).toBeVisible();
      await link.click();
      await expect.poll(() => new URL(page.url()).pathname).toBe(route.path);
      const authenticated = await page.evaluate(() => {
        const raw = sessionStorage.getItem('mapit.auth.session');
        return Boolean(raw && (JSON.parse(raw) as { accessToken?: string }).accessToken);
      });
      expect(authenticated).toBe(true);
      try {
        if (route.path === '/check-in')
          await expect(page.getByTestId('check-in-page')).toBeVisible();
        await expect(page.getByRole('heading', { name: route.heading, exact: true })).toBeVisible();
        if (route.path === '/audit')
          await expect(page.getByText('Sin eventos', { exact: true })).toBeVisible();
        if (route.path.endsWith('/payment-methods'))
          await expect(
            page.getByText('No hay métodos de pago configurados.', { exact: true }),
          ).toBeVisible();
        if (route.path === '/check-in')
          await expect(page.getByText('Esperando comprobante', { exact: true })).toBeVisible();
      } catch (error) {
        const barrier = {
          requestedRoute: route.path,
          landedUrl: page.url(),
          loginState,
          consoleErrors,
          pageErrors,
          failedRequests,
          apiRequests,
          apiResponses,
        };
        const report = join(output, `${phase}-barrier.json`);
        await page.screenshot({ path: join(output, `${phase}-barrier.png`) });
        await writeFile(report, JSON.stringify(barrier, null, 2), 'utf8');
        await testInfo.attach(`${phase}-barrier.json`, {
          path: report,
          contentType: 'application/json',
        });
        throw error;
      }

      await stabilizeForScreenshot(page);

      const diagnostics = await page.evaluate(() => {
        const rect = (element: Element | null) => {
          if (!element) return null;
          const { x, y, width, height, top, right, bottom, left } = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            x,
            y,
            width,
            height,
            top,
            right,
            bottom,
            left,
            display: style.display,
            position: style.position,
            font: style.font,
            color: style.color,
            backgroundColor: style.backgroundColor,
            padding: style.padding,
            margin: style.margin,
            overflow: style.overflow,
          };
        };
        const body = document.body;
        const root = document.documentElement;
        return {
          url: location.pathname,
          viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
          overflow: {
            documentWidth: root.scrollWidth,
            viewportWidth: root.clientWidth,
            horizontal: root.scrollWidth > root.clientWidth,
            documentHeight: root.scrollHeight,
          },
          geometry: {
            body: rect(body),
            main: rect(document.querySelector('main')),
            heading: rect(document.querySelector('h1')),
            navigation: rect(document.querySelector('nav')),
          },
        };
      });
      expect(diagnostics.url).toBe(route.path);
      const safeRoute = route.path.slice(1).replaceAll('/', '-');
      const stem = `empty-real-${phase}-${viewport.width}x${viewport.height}-${safeRoute}`;
      const screenshot = join(output, `${stem}.png`);
      const captureMode = viewport.width === 390 ? 'full-page' : 'viewport';
      await page.screenshot({ path: screenshot, fullPage: captureMode === 'full-page' });
      records.push({
        ...diagnostics,
        expectedHeading: route.heading,
        contentVerified: true,
        captureMode,
        screenshot,
        consoleErrors: [...consoleErrors],
        pageErrors: [...pageErrors],
      });
    }
  }

  const report = join(output, `empty-real-${phase}-report.json`);
  await writeFile(
    report,
    JSON.stringify(
      {
        mode: 'screenshotempty-real',
        phase,
        authentication: loginState,
        apiRequests,
        apiResponses,
        records,
      },
      null,
      2,
    ),
    'utf8',
  );
  await testInfo.attach(`empty-real-${phase}-report.json`, {
    path: report,
    contentType: 'application/json',
  });
  expect(records).toHaveLength(12);
});

// Intentionally separate from the live screenshots: these API responses are UI-only fixtures.
test('mocked populated operational views and keyboard flows', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const phase = process.env['MAPIT_VISUAL_PHASE'] ?? 'after';
  const output = join(process.cwd(), 'screenshots', 'operational-redesign');
  await mkdir(output, { recursive: true });
  const tenant = 'visual-fixture';
  const user = '79000000-0000-4000-8000-000000000001';
  const venue = '79000000-0000-4000-8000-000000000002';
  const actor = user;
  const selected = `mapit.establishment.${tenant}.${user}`;
  const events = Array.from({ length: 12 }, (_, index) => ({
    id: `79000000-0000-4000-8000-${String(index + 10).padStart(12, '0')}`,
    actorId: actor,
    occurredAt: new Date(Date.now() - index * 60_000).toISOString(),
    resourceType: index % 2 ? 'SPACE_ELEMENT' : 'RESERVATION',
    resourceId: `79000000-0000-4000-8001-${String(index + 10).padStart(12, '0')}`,
    eventType: index % 2 ? 'SPACE_ELEMENT_STATE_CHANGED' : 'RESERVATION_STATUS_CHANGED',
    details:
      index % 2
        ? { previousState: 'AVAILABLE', newState: 'OCCUPIED', sectorId: venue }
        : { previousStatus: 'CONFIRMED', newStatus: 'ACTIVE', establishmentId: venue },
  }));
  const mockQr = {
    id: '79000000-0000-4000-8000-000000000021',
    establishmentId: venue,
    country: 'BO',
    bankName: 'Banco Fixture',
    accountHolderName: 'Titular Fixture',
    accountReference: 'CUENTA-DEMO-01',
    enabled: true,
    simulationToken: 'mock-only-token',
    simulationPath: '/simulacion/qr/79000000-0000-4000-8000-000000000021',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  };
  const methods = [
    {
      id: '79000000-0000-4000-8000-000000000031',
      establishmentId: venue,
      displayName: 'QR Banco Fixture',
      country: 'BO',
      currency: 'BOB',
      provider: 'STATIC_BANK_QR',
      bankName: 'Banco Fixture',
      accountReference: 'CUENTA-DEMO-01',
      staticQrImage: null,
      enabled: true,
      accountHolderName: 'Titular Fixture',
      verification: 'MANUAL',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    },
    {
      id: '79000000-0000-4000-8000-000000000032',
      establishmentId: venue,
      displayName: 'Gateway Fixture',
      country: 'BO',
      currency: 'BOB',
      provider: 'INTEGRATED_GATEWAY',
      bankName: 'Gateway Fixture',
      accountReference: 'GATEWAY-DEMO',
      staticQrImage: null,
      enabled: false,
      accountHolderName: 'Gateway Fixture',
      verification: 'AUTOMATIC',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    },
  ];
  const receipt = (checkedIn: boolean) => ({
    receipt: {
      token: 'x'.repeat(43),
      reservation: {
        id: '79000000-0000-4000-8000-000000000041',
        establishmentId: venue,
        establishmentName: 'Sede Visual Fixture',
        establishmentSlug: 'sede-visual',
        startsAt: '2026-11-06T10:00:00-04:00',
        endsAt: '2026-11-06T11:00:00-04:00',
        timezone: 'America/La_Paz',
        status: checkedIn ? 'ACTIVE' : 'CONFIRMED',
        spaces: [
          {
            id: '79000000-0000-4000-8000-000000000051',
            name: 'Mesa Ventana',
            floor: 'Planta Principal',
            sector: 'Terraza',
            state: checkedIn ? 'OCCUPIED' : 'RESERVED',
          },
        ],
      },
      payment: {
        id: '79000000-0000-4000-8000-000000000061',
        status: 'CONFIRMED',
        provider: 'MOCK_GATEWAY',
        amount: '120.00',
        currency: 'BOB',
        totalAmount: '120.00',
        paidAmount: '120.00',
        expiresAt: '2026-11-06T09:00:00-04:00',
        externalReference: 'VISUAL-FIXTURE-01',
      },
      paidAmount: '120.00',
      currency: 'BOB',
      totalAmount: '120.00',
      balanceAmount: '0.00',
      checkIn: checkedIn ? 'CHECKED_IN' : 'NOT_CHECKED_IN',
      expiresAt: '2026-11-06T09:00:00-04:00',
    },
    audit: checkedIn
      ? {
          actorId: actor,
          occurredAt: '2026-11-04T10:00:00Z',
          establishmentId: venue,
          spaceIds: ['79000000-0000-4000-8000-000000000051'],
        }
      : null,
  });
  let checkedIn = false;
  const checkInCalls = { lookup: 0, arrival: 0 };
  const unexpectedApi: string[] = [];
  const apiLog: string[] = [];
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  diagnosticsByPage.set(page, () => ({
    mode: 'populated-controlled',
    apiLog,
    consoleErrors,
    pageErrors,
    unexpectedApi,
    checkInCalls,
  }));
  page.on('request', (request) => {
    if (request.url().includes('/api/'))
      apiLog.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (request.method() === 'GET' && path === '/api/v1/establishments/accessible')
      return route.fulfill({
        json: [
          {
            id: venue,
            name: 'Sede Visual Fixture',
            slug: 'sede-visual',
            address: 'Calle Fixture 123',
            timezone: 'America/La_Paz',
            canManagePayments: true,
            canCheckIn: true,
          },
        ],
      });
    if (request.method() === 'GET' && path === '/api/v1/audit-logs') {
      const matching = events.filter(
        (event) =>
          (!url.searchParams.has('resourceType') ||
            event.resourceType === url.searchParams.get('resourceType')) &&
          (!url.searchParams.has('eventType') ||
            event.eventType === url.searchParams.get('eventType')),
      );
      const pageNumber = Number(url.searchParams.get('page') ?? 0);
      const size = Number(url.searchParams.get('size') ?? 10);
      return route.fulfill({
        json: {
          content: matching.slice(pageNumber * size, (pageNumber + 1) * size),
          page: pageNumber,
          size,
          totalElements: matching.length,
          totalPages: Math.ceil(matching.length / size),
        },
      });
    }
    if (request.method() === 'GET' && path === '/api/v1/payment-methods')
      return route.fulfill({ json: methods });
    if (request.method() === 'GET' && path === '/api/v1/payment-methods/mock-qr')
      return route.fulfill({ json: [mockQr] });
    if (request.method() === 'GET' && path === '/api/v1/payment-methods/mock-qr/countries')
      return route.fulfill({ json: [{ code: 'BO', name: 'Bolivia' }] });
    if (
      request.method() === 'GET' &&
      /\/api\/v1\/establishments\/[0-9a-f-]+\/payment-readiness$/i.test(path)
    )
      return route.fulfill({
        json: {
          establishmentId: venue,
          qrEnabled: true,
          policy: null,
          ready: false,
          blockers: ['POLICY_MISSING'],
        },
      });
    if (request.method() === 'POST' && path.endsWith('/check-ins/lookup')) {
      checkInCalls.lookup++;
      return route.fulfill({ json: receipt(checkedIn) });
    }
    if (request.method() === 'POST' && path.endsWith('/check-ins')) {
      checkInCalls.arrival++;
      checkedIn = true;
      return route.fulfill({ json: receipt(true) });
    }
    unexpectedApi.push(`${request.method()} ${path}`);
    return route.fulfill({
      status: 501,
      json: { title: 'Unexpected visual fixture API', detail: `${request.method()} ${path}` },
    });
  });
  const consoleOrigin = new URL(String(testInfo.project.use.baseURL ?? 'http://localhost:4200'))
    .origin;
  await page.addInitScript(
    ({ origin, tenantSlug, userId, tenantId, establishmentId, selectionKey }) => {
      if (location.origin !== origin) return;
      sessionStorage.setItem(
        'mapit.auth.session',
        JSON.stringify({
          accessToken: 'fixture.signature.valid',
          tokenType: 'Bearer',
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          tenantSlug,
          user: {
            id: userId,
            tenantId,
            email: 'visual-fixture@e2e.test',
            fullName: 'Operador Visual',
            role: 'ADMIN',
          },
        }),
      );
      localStorage.setItem(selectionKey, establishmentId);
    },
    {
      origin: consoleOrigin,
      tenantSlug: tenant,
      userId: user,
      tenantId: tenant,
      establishmentId: venue,
      selectionKey: selected,
    },
  );

  const accessibleLoad = page.waitForResponse(
    (response) => new URL(response.url()).pathname.endsWith('/establishments/accessible'),
    { timeout: 30_000 },
  );
  await Promise.all([page.goto('/audit'), accessibleLoad]);
  await expect(page.getByRole('heading', { name: 'Auditoría', exact: true })).toBeVisible({
    timeout: 30_000,
  });
  const records: Array<Record<string, unknown>> = [];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);

    const auditLink = page.getByRole('link', { name: 'Auditoría', exact: true });
    if (new URL(page.url()).pathname !== '/audit') {
      if (!(await auditLink.isVisible()))
        await page.getByRole('button', { name: 'Abrir navegación' }).click();
      await auditLink.click();
    }
    await expect(page.getByRole('heading', { name: 'Auditoría', exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect.poll(() => new URL(page.url()).pathname).toBe('/audit');
    const closeDetail = page.getByRole('button', { name: 'Cerrar detalle' });
    if (await closeDetail.isVisible()) await closeDetail.click();
    await page.getByRole('button', { name: 'Limpiar filtros' }).click();
    const firstEvent = page.getByRole('button', { name: /Estado de reserva actualizado/ }).first();
    await expect(firstEvent).toBeVisible();
    await firstEvent.click();
    await expect(page.getByRole('heading', { name: 'Detalle del evento' })).toBeVisible();
    const nextPage = page
      .getByRole('navigation', { name: 'Paginación de la bitácora' })
      .getByRole('button', { name: 'Siguiente' });
    await expect(nextPage).toBeEnabled();
    await nextPage.click();
    await expect(page.getByRole('navigation', { name: 'Paginación de la bitácora' })).toContainText(
      '2 de 2',
    );
    await page
      .getByRole('navigation', { name: 'Paginación de la bitácora' })
      .getByRole('button', { name: 'Anterior' })
      .click();
    await page.getByRole('combobox', { name: 'Módulo' }).selectOption('RESERVATION');
    await expect(page.getByRole('button', { name: 'Estado de reserva actualizado' })).toHaveCount(
      6,
    );
    await firstEvent.click();
    const auditCapture = join(
      output,
      `populated-controlled-${phase}-${viewport.width}x${viewport.height}-audit.png`,
    );
    await stabilizeForScreenshot(page);
    const auditLayout = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth,
      heading: getComputedStyle(document.querySelector('h1')!).font,
    }));
    expect(auditLayout.documentWidth).toBeLessThanOrEqual(auditLayout.viewportWidth);
    const auditCaptureMode = viewport.width === 390 ? 'full-page' : 'viewport';
    await page.screenshot({ path: auditCapture, fullPage: auditCaptureMode === 'full-page' });
    records.push({
      route: '/audit',
      contentVerified: true,
      viewport,
      screenshot: auditCapture,
      captureMode: auditCaptureMode,
      layout: auditLayout,
      detailAndPagination: true,
    });

    const paymentLink = page.getByRole('link', { name: 'Métodos de pago', exact: true });
    if (!(await paymentLink.isVisible())) {
      const openNavigation = page.getByRole('button', { name: 'Abrir navegación' });
      if (await openNavigation.isVisible()) await openNavigation.click();
    }
    await paymentLink.click();
    await expect
      .poll(() => new URL(page.url()).pathname)
      .toBe('/administration/settings/payment-methods');
    await expect(page.getByText('Gateway Fixture', { exact: true })).toBeVisible();
    await expect(page.getByText('QR Banco Fixture', { exact: true })).toBeVisible();
    const summary = page.getByRole('complementary', { name: 'Resumen de cobros' });
    await expect(summary).toBeVisible();
    await expect(summary.getByText(/2\s*Activo/)).toBeVisible();
    await expect(summary.getByText(/1\s*Inactivo/)).toBeVisible();
    const paymentRows = page.getByRole('listitem');
    await expect(paymentRows.filter({ hasText: 'QR Banco Fixture' })).toContainText('Activo');
    await expect(paymentRows.filter({ hasText: 'Gateway Fixture' })).toContainText('Inactivo');
    const qrActions = page.getByRole('button', {
      name: 'Acciones de Mock (desarrollo) · Banco Fixture',
    });
    await expect(qrActions).toBeVisible();
    await qrActions.click();
    await expect(page.getByRole('menuitem', { name: 'Editar', exact: true })).toBeVisible();
    const paymentCapture = join(
      output,
      `populated-controlled-${phase}-${viewport.width}x${viewport.height}-payment-methods.png`,
    );
    await stabilizeForScreenshot(page);
    const paymentLayout = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth,
      heading: getComputedStyle(document.querySelector('h1')!).font,
    }));
    expect(paymentLayout.documentWidth).toBeLessThanOrEqual(paymentLayout.viewportWidth);
    const paymentCaptureMode = viewport.width === 390 ? 'full-page' : 'viewport';
    await page.screenshot({ path: paymentCapture, fullPage: paymentCaptureMode === 'full-page' });
    records.push({
      route: '/administration/settings/payment-methods',
      contentVerified: true,
      viewport,
      screenshot: paymentCapture,
      captureMode: paymentCaptureMode,
      layout: paymentLayout,
      qrGatewaySummaryMenu: true,
    });

    const checkInLink = page.getByRole('link', { name: 'Recepción y check-in', exact: true });
    if (!(await checkInLink.isVisible())) {
      const openNavigation = page.getByRole('button', { name: 'Abrir navegación' });
      if (await openNavigation.isVisible()) await openNavigation.click();
    }
    await checkInLink.click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/check-in');
    await expect(page.getByTestId('check-in-page')).toBeVisible();
    const checkInCallsBefore = { ...checkInCalls };
    const scanTab = page.getByRole('tab', { name: /Escanear QR/ });
    const manualTab = page.getByRole('tab', { name: /Ingresar código/ });
    await scanTab.focus();
    await scanTab.press('End');
    await expect(manualTab).toHaveAttribute('aria-selected', 'true');
    await expect(manualTab).toBeFocused();
    await manualTab.press('Home');
    await expect(scanTab).toHaveAttribute('aria-selected', 'true');
    await manualTab.click();
    checkedIn = false;
    await page.getByTestId('check-in-code').fill('x'.repeat(43));
    await page.getByTestId('lookup-receipt').click();
    await expect(page.getByText('Mesa Ventana', { exact: true })).toBeVisible();
    await expect(page.getByTestId('register-arrival')).toBeEnabled();
    await expect(page.getByTestId('check-in-status')).toContainText('Sin registrar');
    await scanTab.click();
    await expect(scanTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Mesa Ventana', { exact: true })).toBeVisible();
    await expect(page.getByTestId('check-in-status')).toContainText('Sin registrar');
    expect(checkInCalls.lookup - checkInCallsBefore.lookup).toBe(1);
    const checkInCapture = join(
      output,
      `populated-controlled-${phase}-${viewport.width}x${viewport.height}-check-in.png`,
    );
    await stabilizeForScreenshot(page);
    const checkInLayout = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth,
      heading: getComputedStyle(document.querySelector('h1')!).font,
    }));
    expect(checkInLayout.documentWidth).toBeLessThanOrEqual(checkInLayout.viewportWidth);
    if (viewport.width === 1600 && viewport.height === 900) {
      const registerArrivalBounds = await page.getByTestId('register-arrival').boundingBox();
      expect(registerArrivalBounds).not.toBeNull();
      expect(registerArrivalBounds!.y + registerArrivalBounds!.height).toBeLessThanOrEqual(
        viewport.height,
      );
    }
    const checkInCaptureMode = viewport.width === 390 ? 'full-page' : 'viewport';
    await page.screenshot({ path: checkInCapture, fullPage: checkInCaptureMode === 'full-page' });
    records.push({
      route: '/check-in',
      contentVerified: true,
      viewport,
      screenshot: checkInCapture,
      captureMode: checkInCaptureMode,
      layout: checkInLayout,
      lookupResultSelectedScanTabBeforeArrival: true,
    });
    await page.evaluate(() => {
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        configurable: true,
        value: () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError')),
      });
    });
    await page.getByTestId('scanner-start').click();
    await expect(page.getByRole('alert')).toContainText(
      'No se concedió acceso a la cámara. Revisa los permisos del navegador o ingresa el código manualmente.',
    );
    await page.evaluate(() => Reflect.deleteProperty(navigator.mediaDevices, 'getUserMedia'));
    await page.getByTestId('register-arrival').click();
    await expect(page.getByTestId('check-in-status')).toContainText(
      /llegada registrada|check-in realizado/i,
    );
    await expect(page.getByTestId('register-arrival')).toBeDisabled();
    expect(checkInCalls.arrival - checkInCallsBefore.arrival).toBe(1);
    await page.getByRole('button', { name: 'Limpiar consulta' }).click();
    await expect(page.getByText('Esperando comprobante', { exact: true })).toBeVisible();
  }

  const report = join(output, `populated-controlled-${phase}-report.json`);
  await writeFile(
    report,
    JSON.stringify(
      {
        mode: 'populated-controlled; API mocked, camera permission denial simulated, not live backend evidence',
        phase,
        checkInCalls,
        unexpectedApi,
        apiLog,
        consoleErrors,
        pageErrors,
        records,
      },
      null,
      2,
    ),
    'utf8',
  );
  await testInfo.attach(`populated-controlled-${phase}-report.json`, {
    path: report,
    contentType: 'application/json',
  });
  testInfo.annotations.push({
    type: 'scope',
    description:
      'UI-only visual/control test; all /api/v1 responses are mocked. Camera permission denial is simulated; no physical camera or real QR reading is tested.',
  });
  expect(unexpectedApi).toEqual([]);
  expect(records).toHaveLength(12);
});
