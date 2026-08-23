#!/usr/bin/env node
/**
 * `pnpm new:spec CU-12-crear-reserva`
 *
 * Crea el directorio de especificación de un caso de uso a partir de la
 * plantilla, y precarga el enunciado del CU desde docs/roadmap/use_cases.md.
 *
 * Es el punto de entrada del ciclo Spec-Driven: spec → plan → tasks.
 */
import { cpSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, log, c, die } from './_lib.mjs';

const nombre = process.argv[2];
if (!nombre) {
  die(
    'Falta el nombre de la especificación',
    `  pnpm new:spec CU-12-crear-reserva\n\n  Formato: CU-<número>-<descripción-en-kebab-case>`,
  );
}
if (!/^CU-\d{2}-[a-z0-9-]+$/.test(nombre)) {
  die(
    `Nombre inválido: "${nombre}"`,
    `  Debe ser  CU-<2 dígitos>-<kebab-case>\n  Ejemplo:  CU-12-crear-reserva`,
  );
}

const plantilla = join(ROOT, 'specs', '_template');
const destino = join(ROOT, 'specs', nombre);

if (existsSync(destino)) {
  die(`La especificación "${nombre}" ya existe`, `  Ábrela en:  specs/${nombre}/spec.md`);
}

cpSync(plantilla, destino, { recursive: true });

/* Extrae el enunciado del CU desde el documento de casos de uso, para no
   tener que copiarlo a mano (y que no se copie mal). */
const codigo = nombre.slice(0, 5); // "CU-12"
let enunciado = '_(No se encontró el enunciado en docs/roadmap/use_cases.md — complétalo a mano.)_';
try {
  const casos = readFileSync(join(ROOT, 'docs', 'roadmap', 'use_cases.md'), 'utf8');
  const linea = casos.split('\n').find((l) => l.includes(`**${codigo}**`));
  if (linea) enunciado = linea.replace(/^[-*]\s*/, '').trim();
} catch {
  /* el documento puede no existir todavía */
}

const spec = join(destino, 'spec.md');
writeFileSync(
  spec,
  readFileSync(spec, 'utf8')
    .replaceAll('{{CODIGO}}', codigo)
    .replaceAll('{{NOMBRE}}', nombre)
    .replaceAll('{{ENUNCIADO}}', enunciado)
    .replaceAll('{{FECHA}}', new Date().toISOString().slice(0, 10)),
  'utf8',
);

for (const archivo of readdirSync(destino)) {
  const ruta = join(destino, archivo);
  writeFileSync(
    ruta,
    readFileSync(ruta, 'utf8')
      .replaceAll('{{CODIGO}}', codigo)
      .replaceAll('{{NOMBRE}}', nombre)
      .replaceAll('{{FECHA}}', new Date().toISOString().slice(0, 10)),
    'utf8',
  );
}

log.ok(`especificación creada en specs/${nombre}/`);
console.log(`
  ${c.bold('Siguiente paso — el ciclo Spec-Driven:')}

    1. ${c.cyan(`specs/${nombre}/spec.md`)}   ${c.gray('QUÉ y POR QUÉ: criterios de aceptación, reglas de negocio')}
    2. ${c.cyan(`specs/${nombre}/plan.md`)}   ${c.gray('CÓMO: módulos, contrato, migraciones, PATRONES de diseño')}
    3. ${c.cyan(`specs/${nombre}/tasks.md`)}  ${c.gray('tareas ejecutables y verificables, en orden')}

  ${c.yellow('La sección "Patrones de diseño aplicados" del plan.md es obligatoria.')}
  ${c.gray(`Rama sugerida:  git switch -c feat/${nombre}`)}
`);
