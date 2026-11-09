import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test';

const USER = '69000000-0000-0000-0000-000000000031';
const A = '69000000-0000-0000-0000-000000000041';
const B = '69000000-0000-0000-0000-000000000042';
const TENANT = 'tenant-a';
const DISCARD_COPY = 'Tienes cambios sin guardar. ¿Quieres descartarlos y salir de esta pantalla?';
const establishments = [
  {
    id: A,
    name: 'Sede Centro Operativa',
    slug: 'centro-operativa',
    address: 'Calle Uno 123',
    timezone: 'America/La_Paz',
    canManagePayments: true,
    canCheckIn: true,
  },
  {
    id: B,
    name: 'Sede Norte Operativa',
    slug: 'norte-operativa',
    address: 'Calle Dos 456',
    timezone: 'America/La_Paz',
    canManagePayments: true,
    canCheckIn: true,
  },
];
const qrConfigurations = [
  {
    id: '69000000-0000-4000-8000-000000000051',
    establishmentId: A,
    country: 'BO',
    bankName: 'Banco Centro',
    accountHolderName: 'Centro',
    accountReference: '111',
    enabled: true,
    simulationToken: 'fixture-a',
    simulationPath: '/simulacion/qr/69000000-0000-4000-8000-000000000051',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: '69000000-0000-4000-8000-000000000052',
    establishmentId: B,
    country: 'BO',
    bankName: 'Banco Norte',
    accountHolderName: 'Norte',
    accountReference: '222',
    enabled: true,
    simulationToken: 'fixture-b',
    simulationPath: '/simulacion/qr/69000000-0000-4000-8000-000000000052',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
];

const selectionKey = `mapit.establishment.${TENANT}.${USER}`;
const integratedTestTitle = 'contexto global se restaura y limita las cuatro pantallas al activo';
const operationalRoutes = [
  {
    path: '/spaces/setup',
    heading: /estructura|establecimiento|espacio/i,
    image: 'spaces-setup.png',
  },
  {
    path: '/reservations/new',
    heading: /crear reserva|nueva reserva/i,
    image: 'reservations-new.png',
  },
  { path: '/check-in', heading: /check.in|recepci[oó]n/i, image: 'check-in.png' },
  {
    path: '/administration/settings/payment-methods',
    heading: /m[eé]todos de pago|configuraci[oó]n qr propio/i,
    image: 'payment-methods.png',
  },
];

interface FixtureOptions {
  role?: 'ADMIN' | 'SUPER_ADMIN';
  initialEstablishment?: string;
}

async function prepare(
  page: Page,
  baseURL: string | undefined,
  options: FixtureOptions = {},
): Promise<string[]> {
  if (!baseURL) throw new Error('El proyecto de consola requiere baseURL');
  const origin = new URL(baseURL).origin;
  const unexpectedRequests: string[] = [];

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (request.method() === 'GET' && pathname === '/api/v1/establishments/accessible') {
      return route.fulfill({ json: establishments });
    }
    if (
      request.method() === 'GET' &&
      ['/api/v1/establishments', '/api/v1/reservations', '/api/v1/people'].includes(pathname)
    ) {
      return route.fulfill({ json: [] });
    }
    if (request.method() === 'GET' && pathname === '/api/v1/element-states/summary') {
      return route.fulfill({
        json: {
          total: 0,
          byState: { AVAILABLE: 0, OCCUPIED: 0, RESERVED: 0, CLEANING: 0, OUT_OF_SERVICE: 0 },
        },
      });
    }
    if (
      request.method() === 'GET' &&
      new RegExp(`^/api/v1/establishments/(?:${A}|${B})/floors$`).test(pathname)
    ) {
      return route.fulfill({ json: [] });
    }
    if (request.method() === 'GET' && pathname === '/api/v1/payment-methods/mock-qr') {
      return route.fulfill({ json: qrConfigurations });
    }
    if (request.method() === 'GET' && pathname === '/api/v1/payment-methods') {
      return route.fulfill({ json: [] });
    }
    if (request.method() === 'GET' && pathname === '/api/v1/payment-methods/mock-qr/countries') {
      return route.fulfill({ json: [{ code: 'BO', name: 'Bolivia' }] });
    }
    const readiness = pathname.match(
      /^\/api\/v1\/establishments\/([0-9a-f-]+)\/payment-readiness$/i,
    );
    if (request.method() === 'GET' && readiness && [A, B].includes(readiness[1]!)) {
      return route.fulfill({
        json: {
          establishmentId: readiness[1],
          qrEnabled: true,
          policy: null,
          ready: false,
          blockers: [],
        },
      });
    }

    unexpectedRequests.push(`${request.method()} ${pathname}`);
    return route.fulfill({
      status: 501,
      contentType: 'application/problem+json',
      body: JSON.stringify({
        title: 'Unexpected E2E API request',
        detail: `${request.method()} ${pathname}`,
      }),
    });
  });

  await page.addInitScript(
    ({ tenant, user, role, initialEstablishment, origin }) => {
      if (location.origin !== origin) return;
      sessionStorage.setItem(
        'mapit.auth.session',
        JSON.stringify({
          accessToken: 'fixture.signature.valid',
          tokenType: 'Bearer',
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          tenantSlug: tenant,
          user: {
            id: user,
            tenantId: tenant,
            email: `${user}@e2e.test`,
            fullName: 'Operador E2E',
            role,
          },
        }),
      );
      if (initialEstablishment)
        localStorage.setItem(`mapit.establishment.${tenant}.${user}`, initialEstablishment);
    },
    {
      tenant: TENANT,
      user: USER,
      role: options.role ?? 'ADMIN',
      initialEstablishment: options.initialEstablishment,
      origin,
    },
  );
  return unexpectedRequests;
}

