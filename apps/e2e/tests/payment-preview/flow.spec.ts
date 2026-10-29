import { expect, test, type Page } from '@playwright/test';
import {
  PREVIEW_CHECKOUT_PATH,
  PREVIEW_RECEIPT_PATH,
  PREVIEW_RECEIPT_TOKEN,
  PREVIEW_ESTABLISHMENT_ID,
} from '../../../../libs/api-client/src/lib/payment-preview';

const PUBLIC = 'http://localhost:4500';
const CONSOLE = 'http://localhost:4400';

async function prepare(page: Page, enabled = true): Promise<void> {
  await page.route('**/api/v1/establishments/accessible', (route) =>
    route.fulfill({
      json: [
        {
          id: PREVIEW_ESTABLISHMENT_ID,
          name: 'Establecimiento de demostración',
          slug: 'demo',
          address: 'Dirección simulada',
          timezone: 'America/La_Paz',
          canManagePayments: true,
          canCheckIn: true,
        },
      ],
    }),
  );
  await page.route('**/assets/config.json', (route) =>
    route.fulfill({
      json: {
        apiBaseUrl: 'http://localhost:8080/api/v1',
        consoleBaseUrl: CONSOLE,
        paymentPublicOrigin: PUBLIC,
        paymentPreviewEnabled: enabled,
        environment: 'development',
        unleashProxyUrl: '',
        unleashClientKey: '',
      },
    }),
  );
  await page.addInitScript(() => {
    if (location.origin !== 'http://localhost:4400') return;
    sessionStorage.setItem(
      'mapit.auth.session',
      JSON.stringify({
        accessToken: 'demo.fixture.signature',
        tokenType: 'Bearer',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        tenantSlug: 'demo',
        user: {
          id: '69000000-0000-0000-0000-000000000003',
          tenantId: 'demo',
          email: 'operador@demo.test',
          fullName: 'Operador de demostración',
          role: 'ADMIN',
        },
      }),
    );
  });
}

async function screenshot(page: Page, name: string): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
  ).toBe(true);
  await expect(page).toHaveScreenshot(name, {
    fullPage: true,
    animations: 'disabled',
    maxDiffPixelRatio: 0.02,
    mask: [page.getByTestId('arrival-audit-time')],
  });
}

test('checkout → comprobante → lectura QR y llegada: únicamente simulación frontend', async ({
  page,
}) => {
  test.setTimeout(120000);
  await prepare(page);
  const financialRequests: string[] = [];
  page.on('request', (request) => {
    if (/\/api\/v1\/(payments|reservations|check-in)(\/|\?|$)/.test(request.url()))
      financialRequests.push(request.url());
  });
  await page.goto(PUBLIC + PREVIEW_CHECKOUT_PATH, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('checkout-page')).toBeVisible();
  await expect(page.getByTestId('preview-banner')).toBeVisible();
  await expect(page.getByTestId('payment-status')).toBeVisible();
  await expect(page.getByTestId('payment-scenario')).toHaveValue('PENDING');
  await screenshot(page, 'checkout.png');
  // UI-only evidence: this does not prove expiry by the backend clock.
  await page.getByTestId('payment-scenario').selectOption('EXPIRED');
  await expect(page.getByTestId('payment-status')).toHaveAttribute('data-status', 'EXPIRED');
  await expect(page.getByTestId('receipt-link')).toHaveCount(0);
  await page.getByTestId('payment-scenario').selectOption('PENDING');
  await page.getByTestId('simulate-confirm').click();
  await expect(page.getByTestId('receipt-link')).toBeVisible();
  await page.getByTestId('receipt-link').click();
  await expect(page).toHaveURL(PUBLIC + PREVIEW_RECEIPT_PATH);
  await expect(page.getByTestId('receipt-page')).toBeVisible();
  await expect(page.getByTestId('receipt-qr')).toBeVisible();
  await expect(page.getByTestId('receipt-qr').getByRole('img')).toBeVisible();
  await expect(page.getByTestId('receipt-qr').getByRole('img')).toHaveAttribute(
    'src',
    /^data:image\/png;base64,/,
  );
  await expect(page.getByTestId('preview-banner')).toBeVisible();
  await screenshot(page, 'receipt.png');
  if (page.viewportSize()?.width === 390) {
    await page.setViewportSize({ width: 320, height: 800 });
    await expect(page.getByTestId('receipt-qr').getByRole('img')).toBeVisible();
    await screenshot(page, 'receipt-320.png');
    await page.setViewportSize({ width: 390, height: 844 });
  }

  await page.goto(CONSOLE + '/check-in', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('check-in-page')).toBeVisible();
  await expect(page.getByTestId('preview-banner')).toBeVisible();
  await page.getByTestId('check-in-venue').selectOption(PREVIEW_ESTABLISHMENT_ID);
  // Una entrada alterada no resuelve una reserva ni habilita la llegada.
  await page.getByTestId('check-in-code').fill('https://evil.test' + PREVIEW_RECEIPT_PATH);
  await page.getByTestId('lookup-receipt').click();
  await expect(page.getByTestId('register-arrival')).not.toBeVisible();
  await page.getByTestId('check-in-code').fill(PREVIEW_RECEIPT_TOKEN);
  await page.getByTestId('lookup-receipt').click();
  await expect(page.getByTestId('register-arrival')).toBeEnabled();
  await screenshot(page, 'check-in.png');
  // El lector utiliza ZXing real con video de fixture, nunca una cámara física.
  await page.getByTestId('check-in-code').fill('');
  await page.getByTestId('scanner-start').click();
  await expect(page.getByTestId('check-in-code')).toHaveValue(PUBLIC + PREVIEW_RECEIPT_PATH, {
    timeout: 20000,
  });
  await expect(page.getByTestId('register-arrival')).toBeEnabled();
  await page.getByTestId('register-arrival').click();
  await expect(page.getByTestId('check-in-status')).toContainText(
    /registrada|CHECKED_IN|ACTIVE|activa/i,
  );
  await screenshot(page, 'arrival.png');
  expect(financialRequests).toEqual([]);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByTestId('check-in-code').focus();
  await expect(page.getByTestId('check-in-code')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('lookup-receipt')).toBeFocused();
  const transform = await page
    .getByTestId('lookup-receipt')
    .evaluate((element) => getComputedStyle(element).transform);
  expect(transform).toBe('none');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('check-in-status')).toContainText(
    /registrada|CHECKED_IN|ACTIVE|activa/i,
  );
  await expect(page.getByTestId('register-arrival')).toBeDisabled();
});

test('sin opt-in las rutas finales no habilitan los mocks', async ({ page }) => {
  await prepare(page, false);
  await page.goto(PUBLIC + PREVIEW_CHECKOUT_PATH, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('preview-banner')).toHaveCount(0);
  await expect(page.getByTestId('simulate-confirm')).toHaveCount(0);
  await page.goto(CONSOLE + '/check-in', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('register-arrival')).not.toBeVisible();
  await expect(page.getByTestId('check-in-scenario')).not.toBeVisible();
  await expect(page.getByTestId('preview-banner')).not.toBeVisible();
});
