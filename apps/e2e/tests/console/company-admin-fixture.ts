import { expect, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';

/** Cuenta ADMIN real y local propios del test; nunca reutiliza el tenant de plataforma. */
export async function companyAdminFixture(request: APIRequestContext) {
  const api = process.env['API_BASE_URL'] ?? 'http://localhost:8080/api/v1';
  const mail = process.env['MAILPIT_URL'] ?? 'http://localhost:8025';
  const slug = 'home-' + randomUUID();
  const email = slug + '@mapit.test';
  const password = 'S3cur3?P4ss!';
  const platform = await request.post(api + '/auth/login', {
    data: {
      tenantSlug: 'platform',
      email: process.env['E2E_SUPER_ADMIN_EMAIL'] ?? 'superadmin@mapit.local',
      password: process.env['E2E_SUPER_ADMIN_PASSWORD'] ?? 'super-admin-dev',
    },
  });
  expect(platform.ok()).toBe(true);
  const token = ((await platform.json()) as { accessToken: string }).accessToken;
  const created = await request.post(api + '/tenants', {
    headers: { Authorization: 'Bearer ' + token },
    data: {
      name: 'Empresa de prueba Home',
      slug,
      vertical: 'RESTAURANT',
      administratorEmail: email,
    },
  });
  expect(created.status()).toBe(201);
  type MailList = { messages?: { ID: string; To?: { Address: string }[] }[] };
  let id = '';
  await expect(async () => {
    const inbox = await request.get(mail + '/api/v1/messages');
    id =
      ((await inbox.json()) as MailList).messages?.find((item) =>
        item.To?.some((to) => to.Address === email),
      )?.ID ?? '';
    expect(id).not.toBe('');
  }).toPass({ timeout: 15000 });
  const message = await request.get(mail + '/api/v1/message/' + id);
  const match = ((await message.json()) as { Text: string }).Text.match(
    /\/activar\?tenant=([a-z0-9-]+)&token=([A-Za-z0-9_-]+)/,
  );
  expect(match).not.toBeNull();
  const activated = await request.post(api + '/auth/activate', {
    data: { tenantSlug: slug, token: match![2], password, passwordConfirm: password },
  });
  expect(activated.ok()).toBe(true);
  const login = await request.post(api + '/auth/login', {
    data: { tenantSlug: slug, email, password },
  });
  expect(login.ok()).toBe(true);
  const accessToken = ((await login.json()) as { accessToken: string }).accessToken;
  const venue = await request.post(api + '/establishments', {
    headers: { Authorization: 'Bearer ' + accessToken },
    data: { name: 'Sede Home', slug: 'sede', type: 'RESTAURANT' },
  });
  expect(venue.status()).toBe(201);
  return { slug, email, password, venueId: ((await venue.json()) as { id: string }).id };
}
