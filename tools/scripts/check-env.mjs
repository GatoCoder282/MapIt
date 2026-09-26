#!/usr/bin/env node
/**
 * `pnpm doctor` — verifica que la máquina puede correr MapIt.
 * Cada fallo dice QUÉ falta y el comando EXACTO para arreglarlo.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, c, log, capture, isPortFree, parseMajor, readEnv, IS_WINDOWS } from './_lib.mjs';

const REQUIRED_NODE = 22;
const REQUIRED_JAVA = 25;

const problems = [];
const warnings = [];

function fail(what, how) {
  problems.push({ what, how });
  log.fail(what);
}
function warn(what) {
  warnings.push(what);
  log.warn(what);
}

log.plain(c.bold('\n  MapIt — diagnóstico del entorno\n'));

/* ── 1. Node ─────────────────────────────────────────── */
log.step('Node.js');
{
  const major = parseMajor(process.version.slice(1));
  if (major >= REQUIRED_NODE) log.ok(`Node ${process.version}`);
  else
    fail(
      `Node ${process.version} es muy antiguo (se requiere >= ${REQUIRED_NODE})`,
      `  Instala Node 24 LTS desde https://nodejs.org\n  O con nvm:  nvm install 24 && nvm use 24`,
    );
}

/* ── 2. pnpm ─────────────────────────────────────────── */
log.step('pnpm');
{
  const r = capture('pnpm', ['--version']);
  if (r.ok && parseMajor(r.stdout) >= 11) log.ok(`pnpm ${r.stdout}`);
  else
    fail(
      'pnpm no está disponible o es < 11',
      `  corepack enable\n  (luego cierra y reabre la terminal)`,
    );
}

/* ── 3. Java ─────────────────────────────────────────── */
log.step('Java (JDK)');
{
  const r = capture('java', ['-version']);
  if (!r.ok) {
    fail(
      'Java no está instalado — el backend Spring Boot no puede compilar',
      IS_WINDOWS
        ? `  winget install EclipseAdoptium.Temurin.25.JDK\n  (cierra y reabre la terminal después)\n  Guía: https://adoptium.net/installation/`
        : `  macOS:  brew install --cask temurin@25\n  Linux:  sudo apt install temurin-25-jdk\n  Guía: https://adoptium.net/installation/`,
    );
  } else {
    // `java -version` escribe en stderr
    const text = r.stderr || r.stdout;
    const m = text.match(/version "(\d+)/);
    const major = m ? Number(m[1]) : 0;
    if (major >= REQUIRED_JAVA) log.ok(`Java ${major}`);
    else
      fail(
        `Java ${major} detectado, se requiere >= ${REQUIRED_JAVA}`,
        IS_WINDOWS
          ? `  winget install EclipseAdoptium.Temurin.25.JDK`
          : `  Instala Temurin 25 desde https://adoptium.net`,
      );

    if (!process.env.JAVA_HOME) {
      warn(
        'JAVA_HOME no está definida. Gradle funciona igual, pero la extensión de Java del editor puede fallar.\n' +
          (IS_WINDOWS
            ? '      Panel de Control → Variables de entorno → nueva variable de sistema JAVA_HOME'
            : '      Añade  export JAVA_HOME=$(/usr/libexec/java_home -v 25)  a tu shell'),
      );
    } else {
      log.ok(`JAVA_HOME = ${process.env.JAVA_HOME}`);
    }
  }
}

/* ── 4. Docker ───────────────────────────────────────── */
log.step('Docker');
{
  const v = capture('docker', ['--version']);
  if (!v.ok) {
    fail(
      'Docker no está instalado',
      `  https://www.docker.com/products/docker-desktop/\n  En Windows: activa el backend WSL2 y asigna >= 6GB de RAM.`,
    );
  } else {
    log.ok(v.stdout);
    const ps = capture('docker', ['info', '--format', '{{.ServerVersion}}']);
    if (!ps.ok) {
      fail(
        'Docker está instalado pero el daemon no responde',
        `  Abre Docker Desktop y espera a que diga "Running", luego reintenta.`,
      );
    } else {
      log.ok('daemon corriendo');
      const compose = capture('docker', ['compose', 'version']);
      if (compose.ok) log.ok('docker compose disponible');
      else
        fail(
          'falta `docker compose` (plugin v2)',
          '  Actualiza Docker Desktop a una versión reciente.',
        );
    }
  }
}

/* ── 5. Git ──────────────────────────────────────────── */
log.step('Git');
{
  const r = capture('git', ['--version']);
  if (r.ok) log.ok(r.stdout);
  else fail('Git no está instalado', '  https://git-scm.com/downloads');
}

/* ── 6. Archivo .env ─────────────────────────────────── */
log.step('Configuración (.env)');
{
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) {
    warn('.env no existe todavía — `pnpm setup` lo creará desde .env.example');
  } else {
    const actual = readEnv(envPath);
    const ejemplo = readEnv(join(ROOT, '.env.example'));
    const faltantes = Object.keys(ejemplo).filter((k) => !(k in actual));
    if (faltantes.length) {
      fail(
        `.env está incompleto, faltan ${faltantes.length} variable(s): ${faltantes.join(', ')}`,
        `  Compara con .env.example y añade las que faltan.\n  O borra .env y corre  pnpm setup  para regenerarlo.`,
      );
    } else {
      log.ok(`.env completo (${Object.keys(actual).length} variables)`);
      if ((actual.JWT_SECRET ?? '').length < 32) {
        warn('JWT_SECRET tiene menos de 32 caracteres — Spring Security lo rechazará');
      }
    }
  }
}

