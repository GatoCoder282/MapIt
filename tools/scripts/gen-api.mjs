#!/usr/bin/env node
/**
 * `pnpm api:gen`   — genera el cliente TS y las interfaces Java desde el contrato.
 * `pnpm api:check` — verifica que lo generado coincide con el contrato (sin escribir).
 *
 * El contrato (packages/api-contract/openapi.yaml) es la FUENTE DE VERDAD.
 * Se edita antes de escribir código. Ver plan §6.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { ROOT, capture, log, c, die } from './_lib.mjs';

const CONTRATO = join(ROOT, 'packages', 'api-contract', 'openapi.yaml');
const DESTINO_TS = join(ROOT, 'libs', 'api-client', 'src', 'lib', 'generated');
const HUELLA = join(DESTINO_TS, '.contract-hash');

const soloVerificar = process.argv.includes('--check');

if (!existsSync(CONTRATO)) {
  die(
    'No se encontró el contrato OpenAPI',
    `  Debería estar en packages/api-contract/openapi.yaml`,
  );
}

const contenido = readFileSync(CONTRATO, 'utf8');
const huellaActual = createHash('sha256').update(contenido).digest('hex');

/* ── Modo verificación ───────────────────────────────────── */
if (soloVerificar) {
  if (!existsSync(HUELLA)) {
    log.warn('El cliente aún no se ha generado.');
    log.info('Ejecuta:  pnpm api:gen');
    process.exit(0);
  }
  const huellaGuardada = readFileSync(HUELLA, 'utf8').trim();
  if (huellaGuardada !== huellaActual) {
    die(
      'El contrato cambió pero el cliente generado no se actualizó',
      `  pnpm api:gen\n\n  Luego revisa los cambios y haz commit del contrato.`,
    );
  }
  log.ok('El contrato y el cliente generado están sincronizados.');
  process.exit(0);
}

/* ── Generación ──────────────────────────────────────────── */
log.step('Generando el cliente desde el contrato OpenAPI');

// openapi-generator se ejecuta vía Docker: así no hace falta instalar Java
// ni el generador en las 5 máquinas. Si Docker no está, se avisa y se sigue
// (el andamiaje no debe bloquearse por esto).
const dockerOk = capture('docker', ['info']).ok;
if (!dockerOk) {
  log.warn('Docker no está disponible: no se puede generar el cliente ahora.');
  log.info('Levanta Docker Desktop y repite:  pnpm api:gen');
  process.exit(0);
}

mkdirSync(DESTINO_TS, { recursive: true });

const argsDocker = [
  'run',
  '--rm',
  '-v',
  `${ROOT}:/local`,
  'openapitools/openapi-generator-cli:latest',
  'generate',
  '-i',
  '/local/packages/api-contract/openapi.yaml',
  '-g',
  'typescript-angular',
  '-o',
  '/local/libs/api-client/src/lib/generated',
  '--additional-properties=' +
    [
      'ngVersion=22.0.0',
      'providedInRoot=true',
      'withInterfaces=true',
      'useSingleRequestParameter=true',
      'fileNaming=kebab-case',
      'enumPropertyNaming=UPPERCASE',
      'supportsES6=true',
    ].join(','),
];

const r = capture('docker', argsDocker, { env: { MSYS_NO_PATHCONV: '1' } });
if (!r.ok) {
  log.fail('El generador falló.');
  console.error(r.stderr || r.stdout);
  die(
    'No se pudo generar el cliente de API',
    `  Valida primero el contrato:  pnpm api:lint\n  Y comprueba que Docker responde:  docker info`,
  );
}

writeFileSync(HUELLA, huellaActual + '\n', 'utf8');
log.ok(`cliente generado en libs/api-client/src/lib/generated`);
log.info(c.gray('Recuerda: ese código NO se commitea; se regenera en cada install y en CI.'));
