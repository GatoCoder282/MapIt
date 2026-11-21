import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { ROOT } from './_lib.mjs';

const javaPath = 'apps/backend/shared-kernel/src/main/java/com/mapit/shared/flags/FeatureFlag.java';
const tsPath = 'libs/feature-flags/src/lib/feature-flag.catalog.ts';
const jsonPath = 'infra/docker/unleash/flags.json';
const catalogs = [javaPath, tsPath, jsonPath];

function fixture(t, newline = '\n') {
  const root = mkdtempSync(join(tmpdir(), 'mapit-new-flag-'));
  t.after(() => {
    // Borrar únicamente el directorio temporal creado por esta prueba.
    assert.equal(dirname(root), resolve(tmpdir()));
    assert.ok(basename(root).startsWith('mapit-new-flag-'));
    rmSync(root, { recursive: true, force: true });
  });
  for (const file of ['tools/scripts/new-flag.mjs', 'tools/scripts/_lib.mjs', ...catalogs]) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    if (catalogs.includes(file)) {
      writeFileSync(
        join(root, file),
        readFileSync(join(ROOT, file), 'utf8').replace(/\r?\n/g, newline),
      );
    } else {
      copyFileSync(join(ROOT, file), join(root, file));
    }
  }
  return {
    read: (file) => readFileSync(join(root, file), 'utf8'),
    run: (...args) =>
      spawnSync(process.execPath, [join(root, 'tools/scripts/new-flag.mjs'), ...args], {
        encoding: 'utf8',
        cwd: root,
      }),
  };
}

for (const newline of ['\n', '\r\n']) {
  test(`genera tres segmentos OFF, preserva entradas y es idempotente con ${JSON.stringify(newline)}`, (t) => {
    const files = fixture(t, newline);
    const originalJava = files.read(javaPath);
    const originalTs = files.read(tsPath);
    const originalBootstrap = JSON.parse(files.read(jsonPath));
    const result = files.run('mapit.test.my-account', 'release');
    assert.equal(result.status, 0, result.stderr);
    const java = files.read(javaPath);
    assert.ok(java.startsWith('package com.mapit.shared.flags;'));
    assert.match(java, /MAPIT_TEST_MY_ACCOUNT\("mapit\.test\.my-account", Tipo\.RELEASE, false\);/);
    // Quitar exclusivamente la entrada insertada reproduce el enum anterior.
    const inserted =
      `${newline}${newline}  /** TODO: describir para qué es esta flag y a qué CU pertenece. */${newline}` +
      '  MAPIT_TEST_MY_ACCOUNT("mapit.test.my-account", Tipo.RELEASE, false);';
    assert.equal(java.replace(`,${inserted}`, ';'), originalJava);
    assert.equal(
      files
        .read(tsPath)
        .replace(
          `${newline}${newline}  /** TODO: describir para qué es esta flag y a qué CU pertenece. */${newline}  'mapit.test.my-account': false,`,
          '',
        ),
      originalTs,
    );
    const bootstrap = JSON.parse(files.read(jsonPath));
    assert.deepEqual(bootstrap.features.slice(0, -1), originalBootstrap.features);
    assert.equal(bootstrap.features.at(-1).enabled, false);
    assert.equal(bootstrap.features.at(-1).name, 'mapit.test.my-account');
    assert.match(bootstrap.features.at(-1).expiresAt, /^\d{4}-\d{2}-\d{2}$/);
    const generated = catalogs.map(files.read);
    assert.equal(files.run('mapit.test.my-account', 'release').status, 0);
    assert.deepEqual(catalogs.map(files.read), generated);
  });
}

test('conserva claves de dos segmentos, --on y conversión kill_switch', (t) => {
  const files = fixture(t);
  const result = files.run('test.legacy-flag', 'kill_switch', '--on');
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    files.read(javaPath),
    /TEST_LEGACY_FLAG\("test\.legacy-flag", Tipo\.KILL_SWITCH, true\);/,
  );
  assert.match(files.read(tsPath), /'test\.legacy-flag': true/);
  assert.deepEqual(JSON.parse(files.read(jsonPath)).features.at(-1), {
    name: 'test.legacy-flag',
    description: 'TODO: describir para qué es esta flag y a qué CU pertenece.',
    type: 'kill-switch',
    enabled: true,
  });
});

test('rechaza segmentos inválidos antes de escribir catálogos', (t) => {
  const files = fixture(t);
  const original = catalogs.map(files.read);
  for (const key of [
    'mapit',
    'mapit..account',
    'Mapit.s6.account',
    '.mapit.account',
    'mapit.account.',
    'mapit.6.account',
    'mapit.s6.my_account',
  ]) {
    assert.notEqual(files.run(key, 'release').status, 0, key);
    assert.deepEqual(catalogs.map(files.read), original, key);
  }
});
