import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';

import { companyAdminFixture } from './company-admin-fixture';

const API = process.env['API_BASE_URL'] ?? 'http://localhost:8080/api/v1';
const MAILPIT = process.env['MAILPIT_URL'] ?? 'http://localhost:8025';
const PUBLIC = process.env['PUBLIC_WEB_URL'] ?? 'http://localhost:4300';
const CONSOLE = process.env['CONSOLE_URL'] ?? 'http://localhost:4200';
const MEMBER_PASSWORD = 'S3cur3?M3mber!';

interface MailList {
  messages?: { ID: string; To?: { Address: string }[] }[];
}

async function invitationLink(request: APIRequestContext, email: string, previousId?: string) {
  let id = '';
  await expect(async () => {
    const inbox = await request.get(`${MAILPIT}/api/v1/messages`);
    expect(inbox.ok()).toBe(true);
    const messages = ((await inbox.json()) as MailList).messages ?? [];
    id =
      messages.find(
        (message) => message.ID !== previousId && message.To?.some((to) => to.Address === email),
      )?.ID ?? '';
    expect(id).not.toBe('');
  }).toPass({ timeout: 20_000 });
  const detail = await request.get(`${MAILPIT}/api/v1/message/${id}`);
  expect(detail.ok()).toBe(true);
  const text = ((await detail.json()) as { Text: string }).Text;
  const match = text.match(/\/activar\?tenant=([a-z0-9-]+)&token=([A-Za-z0-9_-]+)/);
  expect(match).not.toBeNull();
  return { id, slug: match![1], token: match![2] };
}

