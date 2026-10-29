#!/usr/bin/env node
/** Recuperación local del historial de pagos renumerado al integrar main. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32 } from 'node:zlib';
import { ROOT, loadEnv, run } from './_lib.mjs';

const COLUMNS = 'installed_rank,version,script,checksum,success';
const HISTORY = `SELECT coalesce(json_agg(h ORDER BY installed_rank),'[]') FROM (SELECT ${COLUMNS} FROM flyway_schema_history) h`;

export function flywayChecksum(source) {
  let checksum = 0;
  for (const line of source.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/)) {
    checksum = crc32(Buffer.from(line, 'utf8'), checksum);
  }
  return checksum | 0;
}

export function reconciliationPlan(history, migrations) {
  const canonical = new Map(migrations.map((migration) => [migration.version, migration]));
  if (
    history.length &&
    history.every((row) => {
      const migration = canonical.get(row.version);
      return row.success && migration?.script === row.script && migration.checksum === row.checksum;
    })
  )
    return [];
  if (history.length !== 28)
    throw new Error('Solo se reconoce el historial legacy completo V1–V28.');
  const changes = [];
  for (let version = 1; version <= 28; version++) {
    const rows = history.filter((row) => row.version === String(version));
    if (rows.length !== 1) throw new Error(`Versión V${version} ausente o duplicada.`);
    const row = rows[0];
    const target = canonical.get(String(version < 20 ? version : version + 3));
    const expectedScript = target?.script.replace(/^V\d+__/, `V${version}__`);
    if (
      !row.success ||
      !target ||
      row.script !== expectedScript ||
      row.checksum !== target.checksum
    ) {
      throw new Error(
        `V${version} no coincide exactamente con el script esperado; no se modifica el historial.`,
      );
    }
    if (version >= 20)
      changes.push({ ...row, targetVersion: target.version, targetScript: target.script });
  }
  return changes.reverse();
}

export function reconciliationSql(history, changes) {
  const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
  return `BEGIN;
LOCK TABLE flyway_schema_history IN ACCESS EXCLUSIVE MODE;
DO $mapit$
BEGIN
  IF (${HISTORY})::jsonb IS DISTINCT FROM ${literal(JSON.stringify(history))}::jsonb THEN
    RAISE EXCEPTION 'El historial cambió tras el diagnóstico; recuperación cancelada';
  END IF;
END $mapit$;
${changes.map((change) => `UPDATE flyway_schema_history SET version=${literal(change.targetVersion)}, script=${literal(change.targetScript)} WHERE installed_rank=${Number(change.installed_rank)};`).join('\n')}
COMMIT;`;
}

function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--apply'))
    throw new Error('Uso: node tools/scripts/reconcile-local-payment-migrations.mjs [--apply]');
  loadEnv();
  const database = process.env.POSTGRES_DB || 'mapit';
  const user = process.env.POSTGRES_USER || 'mapit';
  const url = new URL(
    (process.env.DB_URL || 'jdbc:postgresql://localhost:5433/mapit').replace(/^jdbc:/, ''),
  );
  if (
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    decodeURIComponent(url.pathname) !== `/${database}` ||
    url.port !== (process.env.POSTGRES_PORT || '5433')
  ) {
    throw new Error('DB_URL debe apuntar a la misma base del contenedor PostgreSQL local.');
  }
  // Únicamente el contenedor local de desarrollo; no admite URL ni host remotos.
  const docker = (args, options = {}) =>
    execFileSync('docker', ['exec', '-i', 'mapit-postgres', ...args], {
      maxBuffer: 128 * 1024 * 1024,
      ...options,
    });
  const psql = (sql) =>
    docker(['psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', user, '-d', database, '-At'], {
      input: sql,
      encoding: 'utf8',
    });
  const history = JSON.parse(psql(HISTORY));
  const directory = join(ROOT, 'apps/backend/bootstrap/src/main/resources/db/migration');
  const migrations = readdirSync(directory).flatMap((script) => {
    const match = /^V(\d+)__.*\.sql$/.exec(script);
    return match
      ? [
          {
            version: match[1],
            script,
            checksum: flywayChecksum(readFileSync(join(directory, script), 'utf8')),
          },
        ]
      : [];
  });
  const changes = reconciliationPlan(history, migrations);
  if (!changes.length) {
    console.log('El historial ya coincide con los scripts actuales; no se modifica.');
    return;
  }
  for (const change of changes)
    console.log(
      `V${change.version} → V${change.targetVersion}: checksum ${change.checksum} idéntico`,
    );
  if (!args.includes('--apply')) {
    console.log(
      'Diagnóstico sin cambios. --apply respalda la base, reconcilia las versiones equivalentes y ejecuta Flyway.',
    );
    return;
  }
  const backups = join(ROOT, '.tmp');
  mkdirSync(backups, { recursive: true });
  const backup = join(backups, `before-payment-history-${Date.now()}.dump`);
  const dump = docker(['pg_dump', '-U', user, '-d', database, '--format=custom']);
  writeFileSync(backup, dump, { flag: 'wx' });
  console.log(`Respaldo completo: ${backup}`);
  psql(reconciliationSql(history, changes));
  const code = run(
    process.execPath,
    [
      join(ROOT, 'tools/scripts/gradle.mjs'),
      ':bootstrap:flywayMigrate',
      '-Dflyway.outOfOrder=true',
    ],
    { allowFailure: true },
  );
  if (code !== 0)
    throw new Error(
      'Falló Flyway tras reconciliar el historial. Conservar el respaldo y revisar el diagnóstico antes de reintentar.',
    );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
