import assert from 'node:assert/strict';
import { test } from 'node:test';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './_lib.mjs';

const files = {
  java: 'apps/backend/shared-kernel/src/main/java/com/mapit/shared/flags/FeatureFlag.java',
  ts: 'libs/feature-flags/src/lib/feature-flag.catalog.ts',
  json: 'infra/docker/unleash/flags.json',
};

function fixture(t, newline = '\n') {
  const root = mkdtempSync(join(tmpdir(), 'mapit-flag-test-'));
  t.after(() => {
    const inside = relative(tmpdir(), root);
    assert.ok(!inside.startsWith('..') && !isAbsolute(inside));
    rmSync(root, { recursive: true, force: true });
  });
  for (const script of ['new-flag.mjs', '_lib.mjs']) {
    const target = join(root, 'tools/scripts', script);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(ROOT, 'tools/scripts', script), target);
  }
  for (const file of Object.values(files)) {
    const target = join(root, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(join(ROOT, file), 'utf8').replace(/\r?\n/g, newline));
  }
  const read = (type) => readFileSync(join(root, files[type]), 'utf8');
  const run = (...args) =>
    spawnSync(process.execPath, [join(root, 'tools/scripts/new-flag.mjs'), ...args], {
      encoding: 'utf8',
    });
  return { read, run, root };
}

for (const newline of ['\n', '\r\n']) {
  test(`inserta varios segmentos sin dañar enum, defaults ni bootstrap (${JSON.stringify(newline)})`, (t) => {
    const f = fixture(t, newline);
    const previous = JSON.parse(f.read('json')).features;
    const result = f.run('fixture.s6.notification-center', 'kill_switch');
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(
      f.read('java'),
      /FIXTURE_S6_NOTIFICATION_CENTER\("fixture\.s6\.notification-center", Tipo.KILL_SWITCH, false\);/,
    );
    assert.match(
      f.read('java'),
      /VERTICAL_EVENT_HALL\("vertical\.event-hall", Tipo.PERMISSION, true\),/,
    );
    assert.match(f.read('ts'), /'fixture.s6.notification-center': false/);
    const current = JSON.parse(f.read('json')).features;
    assert.deepEqual(current.slice(0, -1), previous);
    assert.equal(current.at(-1).name, 'fixture.s6.notification-center');
    assert.equal(current.at(-1).type, 'kill-switch');
    assert.equal(current.at(-1).enabled, false);
    const once = Object.fromEntries(Object.keys(files).map((key) => [key, f.read(key)]));
    assert.equal(f.run('fixture.s6.notification-center', 'kill_switch').status, 0);
    for (const key of Object.keys(files)) assert.equal(f.read(key), once[key]);
  });
}

test('conserva claves de dos segmentos y --on', (t) => {
  const f = fixture(t);
  assert.equal(f.run('fixture.legacy', 'release', '--on').status, 0);
  assert.match(f.read('java'), /FIXTURE_LEGACY\("fixture\.legacy", Tipo.RELEASE, true\);/);
  assert.equal(JSON.parse(f.read('json')).features.at(-1).enabled, true);
});

test('rechaza claves inválidas y tipos desconocidos sin modificar archivos', (t) => {
  const f = fixture(t);
  const before = Object.fromEntries(Object.keys(files).map((key) => [key, f.read(key)]));
  for (const args of [
    ['single'],
    ['UPPER.flag'],
    ['a..b'],
    ['a.b.'],
    ['a.1b'],
    ['a.b', 'invalid'],
  ]) {
    assert.notEqual(f.run(...args).status, 0);
    for (const key of Object.keys(files)) assert.equal(f.read(key), before[key]);
  }
});

test('un catálogo Java irreconocible falla antes de modificar los tres registros', (t) => {
  const f = fixture(t);
  writeFileSync(join(f.root, files.java), 'enum FeatureFlag { UNKNOWN; }\n');
  const before = Object.fromEntries(Object.keys(files).map((key) => [key, f.read(key)]));
  assert.notEqual(f.run('fixture.valid').status, 0);
  for (const key of Object.keys(files)) assert.equal(f.read(key), before[key]);
});
