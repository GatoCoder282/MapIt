import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

// Synthetic layout/selection coverage; real inventory and payment live in payment-live.
test('exige fecha y ambas horas antes de consultar el plano público', async ({ page }) => {
  const mapRequests: string[] = [];
  const authorization: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/availability/map')) mapRequests.push(request.url());
    if (request.url().includes('/public/') && request.headers()['authorization'])
      authorization.push(request.url());
  });
  await page.goto('/disponibilidad/demo/la-bahia?startTime=%22%5D');
  await expect(page.getByLabel('Fecha de reserva', { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByLabel('Hora de inicio', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Hora de fin', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Buscar espacios', exact: true }).click();
  await expect(page.getByTestId('availability-continue')).toHaveCount(0);
  await expect(page.getByRole('img', { name: /^Plano/ })).toHaveCount(0);
  expect(mapRequests).toEqual([]);
  expect(authorization).toEqual([]);
  await expect(page).not.toHaveURL(/login/);
});

test('elige fecha y horario, selecciona en el mapa y continúa sin sesión de staff', async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  const staffHeaders: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/public/') && request.headers()['authorization'])
      staffHeaders.push(request.url());
  });
  await page.route(
    '**/public/tenants/availability-design/establishments/venue**',
    async (route) => {
      const url = new URL(route.request().url());
      if (!url.pathname.endsWith('/availability/map')) {
        await route.fulfill({
          json: {
            tenantSlug: 'availability-design',
            tenantName: 'MapIt',
            establishmentSlug: 'venue',
            name: 'Pollos choco Zona Sud',
            timezone: 'America/La_Paz',
            address: 'Zona Sud',
          },
        });
        return;
      }
      await route.fulfill({
        json: {
          establishmentId: 'venue-id',
          establishmentName: 'Pollos choco Zona Sud',
          tenantSlug: 'availability-design',
          establishmentSlug: 'venue',
          timezone: 'America/La_Paz',
          date: url.searchParams.get('date'),
          startTime: url.searchParams.get('startTime'),
          endTime: url.searchParams.get('endTime'),
          startsAt: '2026-11-08T14:00:00Z',
          endsAt: '2026-11-08T15:00:00Z',
          mode: 'INTERVAL',
          floors: [
            {
              id: 'floor',
              name: 'Planta baja',
              level: 0,
              canvasWidth: 500,
              canvasHeight: 320,
              sectors: [
                {
                  id: 'sector',
                  name: 'Salón',
                  width: 500,
                  height: 320,
                  x: 0,
                  y: 0,
                  rotation: 0,
                  elements: Array.from({ length: 6 }, (_, index) => ({
                    id: `table-${index + 1}`,
                    name: `Mesa ${index + 1}`,
                    label: `Mesa ${index + 1}`,
                    type: 'TABLE',
                    capacity: index === 2 ? 6 : 4,
                    x: 70 + (index % 3) * 145,
                    y: 45 + Math.floor(index / 3) * 135,
                    width: 75,
                    height: 70,
                    rotation: 0,
                    selectable: index !== 5,
                    availability: index === 5 ? 'RESERVED' : 'AVAILABLE',
                  })),
                },
              ],
            },
          ],
        },
      });
    },
  );
  if (!testInfo.project.name.includes('mobile'))
    await page.setViewportSize({ width: 1672, height: 941 });
  await page.goto(
    '/disponibilidad/availability-design/venue?date=2026-11-08&startTime=10:00&endTime=11:00',
  );
  await page.getByRole('button', { name: 'Mes siguiente', exact: true }).click();
  await page.getByRole('button', { name: 'Mes anterior', exact: true }).click();
  await page.getByRole('button', { name: '8 de noviembre de 2026', exact: true }).click();
  await page
    .getByRole('group', { name: 'Elegí la hora de inicio' })
    .getByRole('button', { name: '10:00', exact: true })
    .click();
  await expect(page.getByLabel('Hora de fin', { exact: true })).toHaveValue('11:00');
  await page.getByLabel('Personas', { exact: true }).fill('4');
  await expect(page.getByText('Hacé tu reserva', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Buscar espacios', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '5 espacios disponibles', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Personas', { exact: true }).fill('21');
  await expect(page.getByTestId('availability-choose')).toBeDisabled();
  await page.getByLabel('Personas', { exact: true }).fill('4');
  await expect(page.getByTestId('space-table-6')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Vista del espacio', exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole('img', { name: /^Plano/ })).toHaveCount(0);
  await expect(page.getByTestId('availability-continue')).toHaveCount(0);
  await page.getByTestId('availability-choose').click();
  await expect(page).toHaveURL(/\/elegir-espacio\/availability-design\/venue\?/);
  await expect(page.getByTestId('space-selection-page')).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('people')).toBe('4');
  await expect(page.getByTestId('availability-continue')).toHaveCount(0);
  await page.getByRole('link', { name: 'Cambiar fecha u horario', exact: true }).click();
  await expect(page.getByLabel('Personas', { exact: true })).toHaveValue('4');
  await expect(page.getByLabel('Hora de inicio', { exact: true })).toHaveValue('10:00');
  await expect(page.getByLabel('Hora de fin', { exact: true })).toHaveValue('11:00');
  await page.getByRole('button', { name: 'Buscar espacios', exact: true }).click();
  await expect(page.getByTestId('availability-choose')).toBeVisible();
  const firstStepOutput = join(process.cwd(), 'screenshots', 'availability-form');
  await mkdir(firstStepOutput, { recursive: true });
  await page.evaluate(async () => {
    window.scrollTo(0, 0);
    await document.fonts.ready;
  });
  await page.screenshot({
    path: join(firstStepOutput, testInfo.project.name + '.png'),
    fullPage: true,
  });
  await page.getByTestId('availability-choose').click();
  if (testInfo.project.name.includes('mobile')) {
    await page.getByTestId('space-table-3').click();
  } else {
    await page
      .getByRole('img', { name: 'Plano del sector: Salón', exact: true })
      .click({ position: { x: 395, y: 80 } });
  }
  await expect(page).toHaveURL(/\/elegir-espacio\/availability-design\/venue\?/);
  await expect(page.getByRole('heading', { name: 'Elegí tu espacio', exact: true })).toBeVisible();
  await expect(page.getByTestId('availability-selection')).toContainText('Mesa 3');
  const continuation = page.getByTestId('availability-continue');
  await expect(continuation).toHaveAttribute(
    'href',
    '/reservar/availability-design/venue/table-3?date=2026-11-08&startTime=10:00&endTime=11:00',
  );
  await page.getByTestId('space-table-4').click();
  await expect.poll(() => new URL(page.url()).searchParams.get('elementId')).toBe('table-4');
  await page.reload();
  await expect(page.getByTestId('availability-selection')).toContainText('Mesa 4');
  await expect(page.getByTestId('space-table-4')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('space-table-3').click();
  await expect(page.getByTestId('availability-selection')).toContainText('Mesa 3');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect
    .poll(() =>
      page
        .getByTestId('space-selection-page')
        .evaluate((element) => getComputedStyle(element.parentElement!).animationName),
    )
    .toMatch(/selection-fade$/);
  const overflow = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(overflow.content).toBeLessThanOrEqual(overflow.width);
  const output = join(process.cwd(), 'screenshots', 'space-selection-redesign');
  await mkdir(output, { recursive: true });
  await page.evaluate(async () => {
    window.scrollTo(0, 0);
    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  await page.screenshot({
    path: join(output, `${testInfo.project.name}.png`),
    fullPage: testInfo.project.name.includes('mobile'),
  });
  expect(staffHeaders).toEqual([]);
  await expect(page).not.toHaveURL(/login/);
  await continuation.click();
  await expect(page).toHaveURL(/\/reservar\/availability-design\/venue\/table-3\?/);
  await expect(page.getByTestId('booking-descriptor')).toContainText('Mesa 3');
  await expect(page.getByTestId('booking-descriptor')).toContainText('10:00');
});
