import { expect, test, type Page } from '@playwright/test';

const USER_A = '69000000-0000-0000-0000-000000000031';
const USER_B = '69000000-0000-0000-0000-000000000032';
const ESTABLISHMENT_A = '69000000-0000-0000-0000-000000000041';
const ESTABLISHMENT_B = '69000000-0000-0000-0000-000000000042';
const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const ESTABLISHMENTS = [
  {
    id: ESTABLISHMENT_A,
    name: 'Sede Centro E2E',
    slug: 'centro-e2e',
    address: 'Calle Uno 123',
    timezone: 'America/La_Paz',
    canManagePayments: true,
    canCheckIn: true,
  },
  {
    id: ESTABLISHMENT_B,
    name: 'Sede Norte E2E',
    slug: 'norte-e2e',
    address: 'Calle Dos 456',
    timezone: 'America/La_Paz',
    canManagePayments: false,
    canCheckIn: true,
  },
];

function selectionKey(tenant: string, user: string): string {
  return `mapit.establishment.${tenant}.${user}`;
}

async function prepare(
  page: Page,
  baseURL: string | undefined,
  options: {
    tenant?: string;
    user?: string;
    role?: 'ADMIN' | 'STAFF';
    establishments?: typeof ESTABLISHMENTS | (() => typeof ESTABLISHMENTS);
  } = {},
): Promise<void> {
  if (!baseURL) throw new Error('El proyecto de consola requiere baseURL');
  const tenant = options.tenant ?? TENANT_A;
  const user = options.user ?? USER_A;
  const role = options.role ?? 'ADMIN';
  const origin = new URL(baseURL).origin;
  await page.route('**/api/v1/**', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/establishments/accessible', (route) =>
    route.fulfill({
      json:
        typeof options.establishments === 'function'
          ? options.establishments()
          : (options.establishments ?? ESTABLISHMENTS),
    }),
  );
  await page.addInitScript(
    ({ tenant, user, role, origin }) => {
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
    },
    { tenant, user, role, origin },
  );
}

const dialog = (page: Page) =>
  page.getByRole('dialog', { name: '¿Con cuál establecimiento querés entrar?' });

async function goToConsole(page: Page, path: string): Promise<void> {
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/api/v1/establishments/accessible'),
    ),
    page.goto(path),
  ]);
}

async function reloadConsole(page: Page): Promise<void> {
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/api/v1/establishments/accessible'),
    ),
    page.reload(),
  ]);
}

async function rememberSelection(
  page: Page,
  id: string,
  tenant = TENANT_A,
  user = USER_A,
): Promise<void> {
  await page.addInitScript(
    ({ key, id }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, id);
    },
    { key: selectionKey(tenant, user), id },
  );
}

async function openManualSelector(page: Page): Promise<void> {
  const businessesLink = page.getByRole('link', { name: 'Negocios', exact: true });
  if (!(await businessesLink.isVisible())) {
    await page.getByRole('button', { name: 'Abrir navegación' }).click();
  }
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/api/v1/establishments/accessible'),
    ),
    businessesLink.click(),
  ]);
}