test.describe('HU-1.04 — administración de usuarios', () => {
  test('invitación persistente, reenvío, activación, cambio de rol y baja', async ({
    page,
    request,
    browser,
  }) => {
    test.setTimeout(150_000);
    const admin = await companyAdminFixture(request);
    const email = `member-${randomUUID()}@mapit.test`;
    const adminLogin = await request.post(`${API}/auth/login`, {
      data: { tenantSlug: admin.slug, email: admin.email, password: admin.password },
    });
    expect(adminLogin.status()).toBe(200);
    const adminToken = ((await adminLogin.json()) as { accessToken: string }).accessToken;

    const unauthorizedPaths: string[] = [];
    page.on('response', (response) => {
      if (response.status() === 401) unauthorizedPaths.push(new URL(response.url()).pathname);
    });
    await page.goto(`/empresa/${admin.slug}/login`);
    await page.getByRole('textbox', { name: /correo/i }).fill(admin.email);
    await page.getByLabel('Contraseña', { exact: true }).fill(admin.password);
    const browserLogin = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/v1/auth/login') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /iniciar sesi/i }).click();
    expect((await browserLogin).status()).toBe(200);
    await expect(page).toHaveURL(/\/home/);
    const sessionStored = await page.evaluate(() =>
      Boolean(
        sessionStorage.getItem('mapit.auth.session') || localStorage.getItem('mapit.auth.session'),
      ),
    );
    expect(sessionStored, `sesión Angular; 401 en ${unauthorizedPaths.join(', ')}`).toBe(true);
    await page.goto('/users');
    await expect
      .poll(async () =>
        (await page.getByTestId('users-invite-form').isVisible())
          ? 'visible'
          : `URL ${page.url()}, 401: ${unauthorizedPaths.join(', ')}, sesión: ${await page.evaluate(() => Boolean(sessionStorage.getItem('mapit.auth.session') || localStorage.getItem('mapit.auth.session')))}`,
      )
      .toBe('visible');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByTestId('users-invite-form').locator('input[type=password]')).toHaveCount(
      0,
    );
    await expect(page.getByTestId('users-invite-role').locator('option')).toHaveCount(2);
    await expect(
      page
        .getByTestId('users-accounts')
        .getByTestId('users-account-row')
        .first()
        .getByTestId('users-deactivate'),
    ).toHaveCount(0);
    await expect(page.getByRole('button', { name: /reactivar|eliminar/i })).toHaveCount(0);

    await page.getByTestId('users-invite-email').fill(email);
    await page.getByTestId('users-invite-role').selectOption('MANAGER');
    const issued = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/v1/users') && response.request().method() === 'POST',
    );
    await page.getByTestId('users-invite-submit').click();
    const accepted = await issued;
    expect(accepted.status()).toBe(202);
    const listed = await request.get(`${API}/user-invitations`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(listed.status()).toBe(200);
    const firstId = (
      (await listed.json()) as { content: { id: string; email: string }[] }
    ).content.find((item) => item.email === email)?.id;
    expect(firstId).toBeTruthy();
    const invitationRow = page
      .getByTestId('users-invitations')
      .getByTestId('users-invitation-row')
      .filter({ hasText: email });
    await expect(invitationRow).toBeVisible();
    await expect(invitationRow).toContainText(/SMTP/i);
    await expect(invitationRow).not.toContainText(/entregado al destinatario/i);
    const firstLink = await invitationLink(request, email);
    const otherTenant = await companyAdminFixture(request);
    const otherLogin = await request.post(`${API}/auth/login`, {
      data: {
        tenantSlug: otherTenant.slug,
        email: otherTenant.email,
        password: otherTenant.password,
      },
    });
    expect(otherLogin.status()).toBe(200);
    const otherToken = ((await otherLogin.json()) as { accessToken: string }).accessToken;
    const otherEmail = `other-${randomUUID()}@mapit.test`;
    expect(
      (
        await request.post(`${API}/users`, {
          headers: { Authorization: `Bearer ${otherToken}` },
          data: { email: otherEmail, role: 'STAFF' },
        })
      ).status(),
    ).toBe(202);
    await page.reload();
    await expect(invitationRow).toBeVisible();
    await expect(page.getByTestId('users-invitations')).not.toContainText(otherEmail);
    const recovered = await request.get(`${API}/user-invitations`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(recovered.status()).toBe(200);
    expect(
      ((await recovered.json()) as { content: { id: string }[] }).content.some(
        (item) => item.id === firstId,
      ),
    ).toBe(true);

    await expect(invitationRow.getByTestId('users-invitation-resend')).toBeEnabled({
      timeout: 45_000,
    });
    const resent = page.waitForResponse((response) =>
      response.url().endsWith(`/api/v1/user-invitations/${firstId}/resend`),
    );
    await invitationRow.getByTestId('users-invitation-resend').click();
    const resendResponse = await resent;
    expect(resendResponse.status()).toBe(202);
    const refreshed = await request.get(`${API}/user-invitations`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(refreshed.status()).toBe(200);
    const secondId = (
      (await refreshed.json()) as { content: { id: string; email: string }[] }
    ).content.find((item) => item.email === email)?.id;
    expect(secondId).toBeTruthy();
    expect(secondId).not.toBe(firstId);
    const secondLink = await invitationLink(request, email, firstLink.id);
    const obsolete = await request.post(`${API}/auth/activate`, {
      data: {
        tenantSlug: admin.slug,
        token: firstLink.token,
        password: MEMBER_PASSWORD,
        passwordConfirm: MEMBER_PASSWORD,
      },
    });
    expect(obsolete.status()).toBe(400);

    const publicPage = await browser.newPage();
    try {
      await publicPage.goto(
        `${PUBLIC}/activar?tenant=${secondLink.slug}&token=${secondLink.token}`,
      );
      const passwords = publicPage.locator('input[autocomplete="new-password"]');
      await passwords.first().fill(MEMBER_PASSWORD);
      await passwords.nth(1).fill(MEMBER_PASSWORD);
      await publicPage.getByRole('button', { name: /activar cuenta/i }).click();
      await expect(publicPage.getByRole('status')).toBeVisible();
    } finally {
      await publicPage.close();
    }
    await page.reload();
    await expect(invitationRow).toHaveCount(0);
    const account = page
      .getByTestId('users-accounts')
      .getByTestId('users-account-row')
      .filter({ hasText: email });
    await expect(account).toBeVisible();
    const usersResponse = await request.get(`${API}/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(usersResponse.status()).toBe(200);
    const memberId = (
      (await usersResponse.json()) as { content: { id: string; email: string }[] }
    ).content.find((item) => item.email === email)?.id;
    expect(memberId).toBeTruthy();

    const employeeContext = await browser.newContext({ baseURL: CONSOLE });
    try {
      const employee = await employeeContext.newPage();
      await employee.goto(`/empresa/${admin.slug}/login`);
      await employee.getByRole('textbox', { name: /correo/i }).fill(email);
      await employee.getByLabel('Contraseña', { exact: true }).fill(MEMBER_PASSWORD);
      await employee.getByRole('button', { name: /iniciar sesi/i }).click();
      await expect(employee).toHaveURL(/\/home/);
      const memberLogin = await request.post(`${API}/auth/login`, {
        data: { tenantSlug: admin.slug, email, password: MEMBER_PASSWORD },
      });
      expect(memberLogin.status()).toBe(200);
      const oldJwt = ((await memberLogin.json()) as { accessToken: string }).accessToken;
      await employee.goto('/users');
      await expect(employee).toHaveURL(/\/home/);

      await account.getByTestId('users-change-role').click();
      await page.getByTestId('users-confirm').click();
      await expect(account).toContainText('Staff');
      const stale = await request.get(`${API}/establishments/accessible`, {
        headers: { Authorization: `Bearer ${oldJwt}` },
      });
      expect(stale.status()).toBe(401);
      await employee.goto('/home');
      await expect(employee).toHaveURL(/\/login/, { timeout: 15_000 });
      const freshLogin = await request.post(`${API}/auth/login`, {
        data: { tenantSlug: admin.slug, email, password: MEMBER_PASSWORD },
      });
      expect(freshLogin.status()).toBe(200);
      const staffJwt = ((await freshLogin.json()) as { accessToken: string }).accessToken;
      await page.route('**/api/v1/users?*', (route) =>
        route.continue({
          headers: { ...route.request().headers(), authorization: `Bearer ${staffJwt}` },
        }),
      );
      await page.reload();
      await expect(page.getByRole('alert')).toContainText(/no tienes permiso/i);
      await page.unroute('**/api/v1/users?*');
      await page.reload();
      await expect(account).toBeVisible();
      await employee.goto(`/empresa/${admin.slug}/login`);
      await employee.getByRole('textbox', { name: /correo/i }).fill(email);
      await employee.getByLabel('Contraseña', { exact: true }).fill(MEMBER_PASSWORD);
      await employee.getByRole('button', { name: /iniciar sesi/i }).click();
      await expect(employee).toHaveURL(/\/home/);
      await employee.goto('/users');
      await expect(employee).toHaveURL(/\/home/);

      const changed = await request.patch(`${API}/users/${memberId}/role`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: { expectedRole: 'STAFF', role: 'MANAGER' },
      });
      expect(changed.status()).toBe(200);
      await account.getByTestId('users-change-role').click();
      await page.getByTestId('users-confirm').click();
      await expect(page.getByRole('alert')).toContainText(/datos cambiaron/i);
      await expect(account).toContainText(/Gerente/i);
      await account.getByTestId('users-change-role').click();
      await page.getByTestId('users-confirm').click();
      await expect(account).toContainText(/Staff/i);

      await account.getByTestId('users-deactivate').click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByTestId('users-confirm').click();
      await expect(account).toContainText(/Inactivo/i);
      await expect(account.getByTestId('users-deactivate')).toHaveCount(0);
      const blocked = await request.post(`${API}/auth/login`, {
        data: { tenantSlug: admin.slug, email, password: MEMBER_PASSWORD },
      });
      expect(blocked.status()).toBe(401);
      expect(
        (
          await request.get(`${API}/users`, { headers: { Authorization: `Bearer ${oldJwt}` } })
        ).status(),
      ).toBe(401);
    } finally {
      await employeeContext.close();
    }
  });
});
