#!/usr/bin/env node
/**
 * `pnpm dev` — levanta todo el stack de desarrollo en una sola terminal,
 * con los logs de cada proceso prefijados y coloreados.
 */
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { ROOT, IS_WINDOWS, run, capture, log, c, spawnPrefixed, loadEnv, sleep } from './_lib.mjs';

loadEnv();

const mode = process.argv[2] ?? 'all';
const wantBack = mode === 'all' || mode === 'back';
const wantFront = mode === 'all' || mode === 'front';

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
      }),
    );
    await sleep(2000);
  }
}

/* ── Frontends ───────────────────────────────────────────── */
if (wantFront) {
  const apps = [
    ['console', c.blue, '@mapit/console'],
    ['public-web', c.magenta, '@mapit/public-web'],
  ];
  for (const [nombre, color, pkg] of apps) {
    if (!existsSync(join(ROOT, 'apps', nombre, 'package.json'))) {
      log.warn(`${nombre} no inicializada — omitida`);
      continue;
    }
    log.step(`Frontend: ${nombre}`);
    children.push(spawnPrefixed(nombre, color, 'pnpm', ['--filter', pkg, 'run', 'start']));
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

    Console (staff)    ${c.cyan(`http://localhost:${p('CONSOLE_PORT', 4200)}`)}
    Público            ${c.cyan(`http://localhost:${p('PUBLIC_WEB_PORT', 4300)}`)}
    API + Swagger      ${c.cyan(`http://localhost:${p('BACKEND_PORT', 8080)}/swagger-ui.html`)}
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
