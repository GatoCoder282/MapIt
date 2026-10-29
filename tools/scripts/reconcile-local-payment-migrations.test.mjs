import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './_lib.mjs';
import {
  flywayChecksum,
  reconciliationPlan,
  reconciliationSql,
} from './reconcile-local-payment-migrations.mjs';

const directory = join(ROOT, 'apps/backend/bootstrap/src/main/resources/db/migration');
const migrations = readdirSync(directory).map((script) => ({
  version: /^V(\d+)__/.exec(script)[1],
  script,
  checksum: flywayChecksum(readFileSync(join(directory, script), 'utf8')),
}));
const legacy = () =>
  Array.from({ length: 28 }, (_, index) => {
    const version = index + 1;
    const target = migrations.find(
      (migration) => migration.version === String(version < 20 ? version : version + 3),
    );
    return {
      installed_rank: version,
      version: String(version),
      script: target.script.replace(/^V\d+__/, `V${version}__`),
      checksum: target.checksum,
      success: true,
    };
  });

test('checksum Flyway independiente de BOM y terminadores de línea', () => {
  assert.equal(
    flywayChecksum('SELECT 1;\nSELECT 2;\n'),
    flywayChecksum('\ufeffSELECT 1;\r\nSELECT 2;\r\n'),
  );
  assert.equal(migrations.find((migration) => migration.version === '23').checksum, -315457811);
});
test('reconcilia solo los nueve pagos equivalentes sin cambiar checksums ni ranks', () => {
  const history = legacy();
  const plan = reconciliationPlan(history, migrations);
  assert.equal(plan.length, 9);
  assert.equal(plan[0].version, '28');
  assert.equal(plan[0].targetVersion, '31');
  assert.equal(plan[8].targetVersion, '23');
  assert.equal(plan[0].checksum, history[27].checksum);
  const sql = reconciliationSql(history, plan);
  assert.match(sql, /ACCESS EXCLUSIVE/);
  assert.match(sql, /IS DISTINCT FROM/);
  assert.doesNotMatch(sql, /SET checksum|DELETE |TRUNCATE |DROP /);
});
test('historial canónico no se vuelve a reconciliar', () => {
  const canonical = migrations.map((migration, index) => ({
    ...migration,
    installed_rank: index + 1,
    success: true,
  }));
  assert.deepEqual(reconciliationPlan(canonical, migrations), []);
});
test('rechaza checksum alterado, script diferente, fallo, duplicado e historial parcial', () => {
  for (const mutate of [
    (rows) => {
      rows[20].checksum++;
    },
    (rows) => {
      rows[20].script = 'V21__otro.sql';
    },
    (rows) => {
      rows[20].success = false;
    },
    (rows) => {
      rows[20].version = '20';
    },
    (rows) => {
      rows.pop();
    },
  ]) {
    const rows = legacy();
    mutate(rows);
    assert.throws(() => reconciliationPlan(rows, migrations));
  }
});
