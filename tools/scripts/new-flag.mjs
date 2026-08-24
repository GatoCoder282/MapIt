#!/usr/bin/env node
/**
 * `pnpm new:flag payments.qr`
 *
 * Crea una feature flag COHERENTE en los tres lugares donde debe existir:
 *   1. el enum Java   (shared-kernel/…/flags/FeatureFlag.java)
 *   2. el catálogo TS (libs/feature-flags/…/feature-flag.catalog.ts)
 *   3. el bootstrap   (infra/docker/unleash/flags.json)
 *
 * Hacerlo a mano en tres sitios es exactamente cómo se desincronizan.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, log, c, die } from './_lib.mjs';

const clave = process.argv[2];
const tipoArg = (process.argv[3] ?? 'release').toUpperCase();
const porDefecto = process.argv.includes('--on');

const TIPOS = ['RELEASE', 'KILL_SWITCH', 'EXPERIMENT', 'PERMISSION'];

if (!clave) {
  die(
    'Falta la clave de la flag',
    `  pnpm new:flag <dominio>.<feature> [tipo] [--on]\n\n` +
      `  Ejemplos:\n` +
      `    pnpm new:flag payments.qr release\n` +
      `    pnpm new:flag realtime.fallback kill_switch --on\n\n` +
      `  Tipos: ${TIPOS.join(', ').toLowerCase()}`,
  );
}
if (!/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(clave)) {
  die(
    `Clave inválida: "${clave}"`,
    `  Convención del proyecto: <dominio>.<feature>, todo en minúsculas.\n  Ejemplo: payments.qr`,
  );
}
if (!TIPOS.includes(tipoArg)) {
  die(`Tipo inválido: "${tipoArg}"`, `  Debe ser uno de: ${TIPOS.join(', ').toLowerCase()}`);
}

const constante = clave.toUpperCase().replace(/[.-]/g, '_');

/* ── 1. Enum de Java ─────────────────────────────────────── */
const rutaJava = join(
  ROOT,
  'apps',
  'backend',
  'shared-kernel',
  'src',
  'main',
  'java',
  'com',
  'mapit',
  'shared',
  'flags',
  'FeatureFlag.java',
);
let java = readFileSync(rutaJava, 'utf8');
if (java.includes(`"${clave}"`)) {
  log.warn(`la flag ya existe en el enum de Java`);
} else {
  const ultima = java.lastIndexOf('");\n');
  java =
    java.slice(0, ultima + 3) +
    `\n\n  /** TODO: describir para qué es esta flag y a qué CU pertenece. */\n` +
    `  ${constante}("${clave}", Tipo.${tipoArg}, ${porDefecto});` +
    java.slice(ultima + 3);
  // El último elemento de un enum de Java termina en `;` y los anteriores en `,`.
  // Al insertar una entrada nueva al final, la que antes cerraba el enum debe
  // pasar de `;` a `,`.
  java = java.replace(/\);\n\n {2}\/\*\* TODO/, '),\n\n  /** TODO');
  writeFileSync(rutaJava, java, 'utf8');
  log.ok('añadida al enum de Java');
}

/* ── 2. Catálogo de TypeScript ───────────────────────────── */
const rutaTs = join(ROOT, 'libs', 'feature-flags', 'src', 'lib', 'feature-flag.catalog.ts');
let ts = readFileSync(rutaTs, 'utf8');
if (ts.includes(`'${clave}'`)) {
  log.warn('la flag ya existe en el catálogo de TypeScript');
} else {
  ts = ts.replace(
    /\n\} as const satisfies/,
    `\n\n  /** TODO: describir para qué es esta flag y a qué CU pertenece. */\n` +
      `  '${clave}': ${porDefecto},\n} as const satisfies`,
  );
  writeFileSync(rutaTs, ts, 'utf8');
  log.ok('añadida al catálogo de TypeScript');
}

/* ── 3. Bootstrap de Unleash ─────────────────────────────── */
const rutaJson = join(ROOT, 'infra', 'docker', 'unleash', 'flags.json');
const bootstrap = JSON.parse(readFileSync(rutaJson, 'utf8'));
if (bootstrap.features.some((f) => f.name === clave)) {
  log.warn('la flag ya existe en el bootstrap de Unleash');
} else {
  const entrada = {
    name: clave,
    description: 'TODO: describir para qué es esta flag y a qué CU pertenece.',
    type: tipoArg.toLowerCase().replace('_', '-'),
    enabled: porDefecto,
  };
  if (tipoArg === 'RELEASE' || tipoArg === 'EXPERIMENT') {
    // Higiene: las flags temporales nacen con fecha de retiro.
    const retiro = new Date();
    retiro.setMonth(retiro.getMonth() + 3);
    entrada.expiresAt = retiro.toISOString().slice(0, 10);
  }
  bootstrap.features.push(entrada);
  writeFileSync(rutaJson, JSON.stringify(bootstrap, null, 2) + '\n', 'utf8');
  log.ok('añadida al bootstrap de Unleash');
}

console.log(`
  ${c.bold(`Flag "${clave}" creada`)}  ${c.gray(`(${tipoArg.toLowerCase()}, por defecto ${porDefecto ? 'ON' : 'OFF'})`)}

  ${c.bold('Pendiente:')}
    1. Sustituye los TODO por una descripción real en los tres archivos.
    2. Créala también en la UI:  ${c.cyan('http://localhost:4242')}
    3. Úsala:
       ${c.gray('Backend:')}  if (flags.isEnabled(FeatureFlag.${constante})) { … }
       ${c.gray('Angular:')}  @if (flags.isEnabled('${clave}')()) { … }
${
  tipoArg === 'RELEASE'
    ? `\n  ${c.yellow('Es un release toggle: abre ya el issue para retirarla.')}\n  ${c.gray('Las flags zombis son deuda técnica.')}\n`
    : ''
}`);