type PageDiagnostics = {
  pageErrors: string[];
  consoleErrors: string[];
  failedRequests: string[];
  apiRequests: string[];
  apiResponses: string[];
  navigations: string[];
  snapshot: () => Promise<{
    url: string;
    selectedEstablishment: string | null;
    domText: string;
  }>;
};

const diagnosticsByPage = new WeakMap<Page, PageDiagnostics>();
const redact = (value: string): string =>
  value
    .replace(/([?&][^=\s]+)=([^&\s]*)/g, '$1=[redacted]')
    .replace(/\beyJ[A-Za-z0-9._-]+\b/g, '[redacted-token]');

function capturePageDiagnostics(page: Page): void {
  const diagnostics: PageDiagnostics = {
    pageErrors: [],
    consoleErrors: [],
    failedRequests: [],
    apiRequests: [],
    apiResponses: [],
    navigations: [],
    snapshot: async () => ({
      url: new URL(page.url()).pathname,
      selectedEstablishment: await page.evaluate((key) => localStorage.getItem(key), selectionKey),
      domText: redact((await page.locator('body').innerText()).slice(0, 12_000)),
    }),
  };
  page.on('pageerror', (error) => diagnostics.pageErrors.push(redact(error.message)));
  page.on('console', (message) => {
    if (message.type() === 'error') diagnostics.consoleErrors.push(redact(message.text()));
  });
  page.on('requestfailed', (request) =>
    diagnostics.failedRequests.push(
      `${request.method()} ${new URL(request.url()).pathname}: ${redact(request.failure()?.errorText ?? 'failed')}`,
    ),
  );
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/'))
      diagnostics.apiRequests.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });
  page.on('response', (response) => {
    if (response.url().includes('/api/v1/'))
      diagnostics.apiResponses.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) diagnostics.navigations.push(new URL(frame.url()).pathname);
  });
  diagnosticsByPage.set(page, diagnostics);
}

async function attachPageDiagnostics(page: Page, testInfo: TestInfo): Promise<void> {
  const diagnostics = diagnosticsByPage.get(page);
  if (!diagnostics) return;
  await testInfo.attach('context-switch-diagnostics.json', {
    body: JSON.stringify(
      {
        ...(await diagnostics.snapshot()),
        pageErrors: diagnostics.pageErrors,
        consoleErrors: diagnostics.consoleErrors,
        failedRequests: diagnostics.failedRequests,
        apiRequests: diagnostics.apiRequests,
        apiResponses: diagnostics.apiResponses,
        navigations: diagnostics.navigations,
      },
      null,
      2,
    ),
    contentType: 'application/json',
  });
}

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.title !== integratedTestTitle || testInfo.status === testInfo.expectedStatus) return;
  await attachPageDiagnostics(page, testInfo);
  diagnosticsByPage.delete(page);
});

async function waitForAccessibleAndNavigate(page: Page, path: string): Promise<void> {
  const accessibleResponse = page.waitForResponse((response) =>
    response.url().includes('/api/v1/establishments/accessible'),
  );
  await Promise.all([accessibleResponse, page.goto(path)]);
}

async function reloadAndResolveContext(page: Page): Promise<void> {
  const accessibleResponse = page.waitForResponse((response) =>
    response.url().includes('/api/v1/establishments/accessible'),
  );
  await Promise.all([accessibleResponse, page.reload()]);
}

async function choose(page: Page, name: string): Promise<void> {
  const popup = page.getByRole('dialog', { name: '¿Con cuál establecimiento querés entrar?' });
  await expect(popup).toBeVisible();
  await popup.getByRole('radio', { name }).check();
  await popup.getByRole('button', { name: 'Continuar' }).click();
  await expect(popup).toBeHidden();
}

