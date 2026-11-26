import { expect, test } from '@playwright/test';
import { join } from 'node:path';
import { companyAdminFixture } from './company-admin-fixture';

const API = process.env['API_BASE_URL'] ?? 'http://localhost:8080/api/v1';

test('editar la distribución, proteger las salidas y recuperar el plano guardado', async ({
  page,
  request,
  baseURL,
}, testInfo) => {
  test.setTimeout(120_000);
  const screenshotDir = process.env['MAPIT_EDITOR_QA_SCREENSHOTS'];
  const company = await companyAdminFixture(request);
  const login = await request.post(API + '/auth/global-login', {
    data: { email: company.email, password: company.password },
  });
  expect(login.ok()).toBe(true);
  const session = (await login.json()) as { accessToken: string };
  const headers = { Authorization: 'Bearer ' + session.accessToken };
  const create = async (path: string, data: Record<string, unknown>) => {
    const response = await request.post(API + path, { headers, data });
    expect(response.status(), path).toBe(201);
    return ((await response.json()) as { id: string }).id;
  };
  const floor = await create(`/establishments/${company.venueId}/floors`, { name: 'Piso 1' });
  const sector = await create(`/floors/${floor}/sectors`, {
    name: 'Salón principal',
    slug: 'salon-editor',
    maxCapacity: 40,
  });
  const elementPath = `/sectors/${sector}/elements`;
  const table = await create(elementPath, {
    type: 'TABLE',
    label: 'Mesa Ventana',
    capacity: 4,
    x: 100,
    y: 100,
    width: 100,
    height: 100,
    rotation: 0,
    initialState: 'OCCUPIED',
  });
  const otherTables = await Promise.all(
    [
      { label: 'Mesa Central', x: 340, y: 100 },
      { label: 'Mesa Terraza', x: 580, y: 100 },
      { label: 'Mesa Familiar', x: 340, y: 360 },
    ].map((data) =>
      create(elementPath, { ...data, type: 'TABLE', capacity: 4, width: 100, height: 100 }),
    ),
  );
  const customer = await create('/people', { fullName: 'Cliente de distribución' });
  const reservation = await create(`/establishments/${company.venueId}/reservations`, {
    personId: customer,
    spaceElementIds: [table],
    startsAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
    endsAt: new Date(Date.now() + 25 * 60 * 60_000).toISOString(),
  });
  await page.addInitScript(
    ({ session, tenantSlug, selectionKey, establishmentId, origin }) => {
      if (location.origin !== origin) return;
      sessionStorage.setItem('mapit.auth.session', JSON.stringify({ ...session, tenantSlug }));
      localStorage.setItem(selectionKey, establishmentId);
    },
    {
      session,
      tenantSlug: company.slug,
      selectionKey: `mapit.establishment.${company.tenantId}.${company.userId}`,
      establishmentId: company.venueId,
      origin: new URL(baseURL!).origin,
    },
  );
  if (process.env['API_BASE_URL']) {
    await page.route('**/assets/config.json', async (route) => {
      const response = await route.fetch();
      const ws = new URL('/ws', API);
      ws.protocol = ws.protocol === 'https:' ? 'wss:' : 'ws:';
      const config = (await response.json()) as Record<string, unknown>;
      await route.fulfill({
        response,
        json: {
          ...config,
          apiBaseUrl: API,
          wsUrl: ws.toString(),
        },
      });
    });
  }
  const errors: string[] = [];
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) =>
    failedRequests.push(request.method() + ' ' + request.url()),
  );
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  const editorPath = `/spaces/editor/${sector}?floorId=${floor}`;
  const save = page.getByTestId('map-save');
  const monitor = page.getByTestId('map-go-monitor');
  const openMonitor = async () => {
    await expect(monitor).toHaveAttribute('href', new RegExp(`/map.*sectorId=${sector}`));
    await monitor.click();
  };
  const openSectorEditorFromMap = async () => {
    const edit = page.getByRole('link', { name: 'Editar distribución' });
    await expect(edit).toHaveAttribute('href', new RegExp(`/spaces/editor/${sector}`));
    await edit.click();
  };
  const dialog = page.getByRole('dialog', { name: '¿Quieres guardar los cambios?' });
  const selectTable = async () => {
    await page.getByTestId('map-elements-tab').click();
    const row = page.getByTestId('map-element-row').filter({ hasText: 'Mesa Ventana' });
    await row.click();
  };
  const x = page.getByTestId('map-element-x');
  type Appearance = {
    room?: { floorPattern?: string };
    elements: Record<
      string,
      {
        variant?: string;
        preset?: string;
        showName?: boolean;
        showCapacity?: boolean;
        labelStyle?: string;
      }
    >;
  };
  const serverAppearance = async (): Promise<Appearance | undefined> => {
    const response = await request.get(API + `/floors/${floor}/sectors`, { headers });
    expect(response.ok()).toBe(true);
    const sectors = (await response.json()) as Array<{ id: string; appearance?: Appearance }>;
    return sectors.find((item) => item.id === sector)?.appearance;
  };
  const clearLocalStyles = async () => {
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('mapit.editor.style.')) localStorage.removeItem(key);
      }
    });
  };
  const monitorPixels = async () => {
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    return page.getByTestId('monitor-canvas').evaluate((element) =>
      Array.from(element.querySelectorAll('canvas'))
        .map((canvas) => canvas.toDataURL())
        .join('|'),
    );
  };
  const persistedTable = async () => {
    const response = await request.get(API + elementPath, { headers });
    expect(response.ok()).toBe(true);
    return (
      (await response.json()) as Array<{
        id: string;
        x: number;
        state: string;
        capacity: number;
        updatedAt: string;
      }>
    ).find((item) => item.id === table)!;
  };
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.goto(editorPath);
  await expect(page.getByRole('heading', { name: 'Editar distribución', exact: true }))
    .toBeVisible({ timeout: 30_000 })
    .catch(async (error: unknown) => {
      await testInfo.attach('editor-startup.json', {
        body: JSON.stringify({ url: page.url(), errors, consoleErrors, failedRequests }, null, 2),
        contentType: 'application/json',
      });
      throw error;
    });
  await expect(save).toHaveCount(0);
  await openMonitor();
  await expect(page).toHaveURL(new RegExp(`/map.*sectorId=${sector}`));
  await expect(dialog).toHaveCount(0);
  await openSectorEditorFromMap();
  await selectTable();
  await page.getByRole('button', { name: 'Acercar', exact: true }).click();
  await expect(save).toHaveCount(0);
  await page.getByRole('button', { name: 'Ajustar a pantalla', exact: true }).click();
  await expect(save).toHaveCount(0);
  await x.fill('115');
  await x.blur();
  await save.click();
  await expect(save).toHaveCount(0);
  expect((await persistedTable()).x).toBe(115);
  await x.fill('120');
  await x.blur();
  await page.getByTestId('element-metadata-capacity').fill('6');
  await page.getByTestId('element-metadata-capacity').blur();
  await expect(save).toBeVisible();
  if (screenshotDir) {
    await page.screenshot({
      path: join(screenshotDir, 'editor-pendiente.png'),
      animations: 'disabled',
    });
  }
  await save.click();
  await expect(save).toHaveCount(0);
  expect((await persistedTable()).x).toBe(120);
  expect((await persistedTable()).state).toBe('OCCUPIED');
  expect((await persistedTable()).capacity).toBe(6);
  await openMonitor();
  await expect(page.getByTestId('monitor-count-OCCUPIED')).toHaveText('1');
  const originalMonitor = await monitorPixels();
  await openSectorEditorFromMap();
  await selectTable();
  await page.getByTestId('map-style-tab').click();
  const scope = page.getByTestId('style-scope');
  await scope.selectOption('similar');
  await page.getByRole('button', { name: 'Moderno', exact: true }).click();
  const preview = page.getByTestId('style-preview');
  await expect(preview).toHaveAttribute('src', /^data:image/);
  const roundPreview = (await preview.getAttribute('src'))!;
  await expect(
    page
      .getByRole('group', { name: 'Forma', exact: true })
      .getByRole('button', { name: 'Redonda', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page
    .getByRole('group', { name: 'Forma', exact: true })
    .getByRole('button', { name: 'Cuadrada', exact: true })
    .click();
  await expect(
    page
      .getByRole('group', { name: 'Forma', exact: true })
      .getByRole('button', { name: 'Cuadrada', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(preview).not.toHaveAttribute('src', roundPreview);
  await expect(save).toHaveCount(0);
  expect((await serverAppearance())?.elements[table]).toBeUndefined();
  const applyStyle = page.getByTestId('style-apply');
  const multiple = page.getByRole('dialog', { name: 'Aplicar estilo a varios elementos' });
  await scope.selectOption('similar');
  await applyStyle.click();
  await expect(multiple).toBeVisible();
  await expect(
    multiple.getByRole('button', { name: 'Aplicar a 4 elementos', exact: true }),
  ).toBeVisible();
  await multiple.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(save).toHaveCount(0);
  await scope.selectOption('selected');
  await page.getByTestId('style-target-' + table).check();
  await page.getByTestId('style-target-' + otherTables[0]!).check();
  await applyStyle.click();
  await expect(
    multiple.getByRole('button', { name: 'Aplicar a 2 elementos', exact: true }),
  ).toBeVisible();
  await multiple.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await scope.selectOption('similar');
  await applyStyle.click();
  await multiple.getByRole('button', { name: 'Aplicar a 4 elementos', exact: true }).click();
  await expect(save).toBeVisible();
  expect((await serverAppearance())?.elements[table]).toBeUndefined();
  await page.locator('mapit-layout-style summary').click();
  await page.getByLabel('Patrón del suelo').selectOption('tile');
  await page.locator('mapit-layout-style summary').click();
  if (screenshotDir) {
    await page.getByRole('button', { name: 'Moderno', exact: true }).scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: join(screenshotDir, 'editor-estilo.png'),
      animations: 'disabled',
    });
  }
  await page.getByTestId('map-advanced-tab').click();
  await expect(page.getByRole('heading', { name: 'Etiqueta en el plano' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Estilos predefinidos' })).toHaveCount(0);
  await page.getByLabel('Mostrar nombre en el plano').uncheck();
  await page.getByLabel('Mostrar capacidad en edición').uncheck();
  await page.getByLabel('Estilo de etiqueta').selectOption('outline');
  if (screenshotDir)
    await page.screenshot({
      path: join(screenshotDir, 'editor-avanzado.png'),
      animations: 'disabled',
    });
  await save.click();
  await expect(save).toHaveCount(0);
  const persistedStyle = await serverAppearance();
  expect(persistedStyle?.room?.floorPattern).toBe('tile');
  for (const id of [table, ...otherTables])
    expect(persistedStyle?.elements[id]?.variant).toBe('square');
  expect(persistedStyle?.elements[table]?.showName).toBe(false);
  await clearLocalStyles();
  await page.reload();
  await selectTable();
  await page.getByTestId('map-style-tab').click();
  await expect(
    page
      .getByRole('group', { name: 'Forma', exact: true })
      .getByRole('button', { name: 'Cuadrada', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  if (screenshotDir)
    await page.screenshot({
      path: join(screenshotDir, 'editor-estilo-guardado.png'),
      animations: 'disabled',
    });
  await openMonitor();
  await expect(page.getByTestId('monitor-count-OCCUPIED')).toHaveText('1');
  expect((await monitorPixels()) !== originalMonitor).toBe(true);
  if (screenshotDir)
    await page.screenshot({
      path: join(screenshotDir, 'editor-estilo-monitoreo.png'),
      animations: 'disabled',
    });
  await openSectorEditorFromMap();
  await selectTable();
  await page.getByTestId('map-style-tab').click();
  await page.getByRole('button', { name: 'Clásico', exact: true }).click();
  await expect(page.getByTestId('style-apply')).toHaveCount(0);
  await expect(save).toBeVisible();
  await page.getByTestId('map-properties-tab').click();
  if (screenshotDir) {
    await page.screenshot({
      path: join(screenshotDir, 'editor-escritorio.png'),
      animations: 'disabled',
    });
  }

  await x.fill('130');
  await x.blur();
  await page.getByRole('link', { name: 'Inicio', exact: true }).first().click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(x).toHaveValue('130');
  await page.goBack();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(x).toHaveValue('130');
  const beforeUnload = page.waitForEvent('dialog');
  const reloadAttempt = page.evaluate(() => location.reload());
  const nativeDialog = await beforeUnload;
  expect(nativeDialog.type()).toBe('beforeunload');
  await nativeDialog.dismiss();
  await reloadAttempt;
  await expect(x).toHaveValue('130');
  await x.fill('140');
  await x.blur();
  await openMonitor();
  await expect(dialog).toBeVisible();
  if (screenshotDir) {
    await page.screenshot({
      path: join(screenshotDir, 'editor-confirmacion.png'),
      animations: 'disabled',
    });
  }
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(x).toHaveValue('140');
  await openMonitor();
  await dialog.getByRole('button', { name: 'Salir sin guardar', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/map.*sectorId=${sector}`));
  expect((await persistedTable()).x).toBe(120);
  expect((await serverAppearance())?.elements[table]?.variant).toBe('square');
  await openSectorEditorFromMap();
  await selectTable();
  await page.getByTestId('map-style-tab').click();
  await expect(
    page
      .getByRole('group', { name: 'Forma', exact: true })
      .getByRole('button', { name: 'Cuadrada', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Industrial', exact: true }).click();
  await page.getByTestId('map-properties-tab').click();
  await expect(x).toHaveValue('120');
  await x.fill('160');
  await x.blur();
  await openMonitor();
  let failSave = true;
  await page.route('**/sectors/' + sector + '/layout', (route) =>
    failSave && route.request().method() === 'PUT'
      ? route.fulfill({ status: 500, json: { title: 'Error de guardado de prueba' } })
      : route.continue(),
  );
  await dialog.getByRole('button', { name: 'Guardar y continuar', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/spaces/editor/${sector}`));
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('alert').first()).toBeVisible();
  expect((await persistedTable()).x).toBe(120);
  expect((await serverAppearance())?.elements[table]?.preset).not.toBe('industrial');
  failSave = false;
  await dialog.getByRole('button', { name: 'Guardar y continuar', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/map.*sectorId=${sector}`));
  expect((await persistedTable()).x).toBe(160);
  expect((await serverAppearance())?.elements[table]?.preset).toBe('industrial');
  await expect(page.getByTestId('monitor-count-OCCUPIED')).toHaveText('1');
  if (screenshotDir) {
    await page.screenshot({
      path: join(screenshotDir, 'editor-monitoreo.png'),
      animations: 'disabled',
    });
  }

  await openSectorEditorFromMap();
  await page.getByTestId('map-elements-tab').click();
  await page.getByRole('button', { name: 'Ambientación', exact: true }).click();
  await page.getByTestId('library-card-base:DECOR').click();
  await page.getByTestId('library-insert').click();
  await expect(save).toBeVisible();
  await expect(page.getByTestId('element-metadata-capacity')).toHaveCount(0);
  await expect(page.getByTestId('element-metadata-label')).toBeVisible();
  await page.getByTestId('element-metadata-label').fill('Planta junto a ventana');
  await page.getByTestId('element-metadata-label').blur();
  await page.getByTestId('map-style-tab').click();
  await expect(
    page
      .getByRole('group', { name: 'Forma', exact: true })
      .getByRole('button', { name: 'Cuadrada', exact: true }),
  ).toHaveCount(0);
  const planter = page
    .getByRole('group', { name: 'Tipo de planta' })
    .getByRole('button', { name: 'Maceta baja', exact: true });
  await planter.click();
  await expect(planter).toHaveAttribute('aria-pressed', 'true');
  await save.click();
  await expect(save).toHaveCount(0);
  expect(Object.values((await serverAppearance())?.elements ?? {})).toContainEqual(
    expect.objectContaining({ variant: 'planter' }),
  );
  await clearLocalStyles();
  await page.reload();
  await selectTable();
  await page.getByTestId('map-style-tab').click();
  await page.locator('mapit-layout-style summary').click();
  await expect(page.getByLabel('Patrón del suelo')).toHaveValue('tile');
  await page.getByTestId('map-advanced-tab').click();
  await expect(page.getByLabel('Mostrar nombre en el plano')).not.toBeChecked();
  await expect(page.getByLabel('Mostrar capacidad en edición')).not.toBeChecked();
  await expect(page.getByLabel('Estilo de etiqueta')).toHaveValue('outline');
  await page.getByTestId('map-properties-tab').click();
  await page.getByTestId('map-elements-tab').click();
  await page.getByTestId('map-element-row').filter({ hasText: 'Planta junto a ventana' }).click();
  await page.getByTestId('map-style-tab').click();
  await expect(planter).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('map-properties-tab').click();
  await expect(page.getByTestId('element-metadata-capacity')).toHaveCount(0);
  await expect(page.getByTestId('element-metadata-label')).toHaveValue('Planta junto a ventana');
  await expect(save).toHaveCount(0);

  if (screenshotDir) {
    await page.screenshot({
      path: join(screenshotDir, 'editor-decoracion.png'),
      animations: 'disabled',
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
    await page.screenshot({
      path: join(screenshotDir, 'editor-movil.png'),
      fullPage: true,
      animations: 'disabled',
    });
  }
  await selectTable();
  await expect(page.getByTestId('element-metadata-label')).toHaveValue('Mesa Ventana');
  await expect(x).toHaveValue('160');
  await x.press('ControlOrMeta+a');
  await x.pressSequentially('180');
  await expect(x).toHaveValue('180');
  await x.press('Tab');
  await expect(x).toHaveValue('180');
  await expect(save).toBeVisible();
  const beforeConcurrent = await persistedTable();
  const concurrentUpdate = await request.put(API + elementPath + '/' + table, {
    headers,
    data: {
      type: 'TABLE',
      label: 'Mesa Ventana',
      capacity: 6,
      x: 170,
      y: 100,
      width: 100,
      height: 100,
      rotation: 0,
    },
  });
  expect(concurrentUpdate.status()).toBe(200);
  const afterConcurrent = await persistedTable();
  expect(afterConcurrent.x).toBe(170);
  expect(afterConcurrent.updatedAt).not.toBe(beforeConcurrent.updatedAt);
  const staleResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      new URL(response.url()).pathname.endsWith(`/sectors/${sector}/layout`),
  );
  await save.click();
  const staleSave = await staleResponse;
  await testInfo.attach('stale-layout-versions.json', {
    body: JSON.stringify(
      {
        beforeConcurrent,
        afterConcurrent,
        saveRequest: staleSave.request().postDataJSON() as unknown,
        saveStatus: staleSave.status(),
      },
      null,
      2,
    ),
    contentType: 'application/json',
  });
  expect(staleSave.status()).toBe(409);
  await expect(page.getByRole('alert').first()).toContainText(/modificado por otro usuario/i);
  await expect(x).toHaveValue('180');
  expect((await persistedTable()).x).toBe(170);
  await page.getByRole('button', { name: 'Recargar sector', exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Salir sin guardar', exact: true }).click();
  await selectTable();
  await expect(x).toHaveValue('170');
  await expect(save).toHaveCount(0);
  await openMonitor();
  await expect(page).toHaveURL(new RegExp(`/map.*sectorId=${sector}`));
  const currentReservations = await request.get(API + '/reservations', {
    headers,
    params: { establishmentId: company.venueId },
  });
  expect(currentReservations.ok()).toBe(true);
  expect((await currentReservations.json()) as Array<{ id: string }>).toContainEqual(
    expect.objectContaining({ id: reservation }),
  );
  expect((await persistedTable()).state).toBe('OCCUPIED');
  const emptyVenue = await create('/establishments', {
    name: 'Sede sin distribución',
    slug: 'sede-sin-distribucion',
    type: 'RESTAURANT',
  });
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: `mapit.establishment.${company.tenantId}.${company.userId}`,
    value: emptyVenue,
  });
  await page.goto('/spaces/editor');
  await expect(page.getByText('Sede sin distribución', { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId('map-save')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Estructura del espacio', exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('region', { name: 'Plano del sector' }).getByRole('status'),
  ).toHaveText(
    'Crea o selecciona un piso desde el panel de Estructura de la izquierda para comenzar.',
  );
  await expect(page.getByTestId('map-canvas')).toBeHidden();
  await expect(page.getByRole('group', { name: 'Herramientas del plano' })).toBeHidden();
  await page.getByRole('button', { name: 'Vista previa', exact: true }).click();
  const prerequisite = page.getByRole('dialog', { name: 'Crea un piso para empezar' });
  await expect(prerequisite).toBeVisible();
  if (screenshotDir) {
    await page.screenshot({
      path: join(screenshotDir, 'editor-prerrequisito.png'),
      animations: 'disabled',
    });
  }
  await expect(
    prerequisite.getByRole('link', { name: 'Estructura del espacio', exact: true }),
  ).toBeVisible();
  await prerequisite.getByRole('button', { name: 'Cerrar', exact: true }).click();
  expect(errors).toEqual([]);
  expect(
    consoleErrors.filter(
      (message) =>
        !/server responded with a status of (500|409)/.test(message) &&
        !/"operation":"api.other","method":"PUT","status":(500|409)/.test(message),
    ),
  ).toEqual([]);
});
