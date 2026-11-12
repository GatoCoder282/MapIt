import { expect, test } from '@playwright/test';

import { companyAdminFixture } from './company-admin-fixture';

const API = process.env['API_BASE_URL'] ?? 'http://localhost:8080/api/v1';

test.use({ trace: 'off', screenshot: 'off', video: 'off', reducedMotion: 'reduce' });

test('entra directamente desde /login con el correo de la empresa', async ({ request, page }) => {
  const { email, password } = await companyAdminFixture(request);

  if (process.env['API_BASE_URL']) {
    await page.route('**/assets/config.json', async (route) => {
      const response = await route.fetch();
      const config = (await response.json()) as Record<string, unknown>;
      const wsUrl = new URL('/ws', API);
      wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      await route.fulfill({ response, json: { ...config, apiBaseUrl: API, wsUrl: wsUrl.href } });
    });
  }
  await page.goto('/login');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
});