async function openGlobalSelector(page: Page): Promise<void> {
  const link = page.getByRole('link', { name: 'Negocios', exact: true });
  if (!(await link.isVisible()))
    await page.getByRole('button', { name: 'Abrir navegación' }).click();
  const accessibleResponse = page.waitForResponse((response) =>
    response.url().includes('/api/v1/establishments/accessible'),
  );
  await Promise.all([accessibleResponse, link.click()]);
}

async function goToOperationalRoute(
  page: Page,
  path: string,
  establishmentId: string,
): Promise<void> {
  const loadPattern = path.endsWith('/payment-methods')
    ? `/api/v1/establishments/${establishmentId}/payment-readiness`
    : path === '/check-in'
      ? '/api/v1/establishments/accessible'
      : `/api/v1/establishments/${establishmentId}/floors`;
  const loadResponse = page.waitForResponse((response) => response.url().includes(loadPattern), {
    timeout: 10_000,
  });
  await Promise.all([loadResponse, page.goto(path)]);
}

async function expectNoLocalEstablishmentSelector(page: Page): Promise<void> {
  await expect(page.getByRole('combobox', { name: /establecimiento/i })).toHaveCount(0);
  await expect(
    page.getByRole('radio', { name: /Sede Centro Operativa|Sede Norte Operativa/ }),
  ).toHaveCount(0);
}

test(integratedTestTitle, async ({ page }, testInfo) => {
  // Ocho rutas, restauración y capturas; cada carga conserva su propio límite.
  test.setTimeout(60_000);
  capturePageDiagnostics(page);
  const unexpected = await prepare(page, testInfo.project.use.baseURL);
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/')) requests.push(request.url());
  });

  await waitForAccessibleAndNavigate(page, '/home');
  await choose(page, 'Sede Centro Operativa');
  await expect(page).toHaveURL(/\/home$/);
  await reloadAndResolveContext(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), selectionKey)).toBe(A);

  for (const route of operationalRoutes) {
    const before = requests.length;
    await goToOperationalRoute(page, route.path, A);
    if (route.path === '/check-in') {
      await expect(page.getByTestId('check-in-page')).toBeVisible();
    } else {
      await expect(page.getByRole('heading', { name: route.heading }).first()).toBeVisible();
    }
    await expectNoLocalEstablishmentSelector(page);
    if (route.path === '/spaces/setup' || route.path === '/reservations/new') {
      if (route.path === '/reservations/new')
        await expect(
          page.getByText('Sede Centro Operativa', { exact: true }).first(),
        ).toBeVisible();
      expect(requests.slice(before).some((url) => url.includes(A))).toBe(true);
      expect(requests.slice(before).some((url) => url.includes(B))).toBe(false);
    }
    if (route.path === '/check-in') {
      await expect(page.getByTestId('check-in-page')).toBeVisible();
      await expect(page.getByText('Sede Centro Operativa', { exact: true })).toBeVisible();
    }
    if (route.path.endsWith('/payment-methods')) {
      await expect(page.getByText(/Banco Centro/)).toBeVisible();
      await expect(page.getByText(/Banco Norte/)).toHaveCount(0);
      expect(
        requests
          .slice(before)
          .some((url) => url.includes(`/establishments/${A}/payment-readiness`)),
      ).toBe(true);
    }
    await page.screenshot({ path: testInfo.outputPath(route.image), fullPage: true });
  }

  await openGlobalSelector(page);
  await choose(page, 'Sede Norte Operativa');
  expect(await page.evaluate((key) => localStorage.getItem(key), selectionKey)).toBe(B);
  for (const route of operationalRoutes) {
    const before = requests.length;
    try {
      await goToOperationalRoute(page, route.path, B);
    } catch (error) {
      await attachPageDiagnostics(page, testInfo);
      throw error;
    }
    if (route.path === '/check-in') {
      await expect(page.getByTestId('check-in-page')).toBeVisible();
    } else {
      await expect(page.getByRole('heading', { name: route.heading }).first()).toBeVisible();
    }
    await expectNoLocalEstablishmentSelector(page);
    if (route.path === '/spaces/setup' || route.path === '/reservations/new') {
      if (route.path === '/reservations/new')
        await expect(page.getByText('Sede Norte Operativa', { exact: true }).first()).toBeVisible();
      expect(requests.slice(before).some((url) => url.includes(B))).toBe(true);
      expect(requests.slice(before).some((url) => url.includes(A))).toBe(false);
    }
    if (route.path.endsWith('/payment-methods')) {
      await expect(page.getByText(/Banco Norte/)).toBeVisible();
      await expect(page.getByText(/Banco Centro/)).toHaveCount(0);
      expect(
        requests
          .slice(before)
          .some((url) => url.includes(`/establishments/${B}/payment-readiness`)),
      ).toBe(true);
    }
  }

  expect(unexpected).toEqual([]);
  testInfo.annotations.push({
    type: 'scope',
    description:
      'API responses are controlled Playwright mocks, not backend authorization evidence.',
  });
});

