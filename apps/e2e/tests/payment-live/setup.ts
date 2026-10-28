import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  createWriteStream,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../../../..');
const temporary = resolve(root, 'apps/e2e/.tmp');
export const fixtureFile = resolve(temporary, 'payment-live.json');
export interface LiveFixture {
  container: string;
  api: string;
  ws: string;
  tenant: string;
  venue: string;
  otherVenue: string;
  policylessVenue: string;
  element: string;
  sector: string;
  spareElement: string;
  unavailableElement: string;
  otherElement: string;
  date: string;
  start: string;
  end: string;
  session: Record<string, unknown>;
}
const docker = (args: string[], input?: string): string =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    timeout: 30000,
    ...(input === undefined ? {} : { input }),
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
const pause = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));
async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Puerto de prueba no disponible');
  const port = address.port;
  await new Promise<void>((done, reject) =>
    server.close((error) => (error ? reject(error) : done())),
  );
  return port;
}

/** PostgreSQL y backend aislados. Solo el proveedor de dinero es mock; HTTP/BD/STOMP son reales. */
export default async function setup(): Promise<() => Promise<void>> {
  mkdirSync(temporary, { recursive: true });
  const libs = resolve(root, 'apps/backend/bootstrap/build/libs');
  const jar = readdirSync(libs).find(
    (name) => name.endsWith('.jar') && !name.endsWith('-plain.jar'),
  );
  if (!jar)
    throw new Error('Ejecuta node tools/scripts/gradle.mjs :bootstrap:bootJar antes del E2E');
  // Keep this run independent of a later owner bootJar replacing the build artifact.
  const runJar = resolve(temporary, `payment-live-${randomUUID()}.jar`);
  copyFileSync(resolve(libs, jar), runJar);
  let container = '';
  let backend: ChildProcess | undefined;
  const log = createWriteStream(resolve(temporary, 'payment-live-backend.log'));
  const cleanup = async (): Promise<void> => {
    if (backend && backend.exitCode === null) {
      backend.kill();
      await Promise.race([
        new Promise<void>((done) => backend?.once('exit', () => done())),
        pause(5000),
      ]);
    }
    if (
      /^[a-f0-9]{64}$/.test(container) &&
      docker(['inspect', '--format', '{{index .Config.Labels "com.mapit.e2e"}}', container]) ===
        'payments'
    ) {
      docker(['rm', '--force', container]);
    }
    log.end();
    // This file contains a staff session; never retain it as test evidence.
    rmSync(fixtureFile, { force: true });
    rmSync(runJar, { force: true });
  };
  try {
    container = docker([
      'run',
      '--detach',
      '--label',
      'com.mapit.e2e=payments',
      '--publish',
      '127.0.0.1::5432',
      '--env',
      'POSTGRES_USER=mapit',
      '--env',
      'POSTGRES_PASSWORD=e2e_owner_only',
      '--env',
      'POSTGRES_DB=mapit',
      'postgres:17-alpine',
    ]);
    const mapping = JSON.parse(
      docker(['inspect', '--format', '{{json .NetworkSettings.Ports}}', container]),
    ) as Record<string, { HostPort: string }[]>;
    const dbPort = mapping['5432/tcp']?.[0]?.HostPort;
    if (!dbPort || !/^\d+$/.test(dbPort)) throw new Error('Docker no publicó PostgreSQL');
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try {
        docker(['exec', container, 'pg_isready', '-U', 'mapit']);
        ready = true;
        break;
      } catch {
        await pause(500);
      }
    }
    if (!ready) throw new Error('PostgreSQL E2E no quedó disponible');
    const port = await freePort();
    const api = `http://127.0.0.1:${port}/api/v1`;
    let java = 'java';
    const envPath = resolve(root, '.env');
    const javaHome =
      process.env['JAVA_HOME'] ??
      (existsSync(envPath)
        ? readFileSync(envPath, 'utf8').match(/^JAVA_HOME=["']?([^\r\n"']+)/m)?.[1]
        : undefined);
    if (javaHome)
      java = resolve(javaHome, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
    backend = spawn(
      java,
      [
        '-jar',
        runJar,
        `--server.port=${port}`,
        '--spring.profiles.active=test',
        `--spring.datasource.url=jdbc:postgresql://127.0.0.1:${dbPort}/mapit`,
        '--spring.datasource.username=mapit_app',
        '--spring.datasource.password=e2e_runtime_only',
        `--spring.flyway.url=jdbc:postgresql://127.0.0.1:${dbPort}/mapit`,
        '--spring.flyway.user=mapit',
        '--spring.flyway.password=e2e_owner_only',
        '--spring.flyway.placeholders.mapitAppDbPassword=e2e_runtime_only',
        '--mapit.payments.mock.enabled=true',
        '--mapit.unleash.enabled=false',
        '--mapit.cors.allowed-origins=http://localhost:4400,http://localhost:4500',
        '--mapit.realtime.outbox.poll-interval-ms=250',
      ],
      { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    backend.stdout?.pipe(log);
    backend.stderr?.pipe(log);
    let healthy = false;
    for (let i = 0; i < 120; i++) {
      if (backend.exitCode !== null) break;
      healthy = await fetch(`http://127.0.0.1:${port}/actuator/health`)
        .then((response) => response.ok)
        .catch(() => false);
      if (healthy) break;
      await pause(1000);
    }
    if (!healthy)
      throw new Error('Backend E2E no arrancó; revisar apps/e2e/.tmp/payment-live-backend.log');
    const tenant = 'browser-' + randomUUID();
    const venue = randomUUID(),
      floor = randomUUID(),
      sector = randomUUID(),
      admin = randomUUID();
    const otherVenue = randomUUID();
    const otherFloor = randomUUID(),
      otherSector = randomUUID();
    const policylessVenue = randomUUID();
    docker(
      [
        'exec',
        '--interactive',
        container,
        'psql',
        '-v',
        'ON_ERROR_STOP=1',
        '-U',
        'mapit',
        '-d',
        'mapit',
      ],
      `
      insert into tenant(id,name,slug,status,vertical) values('${tenant}','Empresa Navegador','${tenant}','ACTIVE','RESTAURANT');
      insert into app_user(id,tenant_id,email,password_hash,full_name,role) values('${admin}','${tenant}','admin@browser.test',crypt('Browser_test_123!',gen_salt('bf',10)),'Administrador E2E','ADMIN');
        insert into establishment(id,tenant_id,name,type,slug,timezone,address) values('${venue}','${tenant}','Navegador — Norte','RESTAURANT','venue','America/La_Paz','Avenida Norte 20');
        insert into establishment(id,tenant_id,name,type,slug,timezone,address) values('${otherVenue}','${tenant}','Navegador — Centro','RESTAURANT','centro','America/La_Paz','Calle Centro 10');
       insert into establishment(id,tenant_id,name,type,slug,timezone,address) values('${policylessVenue}','${tenant}','Navegador — Sin política','RESTAURANT','sin-politica','UTC','Calle Sin política 1');
       insert into floor(id,tenant_id,establishment_id,name,slug,level) values('${floor}','${tenant}','${venue}','Planta principal','principal',0);
       insert into sector(id,tenant_id,floor_id,name,slug,max_capacity,width,height) values('${sector}','${tenant}','${floor}','Terraza','terraza',10,560,320);
       insert into floor(id,tenant_id,establishment_id,name,slug,level) values('${otherFloor}','${tenant}','${otherVenue}','Planta centro','centro',0);
       insert into sector(id,tenant_id,floor_id,name,slug,max_capacity,width,height) values('${otherSector}','${tenant}','${otherFloor}','Salón centro','salon-centro',10,480,300);
    `,
    );
    const login = await fetch(api + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantSlug: tenant,
        email: 'admin@browser.test',
        password: 'Browser_test_123!',
      }),
    });
    if (!login.ok) throw new Error('No se pudo autenticar ADMIN E2E real');
    const session = (await login.json()) as Record<string, unknown>;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + String(session['accessToken']),
    };
    // Fixture identity/geometry only: metadata is entered in the inspector, money in Console.
    const createElement = async (
      sectorId: string,
      type: string,
      x: number,
      initialState = 'AVAILABLE',
    ): Promise<string> => {
      const response = await fetch(api + `/sectors/${sectorId}/elements`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ type, x, y: 90, width: 80, height: 60, rotation: 0, initialState }),
      });
      if (!response.ok)
        throw new Error(`CRUD elemento ADMIN fixture ${type} falló: ${response.status}`);
      return ((await response.json()) as { id: string }).id;
    };
    const element = await createElement(sector, 'TABLE', 100);
    const spareElement = await createElement(sector, 'TABLE', 280);
    const unavailableElement = await createElement(sector, 'TABLE', 440, 'OUT_OF_SERVICE');
    const otherElement = await createElement(otherSector, 'TABLE', 140);
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/La_Paz',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(Date.now() + 48 * 60 * 60000));
    const previous = await fetch(
      api + `/public/tenants/${tenant}/establishments/venue/reservations`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          startTime: '10:00',
          endTime: '11:00',
          spaceElementIds: [element],
          customer: { fullName: 'Reserva previa fixture', email: 'previous@browser.test' },
        }),
      },
    );
    if (!previous.ok) throw new Error('Reserva previa API fixture falló: ' + previous.status);
    const fixture: LiveFixture = {
      container,
      api,
      ws: `ws://127.0.0.1:${port}/ws`,
      tenant,
      venue,
      otherVenue,
      policylessVenue,
      element,
      sector,
      spareElement,
      unavailableElement,
      otherElement,
      date,
      start: '11:00',
      end: '12:00',
      session: { ...session, tenantSlug: tenant },
    };
    writeFileSync(fixtureFile, JSON.stringify(fixture));
    return cleanup;
  } catch (error) {
    await cleanup();
    throw error;
  }
}
