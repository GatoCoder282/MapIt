#!/usr/bin/env node
/**
 * `pnpm setup` — de un clone limpio a un entorno funcionando.
 * Idempotente: se puede correr las veces que haga falta.
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { ROOT, run, capture, log, c, die, waitForPort, readEnv, loadEnv } from './_lib.mjs';

const ENV = join(ROOT, '.env');
const ENV_EXAMPLE = join(ROOT, '.env.example');

console.log(c.bold(c.cyan('\n  MapIt — setup del entorno de desarrollo\n')));

/* ── 1. Diagnóstico ──────────────────────────────────────── */
log.step('1/6  Verificando el entorno');
{
  const r = capture(process.execPath, [join(ROOT, 'tools', 'scripts', 'check-env.mjs')]);
  if (!r.ok) {
    console.log(r.stdout);
    console.error(r.stderr);
    die(
      'El entorno no está listo (ver arriba)',
      '  Resuelve los problemas listados y vuelve a correr:  pnpm setup',
    );
  }
  log.ok('entorno correcto');
}

/* ── 2. .env ─────────────────────────────────────────────── */
log.step('2/6  Configuración (.env)');
if (!existsSync(ENV)) {
  copyFileSync(ENV_EXAMPLE, ENV);
  // Un JWT_SECRET distinto por máquina, para que nadie herede el del ejemplo.
  const secret = randomBytes(48).toString('base64url');
  writeFileSync(
    ENV,
    readFileSync(ENV, 'utf8').replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`),
    'utf8',
  );
  log.ok('.env creado desde .env.example (con un JWT_SECRET propio)');
} else {
  const actual = readEnv(ENV);
  const ejemplo = readEnv(ENV_EXAMPLE);
  const faltantes = Object.keys(ejemplo).filter((k) => !(k in actual));
  if (faltantes.length) {
    let texto = readFileSync(ENV, 'utf8').replace(/\s*$/, '\n');
    texto += `\n# ── Añadidas automáticamente por \`pnpm setup\` ──\n`;
    for (const k of faltantes) texto += `${k}=${ejemplo[k]}\n`;
    writeFileSync(ENV, texto, 'utf8');
    log.ok(
      `.env actualizado con ${faltantes.length} variable(s) nueva(s): ${faltantes.join(', ')}`,
    );
  } else {
    log.ok('.env ya está completo');
  }
}
loadEnv();

/* ── 3. Dependencias ─────────────────────────────────────── */
log.step('3/6  Dependencias de Node');
if (existsSync(join(ROOT, 'node_modules'))) {
  log.ok('node_modules ya existe (usa `pnpm install` si cambiaste dependencias)');
} else {
  run('pnpm', ['install']);
  log.ok('dependencias instaladas');
}

/* ── 4. Infraestructura ──────────────────────────────────── */
log.step('4/6  Infraestructura Docker');
run(process.execPath, [join(ROOT, 'tools', 'scripts', 'compose.mjs'), 'up']);

const pgPort = Number(process.env.POSTGRES_PORT ?? 5433);
const unleashPort = Number(process.env.UNLEASH_PORT ?? 4242);

if (!(await waitForPort(pgPort, { label: `PostgreSQL (:${pgPort})` }))) {
  die(
    'PostgreSQL no arrancó a tiempo',
    `  Revisa los logs:  pnpm infra:logs postgres\n  Si el puerto ${pgPort} está ocupado por otro programa, cámbialo en .env`,
  );
}
if (!(await waitForPort(unleashPort, { label: `Unleash (:${unleashPort})`, timeoutMs: 180000 }))) {
  log.warn('Unleash tardó más de lo esperado. Los feature flags usarán sus valores por defecto.');
  log.info('Revisa con:  pnpm infra:logs unleash');
}

/* ── 4b. Feature flags ───────────────────────────────────── */
run(process.execPath, [join(ROOT, 'tools', 'scripts', 'seed-flags.mjs')], { allowFailure: true });

/* ── 5. Migraciones ──────────────────────────────────────── */
log.step('5/6  Migraciones de base de datos');
{
  const hasJava = capture('java', ['-version']).ok;
  const hasWrapper = existsSync(join(ROOT, 'apps', 'backend', 'gradlew'));
  if (hasJava && hasWrapper) {
    const r = run(
      process.execPath,
      [join(ROOT, 'tools', 'scripts', 'gradle.mjs'), ':bootstrap:flywayMigrate'],
      { allowFailure: true },
    );
    if (r === 0) log.ok('esquema aplicado con Flyway');
    else log.warn('Flyway falló — revisa con:  pnpm db:info');
  } else {
    log.warn('backend no disponible todavía; migraciones omitidas');
  }
}

/* ── 6. Contrato API ─────────────────────────────────────── */
log.step('6/6  Contrato API');
{
  const r = run(process.execPath, [join(ROOT, 'tools', 'scripts', 'gen-api.mjs')], {
    allowFailure: true,
  });
  if (r === 0) log.ok('cliente generado desde openapi.yaml');
  else log.warn('generación del cliente omitida (aún sin contrato)');
}

/* ── Resumen ─────────────────────────────────────────────── */
const p = (k, d) => process.env[k] ?? d;
console.log(`
${c.gray('─'.repeat(62))}
${c.green(c.bold('  ✔ Todo listo.'))}  Arranca con:  ${c.cyan(c.bold('pnpm dev'))}

  ${c.bold('Servicios')}
    Console (staff)    ${c.cyan(`http://localhost:${p('CONSOLE_PORT', 4200)}`)}
    Público            ${c.cyan(`http://localhost:${p('PUBLIC_WEB_PORT', 4300)}`)}
    API + Swagger      ${c.cyan(`http://localhost:${p('BACKEND_PORT', 8080)}/swagger-ui.html`)}
    Feature flags      ${c.cyan(`http://localhost:${p('UNLEASH_PORT', 4242)}`)}  ${c.gray(`(${p('UNLEASH_ADMIN_USER', 'admin')} / ${p('UNLEASH_ADMIN_PASSWORD', 'unleash4all')})`)}
    Correos de prueba  ${c.cyan(`http://localhost:${p('MAILPIT_UI_PORT', 8025)}`)}
    PostgreSQL         ${c.gray(`localhost:${p('POSTGRES_PORT', 5433)}`)}

  ${c.gray('¿Problemas?  → TROUBLESHOOTING.md      ¿Vas a desarrollar?  → CONTRIBUTING.md')}
`);
