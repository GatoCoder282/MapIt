#!/usr/bin/env node
/**
 * `pnpm dev` — levanta todo el stack de desarrollo en una sola terminal,
 * con los logs de cada proceso prefijados y coloreados.
 */
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import {
  ROOT,
  IS_WINDOWS,
  run,
  capture,
  log,
  c,
  spawnPrefixed,
  loadEnv,
  applyJavaHome,
  sleep,
  isPortFree,
  die,
} from './_lib.mjs';

loadEnv();

const mode = process.argv[2] ?? 'all';
const wantBack = mode === 'all' || mode === 'back';
const wantFront = mode === 'all' || mode === 'front';

const backendPort = Number(
  process.env.SERVER_PORT ?? process.env.PORT ?? process.env.BACKEND_PORT ?? 8080,
);
const consolePort = Number(process.env.CONSOLE_PORT ?? 4200);
const publicPort = Number(process.env.PUBLIC_WEB_PORT ?? 4300);
const services = [
  ...(wantBack ? [{ name: 'Backend', port: backendPort }] : []),
  ...(wantFront
    ? [
        { name: 'Console', port: consolePort },
        { name: 'Public Web', port: publicPort },
      ]
    : []),
];
for (const service of services) {
  if (!Number.isInteger(service.port) || service.port < 1 || service.port > 65535) {
    die(
      `Puerto inválido para ${service.name}: ${service.port}`,
      'Revisa los puertos configurados en .env.',
    );
  }
}
const busy = (
  await Promise.all(
    services.map(async (service) => {
      const free = await Promise.all(
        ['127.0.0.1', '::1'].map((host) => isPortFree(service.port, host)),
      );
      return free.every(Boolean) ? null : service;
    }),
  )
).filter(Boolean);
if (busy.length) {
  die(
    `No se inició MapIt: puertos ocupados (${busy.map((service) => `${service.name}: ${service.port}`).join(', ')}).`,
    'Ya hay otra instancia o aplicación usando esos puertos. Usa la instancia existente o detenla con Ctrl+C en su terminal antes de repetir pnpm dev. No se inició ningún proceso nuevo.',
  );
}
applyJavaHome();

const children = [];
let cerrando = false;

function shutdown(code = 0) {
  if (cerrando) return;
  cerrando = true;
  console.log(c.gray('\n\n  Deteniendo procesos…'));
  for (const ch of children) {
    try {
      if (IS_WINDOWS) capture('taskkill', ['/pid', String(ch.pid), '/T', '/F']);
      else ch.kill('SIGTERM');
    } catch {
      /* el proceso ya murió */
    }
  }
  console.log(c.gray('  Los contenedores siguen arriba. Para bajarlos:  pnpm stop\n'));
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

/* ── Infraestructura ─────────────────────────────────────── */
log.step('Infraestructura');
run(process.execPath, [join(ROOT, 'tools', 'scripts', 'compose.mjs'), 'up']);

/* ── Backend ─────────────────────────────────────────────── */
if (wantBack) {
  const wrapper = join(ROOT, 'apps', 'backend', IS_WINDOWS ? 'gradlew.bat' : 'gradlew');
  if (!existsSync(wrapper)) {
    log.warn('backend no inicializado — omitido');
  } else if (!capture('java', ['-version']).ok) {
    log.warn('Java no está instalado — backend omitido');
    log.info('Instálalo con:  winget install EclipseAdoptium.Temurin.25.JDK');
  } else {
    log.step('Backend (Spring Boot)');
    log.info('la primera compilación puede tardar 2-4 min');
    children.push(
      spawnPrefixed('backend', c.green, wrapper, ['bootRun', '--console=plain'], {
        cwd: join(ROOT, 'apps', 'backend'),
        // El perfil local habilita únicamente la simulación de pagos MOCK. Los
        // despliegues no pasan por este script y el backend base permanece apagado.
        env: { SPRING_PROFILES_ACTIVE: process.env.SPRING_PROFILES_ACTIVE ?? 'dev' },
      }),
    );
    await sleep(2000);
  }
}

/* ── Frontends ───────────────────────────────────────────── */
if (wantFront) {
  const apps = [
    ['console', c.blue, '@mapit/console', consolePort],
    ['public-web', c.magenta, '@mapit/public-web', publicPort],
  ];
  for (const [nombre, color, pkg, port] of apps) {
    if (!existsSync(join(ROOT, 'apps', nombre, 'package.json'))) {
      log.warn(`${nombre} no inicializada — omitida`);
      continue;
    }
    log.step(`Frontend: ${nombre}`);
    children.push(
      spawnPrefixed(nombre, color, 'pnpm', [
        '--filter',
        pkg,
        'run',
        'start',
        '--port',
        String(port),
      ]),
    );
  }
}

if (children.length === 0) {
  log.warn('No hay nada que ejecutar todavía. La infraestructura sí está arriba.');
  log.info('Estado:  pnpm infra:ps');
  process.exit(0);
}

const p = (k, d) => process.env[k] ?? d;
console.log(`
${c.gray('─'.repeat(62))}
  ${c.bold('MapIt corriendo')}   ${c.gray('(Ctrl+C para detener)')}

    Console (staff)    ${c.cyan(`http://localhost:${consolePort}`)}
    Público            ${c.cyan(`http://localhost:${publicPort}`)}
    API + Swagger      ${c.cyan(`http://localhost:${backendPort}/swagger-ui.html`)}
    Feature flags      ${c.cyan(`http://localhost:${p('UNLEASH_PORT', 4242)}`)}
    Correos            ${c.cyan(`http://localhost:${p('MAILPIT_UI_PORT', 8025)}`)}
${c.gray('─'.repeat(62))}
`);

// Si un proceso muere solo, avisamos pero no tumbamos el resto.
for (const ch of children) {
  ch.on('exit', (code) => {
    if (!cerrando && code !== 0) {
      log.fail(`un proceso terminó con código ${code} — revisa los logs de arriba`);
    }
  });
}
