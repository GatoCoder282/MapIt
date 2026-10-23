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
import { homedir } from 'node:os';
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

// Versión fija del generador: nada de `:latest`, que rompe reproducibilidad
// y fuerza pulls extra a Docker Hub (rate limit anónimo en CI).
const VERSION_GENERADOR = '7.26.0';
const NOMBRE_JAR = `openapi-generator-cli-${VERSION_GENERADOR}.jar`;
const DIR_CACHE = join(homedir(), '.cache', 'mapit');
const RUTA_JAR = join(DIR_CACHE, NOMBRE_JAR);
const URL_JAR = `https://repo1.maven.org/maven2/org/openapitools/openapi-generator-cli/${VERSION_GENERADOR}/${NOMBRE_JAR}`;

const ADDITIONAL_PROPERTIES = [
  'ngVersion=22.0.0',
  'providedInRoot=true',
  'withInterfaces=true',
  'useSingleRequestParameter=true',
  'fileNaming=kebab-case',
  'enumPropertyNaming=UPPERCASE',
  'supportsES6=true',
].join(',');

/** Argumentos del generador; las rutas cambian según corra en host o en Docker. */
function argsGenerador(contrato, destino) {
  return [
    'generate',
    '-i',
    contrato,
    '-g',
    'typescript-angular',
    '-o',
    destino,
    `--additional-properties=${ADDITIONAL_PROPERTIES}`,
  ];
}

mkdirSync(DESTINO_TS, { recursive: true });

// El generador corre como JAR de Maven Central siempre que haya Java
// (el caso en CI: los runners traen JDK preinstalado). Así la generación
// no depende de Docker Hub, cuyo rate limit anónimo tumba los pipelines.
// Sin Java, se cae a Docker como antes.
const javaOk = capture('java', ['-version']).ok;

/** Descarga el JAR oficial una sola vez y lo cachea en ~/.cache/mapit. */
async function asegurarJar() {
  if (existsSync(RUTA_JAR)) return true;
  mkdirSync(DIR_CACHE, { recursive: true });
  const resp = await fetch(URL_JAR).catch(() => null);
  if (!resp?.ok || !resp.body) {
    log.warn(`No se pudo descargar ${NOMBRE_JAR} de Maven Central.`);
    return false;
  }
  writeFileSync(RUTA_JAR, Buffer.from(await resp.arrayBuffer()));
  log.info(c.gray(`Generador cacheado en ${RUTA_JAR}`));
  return true;
}

/** Ejecuta el generador. Prueba JAR local → Docker, en ese orden. */
async function generar() {
  if (javaOk && (await asegurarJar())) {
    return capture('java', ['-jar', RUTA_JAR, ...argsGenerador(CONTRATO, DESTINO_TS)]);
  }

  const dockerOk = capture('docker', ['info']).ok;
  if (!dockerOk) {
    log.warn('Ni Java ni Docker están disponibles: no se puede generar el cliente ahora.');
    log.info('Instala un JDK o levanta Docker Desktop y repite:  pnpm api:gen');
    process.exit(0);
  }

  return capture(
    'docker',
    [
      'run',
      '--rm',
      '-v',
      `${ROOT}:/local`,
      `openapitools/openapi-generator-cli:v${VERSION_GENERADOR}`,
      ...argsGenerador(
        '/local/packages/api-contract/openapi.yaml',
        '/local/libs/api-client/src/lib/generated',
      ),
    ],
    { env: { MSYS_NO_PATHCONV: '1' } },
  );
}

const r = await generar();
if (!r.ok) {
  log.fail('El generador falló.');
  console.error(r.stderr || r.stdout);
  die(
    'No se pudo generar el cliente de API',
    `  Valida primero el contrato:  pnpm api:lint\n  Y comprueba que Java responde:  java -version  (o Docker:  docker info)`,
  );
}

writeFileSync(HUELLA, huellaActual + '\n', 'utf8');
log.ok(`cliente generado en libs/api-client/src/lib/generated`);
log.info(c.gray('Recuerda: ese código NO se commitea; se regenera en cada install y en CI.'));
