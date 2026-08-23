#!/usr/bin/env node
/**
 * `pnpm check` — la verificación completa antes de un push.
 * Corre TODO aunque algo falle, y al final resume qué pasó.
 */
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { ROOT, IS_WINDOWS, run, capture, c, loadEnv } from './_lib.mjs';

loadEnv();

const node = process.execPath;
const S = (f) => join(ROOT, 'tools', 'scripts', f);
const hayBackend =
  existsSync(join(ROOT, 'apps', 'backend', 'gradlew')) && capture('java', ['-version']).ok;

const tareas = [
  ['formato', 'pnpm', ['prettier', '--check', '.']],
  ['lint frontend', 'pnpm', ['run', 'fe:lint']],
  ['tipos', 'pnpm', ['run', 'fe:typecheck']],
  ['tests frontend', 'pnpm', ['run', 'fe:test']],
  ['build frontend', 'pnpm', ['run', 'fe:build']],
  ['contrato API', node, [S('gen-api.mjs'), '--check']],
  ...(hayBackend ? [['backend (build + tests + ArchUnit)', node, [S('gradle.mjs'), 'build']]] : []),
];

console.log(c.bold(c.cyan('\n  MapIt — verificación previa al push\n')));
if (!hayBackend) {
  console.log(c.yellow('  ! Backend omitido (falta Java o el wrapper de Gradle)\n'));
}

const resultados = [];
for (const [nombre, cmd, args] of tareas) {
  console.log(`\n${c.bold(c.cyan('▸'))} ${c.bold(nombre)}`);
  const code = run(cmd, args, { allowFailure: true });
  resultados.push([nombre, code === 0]);
}

console.log('\n' + c.gray('─'.repeat(62)));
for (const [nombre, ok] of resultados) {
  console.log(`  ${ok ? c.green('✔') : c.red('✖')}  ${nombre}`);
}

const fallos = resultados.filter(([, ok]) => !ok);
if (fallos.length === 0) {
  console.log(c.green(c.bold('\n  ✔ Todo en verde. Listo para push.\n')));
  process.exit(0);
}
console.log(
  c.red(c.bold(`\n  ✖ ${fallos.length} verificación(es) fallaron:`)) +
    `\n     ${fallos.map(([n]) => n).join(', ')}\n\n` +
    c.yellow('  Arregla lo de arriba antes de hacer push.\n') +
    c.gray('  Atajo para formato y lint:  pnpm fmt\n'),
);
process.exit(1);