test.describe('Consola — selección obligatoria de establecimiento', () => {
  test('sin preferencia exige seleccionar y confirmar, luego persiste solo el ID', async ({
    page,
  }, testInfo) => {
    await prepare(page, testInfo.project.use.baseURL);
    await goToConsole(page, '/home');

    const modal = dialog(page);
    await expect(modal).toBeVisible();
    const continueButton = modal.getByRole('button', { name: 'Continuar' });
    await expect(continueButton).toBeDisabled();
    await expect(modal.getByRole('radio', { name: 'Sede Centro E2E' })).toBeVisible();

    await modal.getByRole('radio', { name: 'Sede Centro E2E' }).click();
    await expect(modal.getByRole('radio', { name: 'Sede Centro E2E' })).toBeChecked();
    await expect(continueButton).toBeEnabled();
    await continueButton.click();

    await expect(modal).toBeHidden();
    await expect(
      page.getByRole('heading', { name: 'Gestiona, analiza y haz crecer tu red de negocios' }),
    ).toBeVisible();
    expect(
      await page.evaluate((key) => localStorage.getItem(key), selectionKey(TENANT_A, USER_A)),
    ).toBe(ESTABLISHMENT_A);
    await reloadConsole(page);
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByTestId('home-panel-accesos-rapidos')).toBeVisible();
  });

  test('mantiene tarjetas y acción accesibles en escritorio y móvil', async ({
    page,
  }, testInfo) => {
    await prepare(page, testInfo.project.use.baseURL);
    await goToConsole(page, '/home');
    const modal = dialog(page);
    await expect(modal.getByRole('radio', { name: 'Sede Centro E2E' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('selector-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(modal.getByRole('button', { name: 'Continuar' })).toBeVisible();
    expect(await modal.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath('selector-mobile.png') });
  });

  test('una preferencia todavía autorizada restaura sin mostrar el modal', async ({
    page,
  }, testInfo) => {
    await prepare(page, testInfo.project.use.baseURL);
    await page.addInitScript(({ key, id }) => localStorage.setItem(key, id), {
      key: selectionKey(TENANT_A, USER_A),
      id: ESTABLISHMENT_B,
    });
    await goToConsole(page, '/home');

    await expect(dialog(page)).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Gestiona, analiza y haz crecer tu red de negocios' }),
    ).toBeVisible();
  });

  test('una selección revocada no habilita acceso y vuelve a exigir confirmación', async ({
    page,
  }, testInfo) => {
    await prepare(page, testInfo.project.use.baseURL, { establishments: [ESTABLISHMENTS[0]!] });
    await page.addInitScript(({ key, id }) => localStorage.setItem(key, id), {
      key: selectionKey(TENANT_A, USER_A),
      id: ESTABLISHMENT_B,
    });
    await goToConsole(page, '/home');

    await expect(dialog(page)).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Gestiona, analiza y haz crecer tu red de negocios' }),
    ).toHaveCount(0);
    await expect(dialog(page).getByRole('button', { name: 'Continuar' })).toBeDisabled();
  });

  test('un operador sin acceso puede reintentar y cerrar sesión', async ({ page }, testInfo) => {
    let calls = 0;
    await prepare(page, testInfo.project.use.baseURL, {
      role: 'STAFF',
      establishments: () => (calls++ === 0 ? [] : ESTABLISHMENTS),
    });
    await goToConsole(page, '/home');

    const modal = dialog(page);
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    await modal.getByRole('button', { name: /reintentar/i }).click();
    await expect(modal.getByRole('radio', { name: 'Sede Centro E2E' })).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  });

  test('la preferencia no se comparte entre usuario ni tenant', async ({ page }, testInfo) => {
    await prepare(page, testInfo.project.use.baseURL, { tenant: TENANT_B, user: USER_B });
    await page.addInitScript(
      ({ entries }) => {
        for (const [key, value] of entries) localStorage.setItem(key, value);
      },
      {
        entries: [
          [selectionKey(TENANT_A, USER_A), ESTABLISHMENT_A],
          [selectionKey(TENANT_B, USER_A), ESTABLISHMENT_B],
          [selectionKey(TENANT_A, USER_B), ESTABLISHMENT_B],
        ] as [string, string][],
      },
    );
    await goToConsole(page, '/home');

    await expect(dialog(page)).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Gestiona, analiza y haz crecer tu red de negocios' }),
    ).toHaveCount(0);
  });

  test('la ruta anterior abre el selector con preferencia y cambiarla vuelve a inicio', async ({
    page,
  }, testInfo) => {
    await prepare(page, testInfo.project.use.baseURL);
    await rememberSelection(page, ESTABLISHMENT_A);
    await goToConsole(page, '/establishments');

    const modal = dialog(page);
    await expect(modal).toBeVisible();
    await expect(page).toHaveURL(/\/home\?selectEstablishment=1$/);
    await expect(page.getByRole('heading', { name: 'Establecimientos', exact: true })).toHaveCount(
      0,
    );
    await modal.getByRole('radio', { name: 'Sede Norte E2E' }).click();
    await expect(modal.getByRole('radio', { name: 'Sede Norte E2E' })).toBeChecked();
    await modal.getByRole('button', { name: 'Continuar' }).click();

    await expect(modal).toBeHidden();
    await expect(page).toHaveURL(/\/home$/);
    expect(
      await page.evaluate((key) => localStorage.getItem(key), selectionKey(TENANT_A, USER_A)),
    ).toBe(ESTABLISHMENT_B);
    await reloadConsole(page);
    await expect(dialog(page)).toHaveCount(0);
    expect(
      await page.evaluate((key) => localStorage.getItem(key), selectionKey(TENANT_A, USER_A)),
    ).toBe(ESTABLISHMENT_B);
    await expect(page.getByTestId('home-panel-accesos-rapidos')).toBeVisible();
  });

  test('el enlace Negocios vuelve a abrir el selector aunque ya haya una selección activa', async ({
    page,
  }, testInfo) => {
    await prepare(page, testInfo.project.use.baseURL);
    await rememberSelection(page, ESTABLISHMENT_A);
    await goToConsole(page, '/home');
    await expect(dialog(page)).toHaveCount(0);

    await openManualSelector(page);
    await expect(dialog(page)).toBeVisible();
    await expect(page).toHaveURL(/\/home\?selectEstablishment=1$/);
    await expect(page.getByRole('heading', { name: 'Establecimientos', exact: true })).toHaveCount(
      0,
    );
  });

  test('cerrar una reapertura conserva la selección previa y limpia el marcador', async ({
    page,
  }, testInfo) => {
    await prepare(page, testInfo.project.use.baseURL);
    await rememberSelection(page, ESTABLISHMENT_A);
    await goToConsole(page, '/home');
    await openManualSelector(page);

    const modal = dialog(page);
    const closeButton = modal.getByRole('button', { name: 'Cerrar selector de establecimiento' });
    await expect(closeButton).toBeVisible();
    await modal.getByRole('radio', { name: 'Sede Norte E2E' }).click();
    await closeButton.click();

    await expect(modal).toBeHidden();
    await expect(page).toHaveURL(/\/home$/);
    expect(
      await page.evaluate((key) => localStorage.getItem(key), selectionKey(TENANT_A, USER_A)),
    ).toBe(ESTABLISHMENT_A);
    await expect(page.getByTestId('home-panel-accesos-rapidos')).toBeVisible();
  });

  test('un error al actualizar la lista mantiene el selector abierto y permite reintentar', async ({
    page,
  }, testInfo) => {
    await prepare(page, testInfo.project.use.baseURL);
    await rememberSelection(page, ESTABLISHMENT_A);
    await goToConsole(page, '/home');
    let refreshCount = 0;
    await page.route('**/api/v1/establishments/accessible', (route) => {
      refreshCount++;
      return route.fulfill(
        refreshCount === 1
          ? { status: 503, json: { title: 'Fixture error' } }
          : { json: ESTABLISHMENTS },
      );
    });

    await openManualSelector(page);
    const modal = dialog(page);
    await expect(modal).toBeVisible();
    await expect(page).toHaveURL(/\/home\?selectEstablishment=1$/);
    await expect(modal.getByRole('alert')).toBeVisible();
    const retryResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/establishments/accessible') && response.status() === 200,
    );
    await modal.getByRole('button', { name: /reintentar/i }).click();
    await retryResponse;
    await expect(modal.getByRole('radio', { name: 'Sede Centro E2E' })).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  });

  test('la URL profunda no monta operaciones antes de confirmar; Escape y Tab mantienen el foco modal', async ({
    page,
  }, testInfo) => {
    await prepare(page, testInfo.project.use.baseURL);
    await goToConsole(page, '/check-in');

    const modal = dialog(page);
    await expect(modal).toBeVisible();
    await expect(page.getByTestId('check-in-page')).toHaveCount(0);
    await expect(page).toHaveURL(/\/check-in$/);
    await expect(modal).toContainText('¿Con cuál establecimiento querés entrar?');

    await page.keyboard.press('Escape');
    await expect(modal).toBeVisible();
    expect(await modal.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Tab');
    expect(await modal.evaluate((element) => element.contains(document.activeElement))).toBe(true);

    await modal.getByRole('radio', { name: 'Sede Centro E2E' }).check();
    await modal.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByTestId('check-in-page')).toBeVisible();
  });
});
