import { expect, test } from '@playwright/test';
import type { MockQrConfiguration } from '../../../../libs/api-client/src/lib/generated/model/mock-qr-configuration';
import { readFileSync } from 'node:fs';
import { fixtureFile, type LiveFixture } from './setup';

test.use({ hasTouch: true });

test('Mock QR del establecimiento activo → guardar UUID e ISO reales → editar y regenerar', async ({
  page,
}) => {
  const fixture = JSON.parse(readFileSync(fixtureFile, 'utf8')) as LiveFixture;
  const endpoint = fixture.api + '/payment-methods/mock-qr';
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/assets/config.json', (route) =>
    route.fulfill({
      json: {
        apiBaseUrl: fixture.api,
        paymentPublicOrigin: 'http://localhost:4500',
        environment: 'development',
        unleashProxyUrl: '',
        unleashClientKey: '',
      },
    }),
  );
  await page.addInitScript((session) => {
    sessionStorage.setItem('mapit.auth.session', JSON.stringify(session));
  }, fixture.session);
  await page.goto('http://localhost:4400/administration/settings/payment-methods');

  const operationalContext = page.getByRole('dialog', {
    name: '¿Con cuál establecimiento querés entrar?',
  });
  await operationalContext.getByRole('radio', { name: /Navegador — Centro/ }).check();
  await operationalContext.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Agregar método', exact: true }).click();
  await page.getByRole('radio', { name: /Mock \(desarrollo\)/ }).check();
  const next = page.getByRole('button', { name: 'Siguiente', exact: true });
  await next.click();
  const country = page.getByRole('combobox', { name: 'País', exact: true });
  await expect(page.getByRole('combobox', { name: 'Establecimiento', exact: true })).toHaveCount(0);
  await country.fill('BO');
  await page.getByRole('option', { name: 'Bolivia (BO)', exact: true }).click();
  await page.getByLabel(/^Banco/).fill('Banco de prueba');
  await page.getByLabel('Titular de la cuenta', { exact: true }).fill('Titular simulado');
  await page.getByLabel('Referencia de cuenta', { exact: true }).fill('REFERENCIA-DEMO');
  await next.click();
  const createdResponse = page.waitForResponse(
    (response) => response.url() === endpoint && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Guardar método', exact: true }).click();
  const created = await createdResponse;
  expect(created.status()).toBe(201);
  expect(created.request().postDataJSON()).toMatchObject({
    establishmentId: fixture.otherVenue,
    country: 'BO',
    bankName: 'Banco de prueba',
  });
  const configuration = (await created.json()) as MockQrConfiguration;
  await expect(page.getByRole('heading', { name: 'Método de pago creado' })).toBeVisible();

  await page.reload();
  const actions = page.getByRole('button', {
    name: 'Acciones de Mock (desarrollo) · Banco de prueba',
  });
  const edit = async () => {
    await actions.click();
    await page.getByRole('menuitem', { name: 'Editar', exact: true }).click();
  };
  await edit();
  await expect(country).toHaveValue('Bolivia (BO)');
  await expect(page.getByLabel('Referencia de cuenta', { exact: true })).toHaveValue(
    'REFERENCIA-DEMO',
  );
  await expect(page.getByRole('img', { name: /QR de prueba de MapIt/ })).toBeVisible();
  await country.fill('peru');
  const countryOptions = page.getByRole('listbox', { name: 'País', exact: true });
  await expect(countryOptions.getByRole('option')).toHaveCount(1);
  await expect(countryOptions.getByRole('option', { name: 'Perú (PE)' })).toBeVisible();
  await country.press('Escape');
  await next.click();
  await expect(page.getByRole('heading', { name: 'Configurar Mock' })).toBeVisible();
  expect(await country.evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(
    true,
  );
  await country.fill('peru');
  await country.press('Enter');
  const updatedResponse = page.waitForResponse(
    (response) =>
      response.url() === endpoint + '/' + configuration.id && response.request().method() === 'PUT',
  );
  await next.click();
  await page.getByRole('button', { name: 'Guardar método', exact: true }).click();
  expect((await updatedResponse).status()).toBe(200);
  await page.reload();
  await edit();
  await expect(country).toHaveValue('Perú (PE)');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await actions.click();
  await page.getByRole('menuitem', { name: 'Desactivar', exact: true }).click();
  await actions.click();
  await expect(page.getByRole('menuitem', { name: 'Activar', exact: true })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Editar', exact: true }).click();
  const regeneratedResponse = page.waitForResponse(
    (response) => response.url() === endpoint + '/' + configuration.id + '/regenerate',
  );
  await page.getByRole('button', { name: 'Regenerar QR', exact: true }).click();
  const regenerated = (await (await regeneratedResponse).json()) as MockQrConfiguration;
  expect(regenerated.simulationToken).not.toBe(configuration.simulationToken);
  await expect(page.getByRole('img', { name: /QR de prueba de MapIt/ })).toBeVisible();
  await country.click();
  await country.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  await country.tap();
  await expect(page.getByRole('option', { name: 'Perú (PE)' })).toBeVisible();
  await page.getByRole('option', { name: 'Perú (PE)' }).tap();
  await expect(country).toHaveValue('Perú (PE)');
  await expect(country).toHaveAttribute('aria-expanded', 'false');
  expect(errors).toEqual([]);
});
