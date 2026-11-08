import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

test('checkout desde una reserva creada: anticipo, fallo recuperable y comprobante verificado', async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  const reservationId = '40000000-0000-0000-0000-000000000001';
  const scope = '/api/v1/public/tenants/payment-design/establishments/venue';
  const reservation = {
    id: reservationId,
    establishmentId: 'venue',
    establishmentName: 'Pollos choco Av.America',
    tenantSlug: 'payment-design',
    establishmentSlug: 'venue',
    timezone: 'America/La_Paz',
    startsAt: '2030-12-24T18:00:00Z',
    endsAt: '2030-12-24T18:33:00Z',
    status: 'CREATED',
    spaces: [
      {
        id: 'table',
        name: 'Mesa sin nombre',
        floor: 'Planta Baja',
        sector: 'Comedor',
        type: 'TABLE',
        label: null,
        capacity: 4,
        x: 351,
        y: 276,
        state: 'RESERVED',
      },
    ],
  };
  const method = {
    id: 'method',
    displayName: 'QR de prueba',
    provider: 'MOCK_GATEWAY',
    verification: 'AUTOMATIC',
    staticQrImage: null,
    simulationPath: '/simulacion/qr/30000000-0000-0000-0000-000000000003',
  };
  let state: 'NEW' | 'PENDING' | 'CONFIRMED' = 'NEW';
  let writes = 0;
  const payment = () => ({
    id: '20000000-0000-0000-0000-000000000002',
    provider: 'MOCK_GATEWAY',
    status: state,
    currency: 'BOB',
    amount: '10.00',
    totalAmount: null,
    paidAmount: state === 'CONFIRMED' ? '10.00' : '0.00',
    expiresAt: '2030-12-24T18:30:00Z',
    externalReference: 'charge-reference',
  });
  await page.clock.setFixedTime(new Date('2030-12-20T12:00:00Z'));
  await page.route(`**${scope}`, (route) =>
    route.fulfill({
      json: {
        id: 'venue',
        name: reservation.establishmentName,
        tenantName: 'Pollos Choco',
        tenantSlug: reservation.tenantSlug,
        establishmentSlug: 'venue',
        timezone: reservation.timezone,
        address: 'Av. América',
        type: 'RESTAURANT',
      },
    }),
  );
  await page.route(`**${scope}/reservations/${reservationId}/checkout`, (route) => {
    expect(route.request().headers()['authorization']).toBeUndefined();
    expect(route.request().headers()['x-reservation-access']).toBe('A'.repeat(43));
    return route.fulfill({
      json: {
        reservation: { ...reservation, status: state === 'CONFIRMED' ? 'CONFIRMED' : 'CREATED' },
        available: state === 'NEW',
        unavailableReason: state === 'NEW' ? null : 'PAYMENT_PENDING',
        currency: 'BOB',
        amount: '10.00',
        totalAmount: null,
        paidAmount: state === 'CONFIRMED' ? '10.00' : '0.00',
        balanceAmount: null,
        methods: [method],
        historicalMethod: state === 'NEW' ? null : method,
        payment: state === 'NEW' ? null : payment(),
      },
    });
  });
  await page.route(`**${scope}/reservations/${reservationId}/payments`, (route) => {
    writes++;
    expect(route.request().headers()['authorization']).toBeUndefined();
    if (writes === 1) return route.fulfill({ status: 500, json: { title: 'Temporary failure' } });
    state = 'PENDING';
    return route.fulfill({ status: 201, json: payment() });
  });
  const receiptPayload = () => ({
    token: 'B'.repeat(43),
    reservation: { ...reservation, status: 'CONFIRMED' },
    payment: payment(),
    paidAmount: '10.00',
    currency: 'BOB',
    totalAmount: null,
    balanceAmount: null,
    checkIn: 'NOT_CHECKED_IN',
    expiresAt: '2030-12-25T18:00:00Z',
  });
  await page.route(`**${scope}/reservations/${reservationId}/receipt`, (route) => {
    expect(state).toBe('CONFIRMED');
    return route.fulfill({ json: receiptPayload() });
  });
  await page.route(`**${scope}/receipts/${'B'.repeat(43)}`, (route) => {
    expect(route.request().headers()['authorization']).toBeUndefined();
    return route.fulfill({ json: receiptPayload() });
  });
  if (!testInfo.project.name.includes('mobile'))
    await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto(
    `/reservar/payment-design/venue/table?reservationId=${reservationId}#access=${'A'.repeat(43)}`,
  );
  await expect(page).toHaveURL(new RegExp(`/pago/payment-design/venue/${reservationId}`), {
    timeout: 30_000,
  });
  await expect(page.getByRole('heading', { name: 'Completá tu anticipo' })).toBeVisible();
  await expect(page.getByTestId('checkout-summary')).toContainText('Mesa sin nombre');
  await expect(page.getByTestId('checkout-summary')).toContainText('x 351 · y 276');
  await expect(page.getByTestId('payment-amount')).toContainText('10,00');
  await expect(page.getByTestId('payment-status')).toContainText('Cobro por iniciar');
  await expect(page.getByTestId('receipt-link')).toHaveCount(0);
  expect(writes).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  const output = join(process.cwd(), 'screenshots', 'checkout-redesign');
  await mkdir(output, { recursive: true });
  await page.evaluate(async () => {
    window.scrollTo(0, 0);
    await document.fonts.ready;
  });
  await page.screenshot({ path: join(output, `${testInfo.project.name}.png`), fullPage: true });
  await page.getByTestId('start-payment').click();
  await expect(page.getByRole('alert')).toContainText('No pudimos completar');
  await page.getByTestId('start-payment').click();
  await expect(page.getByTestId('payment-status')).toHaveAttribute('data-status', 'PENDING');
  await expect(page.getByTestId('start-payment')).toHaveCount(0);
  await expect(page.getByTestId('receipt-link')).toHaveCount(0);
  await expect(page.getByTestId('attempt-qr').getByRole('img')).toBeVisible();
  await expect(page.getByTestId('payment-status')).toContainText('No es un QR bancario');
  await expect(page.getByTestId('payment-qr-panel')).toContainText('Simulado — sin dinero real');
  await page.getByTestId('verify-payment').click();
  await expect(page.getByTestId('payment-status')).toHaveAttribute('data-status', 'PENDING');
  await expect(page.getByTestId('receipt-link')).toHaveCount(0);
  const qrOutput = join(process.cwd(), 'screenshots', 'payment-qr-redesign');
  await mkdir(qrOutput, { recursive: true });
  await page.evaluate(async () => {
    window.scrollTo(0, 0);
    await document.fonts.ready;
  });
  await page.screenshot({ path: join(qrOutput, testInfo.project.name + '.png'), fullPage: true });
  state = 'CONFIRMED';
  await page.getByTestId('verify-payment').click();
  await expect(page.getByTestId('receipt-link')).toBeVisible();
  expect(writes).toBe(2);
  await page.getByTestId('receipt-link').click();
  await expect(page.getByTestId('receipt-page')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pago de prueba confirmado' })).toBeVisible();
  await expect(page.getByTestId('receipt-qr').getByRole('img')).toHaveAttribute(
    'src',
    /^data:image\/png;base64,/,
  );
  await expect(page.getByTestId('receipt-page')).toContainText('Mesa sin nombre');
  await expect(page.getByTestId('receipt-page')).toContainText('Llegada pendiente');
  await expect(page.getByText('Comprobante digital MapIt', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('public-establishment-identity')).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  const receiptOutput = join(process.cwd(), 'screenshots', 'receipt-redesign');
  await mkdir(receiptOutput, { recursive: true });
  await page.evaluate(async () => {
    window.scrollTo(0, 0);
    await document.fonts.ready;
  });
  await page.screenshot({
    path: join(receiptOutput, testInfo.project.name + '.png'),
    fullPage: true,
  });
  await page.getByRole('link', { name: 'Volver al pago', exact: true }).click();
  await expect(page.getByTestId('checkout-page')).toBeVisible();
  await expect(page).not.toHaveURL(/login/);
});
