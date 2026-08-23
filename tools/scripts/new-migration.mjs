#!/usr/bin/env node
/**
 * `pnpm db:new "crear tabla reservation"`
 *
 * Crea la siguiente migración de Flyway con la numeración correcta y una
 * plantilla que YA incluye la convención multi-tenant del proyecto.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, log, c, die } from './_lib.mjs';

const descripcion = process.argv.slice(2).join(' ').trim();
if (!descripcion) {
  die('Falta la descripción de la migración', `  pnpm db:new "crear tabla reservation"`);
}

const DIR = join(
  ROOT,
  'apps',
  'backend',
  'bootstrap',
  'src',
  'main',
  'resources',
  'db',
  'migration',
);
mkdirSync(DIR, { recursive: true });

const existentes = readdirSync(DIR).filter((f) => /^V\d+__/.test(f));
const siguiente =
  existentes.reduce((max, f) => Math.max(max, Number(/^V(\d+)__/.exec(f)?.[1] ?? 0)), 0) + 1;

const slug = descripcion
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_|_$/g, '');

const archivo = join(DIR, `V${siguiente}__${slug}.sql`);
if (existsSync(archivo)) die(`Ya existe ${archivo}`);

writeFileSync(
  archivo,
  `-- ${descripcion}
-- Migración V${siguiente}. Creada el ${new Date().toISOString().slice(0, 10)}.
--
-- REGLAS (plan §12):
--   1. Toda tabla de negocio lleva  tenant_id TEXT NOT NULL REFERENCES tenant(id)
--   2. Índice compuesto (tenant_id, id)
--   3. SELECT enable_tenant_isolation('<tabla>');  ← activa RLS
--   4. NUNCA edites una migración ya mergeada: Flyway guarda su checksum
--      y el arranque fallará. Para corregir, crea una migración nueva.
--   5. Actualiza docs/db/mapit.dbml en el MISMO commit.

-- CREATE TABLE ejemplo (
--     id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
--     tenant_id  TEXT        NOT NULL REFERENCES tenant(id),
--     nombre     TEXT        NOT NULL,
--     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
--     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
-- );
--
-- CREATE INDEX ON ejemplo (tenant_id, id);
-- SELECT enable_tenant_isolation('ejemplo');
-- CREATE TRIGGER ejemplo_touch_updated_at
--     BEFORE UPDATE ON ejemplo
--     FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
`,
  'utf8',
);

log.ok(`migración creada: ${archivo.replace(ROOT, '.')}`);
console.log(`
  ${c.gray('Aplicar:')}   pnpm db:migrate
  ${c.gray('Estado:')}    pnpm db:info
  ${c.yellow('Recuerda actualizar docs/db/mapit.dbml en el mismo commit.')}
`);