/* ── 7. Puertos ──────────────────────────────────────── */
log.step('Puertos');
{
  const env = { ...readEnv(join(ROOT, '.env.example')), ...readEnv(join(ROOT, '.env')) };
  const puertos = [
    [env.POSTGRES_PORT ?? 5432, 'PostgreSQL'],
    [env.BACKEND_PORT ?? 8080, 'backend Spring Boot'],
    [env.CONSOLE_PORT ?? 4200, 'app console'],
    [env.PUBLIC_WEB_PORT ?? 4300, 'app public-web'],
    [env.UNLEASH_PORT ?? 4242, 'Unleash'],
    [env.UNLEASH_PROXY_PORT ?? 3063, 'Unleash proxy'],
    [env.MAILPIT_UI_PORT ?? 8025, 'Mailpit'],
  ];
  let ocupados = 0;
  for (const [port, quien] of puertos) {
    if (await isPortFree(Number(port))) {
      log.ok(`${port} libre  ${c.gray('(' + quien + ')')}`);
    } else {
      ocupados++;
      log.warn(`${port} OCUPADO  ${c.gray('(' + quien + ')')}`);
    }
  }
  if (ocupados) {
    warn(
      `${ocupados} puerto(s) en uso. Si es una sesión previa de MapIt:  pnpm stop\n` +
        `      Si es otro programa (ej. un PostgreSQL nativo): cambia el puerto en .env`,
    );
  }
}

/* ── Resumen ─────────────────────────────────────────── */
console.log('\n' + c.gray('─'.repeat(62)));
if (problems.length === 0) {
  console.log(c.green(c.bold('\n  ✔ Entorno listo.')) + `  Siguiente:  ${c.cyan('pnpm setup')}\n`);
  if (warnings.length)
    console.log(c.yellow(`  (${warnings.length} advertencia(s) arriba — no bloquean)\n`));
  process.exit(0);
} else {
  console.log(c.red(c.bold(`\n  ✖ ${problems.length} problema(s) que impiden arrancar:\n`)));
  problems.forEach((p, i) => {
    console.log(`  ${c.bold(`${i + 1}. ${p.what}`)}`);
    console.log(c.yellow(p.how) + '\n');
  });
  process.exit(1);
}
