import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, type APIRequestContext } from '@playwright/test';
export const api = process.env['API_BASE_URL'] ?? 'http://localhost:8080/api/v1';
const container = process.env['MAP286_QA_CONTAINER'];
const database = process.env['MAP286_QA_DATABASE'];

/** Solo BD temporal explícita, validada antes de tocar datos; jamás mapit-postgres. */
export function sql(query: string): string {
  if (container !== 'mapit-map286-final-pg' || database !== 'map286_qa')
    throw new Error('Se requiere BD temporal MAP-286');
  return execFileSync(
    'docker',
    [
      'exec',
      '-i',
      container,
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'mapit',
      '-d',
      database,
      '-At',
    ],
    { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  ).trim();
}
export async function fixture(request: APIRequestContext) {
  expect(
    sql(
      "select string_agg(version,',' order by installed_rank) from flyway_schema_history where version in ('40','41','42','43','44','45') and success",
    ),
  ).toBe('40,41,42,43,44,45');
  const tenant = 'qa-' + randomUUID(),
    foreign = 'qa-' + randomUUID(),
    user = randomUUID(),
    staff = randomUUID(),
    other = randomUUID();
  const venue = randomUUID(),
    floor = randomUUID(),
    sector = randomUUID(),
    element = randomUUID(),
    person = randomUUID();
  const email = user + '@map286.test',
    password = 'Map286-QA-test_123!';
  sql(`insert into tenant(id,name,slug,vertical) values ('${tenant}','QA MAP286','${tenant}','RESTAURANT'),('${foreign}','QA ajeno','${foreign}','RESTAURANT');
    insert into app_user(id,tenant_id,email,password_hash,full_name,role) values
      ('${user}','${tenant}','${email}',crypt('${password}',gen_salt('bf',10)),'QA Admin','ADMIN'),
      ('${staff}','${tenant}','${staff}@map286.test',crypt('${password}',gen_salt('bf',10)),'QA Staff','STAFF'),
      ('${other}','${foreign}','${other}@map286.test',crypt('${password}',gen_salt('bf',10)),'QA Ajeno','ADMIN');
    insert into establishment(id,tenant_id,name,type,slug,timezone) values ('${venue}','${tenant}','Sede notificaciones QA','RESTAURANT','sede','UTC');
    insert into establishment_staff_access(tenant_id,establishment_id,user_id,can_check_in,updated_at,updated_by) values ('${tenant}','${venue}','${staff}',true,now(),'${user}');
    insert into floor(id,tenant_id,establishment_id,name,slug,level) values ('${floor}','${tenant}','${venue}','Planta','planta',0);
    insert into sector(id,tenant_id,floor_id,name,slug,max_capacity,width,height) values ('${sector}','${tenant}','${floor}','Salón','salon',10,560,320);
    insert into space_element(id,tenant_id,sector_id,type,state,x,y,width,height) values ('${element}','${tenant}','${sector}','TABLE','AVAILABLE',100,90,80,60);
    insert into person(id,tenant_id,full_name) values ('${person}','${tenant}','Cliente QA');`);
  async function login(address: string) {
    const r = await request.post(api + '/auth/global-login', {
      data: { email: address, password },
    });
    expect(r.status()).toBe(200);
    return (await r.json()) as { accessToken: string };
  }
  const auth = await login(email),
    staffAuth = await login(staff + '@map286.test'),
    otherAuth = await login(other + '@map286.test');
  const headers = { Authorization: 'Bearer ' + auth.accessToken };
  let index = 0;
  async function reserve() {
    const start = new Date(Date.now() + 48 * 3600000 + index++ * 7200000),
      end = new Date(start.getTime() + 3600000);
    const r = await request.post(api + '/establishments/' + venue + '/reservations', {
      headers,
      data: {
        personId: person,
        spaceElementIds: [element],
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
      },
    });
    expect(r.status()).toBe(201);
    return (await r.json()) as { id: string };
  }
  return {
    tenant,
    foreign,
    user,
    staff,
    other,
    venue,
    element,
    email,
    password,
    auth,
    staffAuth,
    otherAuth,
    headers,
    reserve,
  };
}

export async function adminFlag(path: string, method = 'GET', body?: unknown) {
  const origin = (process.env['UNLEASH_URL'] ?? 'http://localhost:4242/api').replace(
    /\/api\/?$/,
    '',
  );
  const response = await fetch(origin + path, {
    method,
    headers: {
      Authorization: process.env['UNLEASH_ADMIN_TOKEN'] ?? '',
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok && !(method === 'DELETE' && response.status === 404))
    throw new Error('Unleash QA HTTP ' + response.status);
  return response;
}
const environment = process.env['UNLEASH_ENVIRONMENT'] ?? 'development';
export const center = 'mapit.s6.notification-center';
export async function toggle(name: string, enabled: boolean) {
  await adminFlag(
    '/api/admin/projects/default/features/' +
      name +
      '/environments/' +
      environment +
      '/' +
      (enabled ? 'on' : 'off'),
    'POST',
  );
}
export async function prepareFlags() {
  const saved: { name: string; enabled: boolean; strategy: string }[] = [];
  for (const name of [center, 'realtime.websocket']) {
    try {
      await adminFlag('/api/admin/projects/default/features/' + name);
    } catch {
      await adminFlag('/api/admin/projects/default/features', 'POST', {
        name,
        type: 'kill-switch',
        description: 'MAP-286 QA local',
        impressionData: false,
      });
    }
    const flag = (await (
      await adminFlag('/api/admin/projects/default/features/' + name)
    ).json()) as { environments: { name: string; enabled: boolean }[] };
    const strategy = (await (
      await adminFlag(
        '/api/admin/projects/default/features/' +
          name +
          '/environments/' +
          environment +
          '/strategies',
        'POST',
        { name: 'default', parameters: {} },
      )
    ).json()) as { id: string };
    saved.push({
      name,
      enabled: flag.environments.find((e) => e.name === environment)?.enabled ?? false,
      strategy: strategy.id,
    });
  }
  return async () => {
    for (const flag of saved) {
      await toggle(flag.name, flag.enabled);
      await adminFlag(
        '/api/admin/projects/default/features/' +
          flag.name +
          '/environments/' +
          environment +
          '/strategies/' +
          flag.strategy,
        'DELETE',
      );
    }
  };
}