test('ruta operativa directa sin preferencia espera selección global antes de cargar datos', async ({
  page,
}, testInfo) => {
  const unexpected = await prepare(page, testInfo.project.use.baseURL);
  const apiRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/')) apiRequests.push(new URL(request.url()).pathname);
  });

  await waitForAccessibleAndNavigate(page, '/reservations/new');
  await expect(
    page.getByRole('dialog', { name: '¿Con cuál establecimiento querés entrar?' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: /nueva reserva/i })).toHaveCount(0);
  await expect(page).toHaveURL(/\/reservations\/new$/);
  expect(apiRequests).toEqual(['/api/v1/establishments/accessible']);
  expect(unexpected).toEqual([]);
});

test('rechazar descarte mantiene formulario, ruta y contexto', async ({ page }, testInfo) => {
  const unexpected = await prepare(page, testInfo.project.use.baseURL, { initialEstablishment: A });
  await goToOperationalRoute(page, '/reservations/new', A);
  const startDate = page.locator('input[name="startsAt"]');
  await expect(startDate).toBeVisible();
  await startDate.fill('2027-05-10T10:00');

  let dialogMessage: string | undefined;
  page.once('dialog', (dialog) => {
    dialogMessage = dialog.message();
    void dialog.dismiss();
  });
  const link = page.getByRole('link', { name: 'Negocios', exact: true });
  if (!(await link.isVisible()))
    await page.getByRole('button', { name: 'Abrir navegación' }).click();
  await link.click();

  expect(dialogMessage).toBe(DISCARD_COPY);
  await expect(page).toHaveURL(/\/reservations\/new$/);
  await expect(startDate).toHaveValue('2027-05-10T10:00');
  expect(await page.evaluate((key) => localStorage.getItem(key), selectionKey)).toBe(A);
  expect(unexpected).toEqual([]);
});

test('escritura de configuración QR pendiente bloquea salida sin confirmación de descarte', async ({
  page,
}, testInfo) => {
  const unexpected = await prepare(page, testInfo.project.use.baseURL, { initialEstablishment: A });
  await goToOperationalRoute(page, '/administration/settings/payment-methods', A);

  let releaseResponse!: () => void;
  let resolveRequestSeen!: () => void;
  const responseReleased = new Promise<void>((resolve) => (releaseResponse = resolve));
  const requestSeen = new Promise<void>((resolve) => (resolveRequestSeen = resolve));
  const configId = qrConfigurations[0]!.id;
  const configUrl = `**/api/v1/payment-methods/mock-qr/${configId}`;
  await page.route(configUrl, async (route: Route) => {
    if (route.request().method() !== 'PUT') return route.fallback();
    resolveRequestSeen();
    await responseReleased;
    return route.fulfill({
      json: {
        ...qrConfigurations[0],
        bankName: 'Banco Centro Actualizado',
        updatedAt: '2026-10-02T00:00:00Z',
      },
    });
  });

  await page.getByRole('button', { name: 'Acciones de Mock (desarrollo) · Banco Centro' }).click();
  await page.getByRole('menuitem', { name: 'Editar', exact: true }).click();
  await page.getByLabel(/^Banco/).fill('Banco Centro Actualizado');
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  const saveButton = page.getByRole('button', { name: 'Guardar método', exact: true });
  await expect(saveButton).toBeEnabled();
  const savedResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/payment-methods/mock-qr/${configId}`) &&
      response.request().method() === 'PUT',
  );
  await saveButton.click();
  await requestSeen;

  let unexpectedDialog = false;
  page.once('dialog', (dialog) => {
    unexpectedDialog = true;
    void dialog.dismiss();
  });
  const link = page.getByRole('link', { name: 'Negocios', exact: true });
  if (!(await link.isVisible()))
    await page.getByRole('button', { name: 'Abrir navegación' }).click();
  await link.click();
  await expect(page).toHaveURL(/\/administration\/settings\/payment-methods$/);
  expect(unexpectedDialog).toBe(false);

  releaseResponse();
  await savedResponse;
  expect(unexpected).toEqual([]);
});

test('superadmin navega a /admin sin pedir ni restaurar establecimiento', async ({
  page,
}, testInfo) => {
  const unexpected = await prepare(page, testInfo.project.use.baseURL, { role: 'SUPER_ADMIN' });
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/')) requests.push(new URL(request.url()).pathname);
  });
  await page.goto('/admin/settings');
  await expect(page).toHaveURL(/\/admin\/settings$/);
  await expect(page.getByRole('heading').first()).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(requests).not.toContain('/api/v1/establishments/accessible');
  expect(unexpected).toEqual([]);
});
