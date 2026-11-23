import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const mockUnleash = `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const base = '/api/admin/projects/default/features';
const pending = ['payments.qr', 'check-in.camera'];
const { features } = JSON.parse(readFileSync('infra/docker/unleash/flags.json', 'utf8'));
const existing = features.filter(({ name }) => !pending.includes(name));
const writes = [];
globalThis.fetch = async (url, options = {}) => {
  const { pathname } = new URL(url);
  if (pathname === '/health') return new Response(null);
  if (pathname === base && !options.method) return Response.json({ features: existing });
  assert.equal(options.method, 'POST');
  if (pathname === base) {
    const { name } = JSON.parse(options.body);
    assert.ok(pending.includes(name), 'Existing flags must not receive writes');
    writes.push(name);
    return new Response(null, { status: 201 });
  }
  assert.equal(pathname, base + '/check-in.camera/environments/development/on');
  writes.push(pathname);
  return new Response(null, { status: Number(process.env.TEST_ACTIVATION_HTTP_STATUS) });
};
process.on('exit', () => {
  assert.deepEqual(writes.sort(), [
    ...pending, base + '/check-in.camera/environments/development/on'
  ].sort());
});
`;

function runSeed(status) {
  return spawnSync(
    process.execPath,
    [
      '--import',
      'data:text/javascript,' + encodeURIComponent(mockUnleash),
      'tools/scripts/seed-flags.mjs',
    ],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        UNLEASH_URL: 'http://unleash.invalid',
        UNLEASH_ENVIRONMENT: 'development',
        TEST_ACTIVATION_HTTP_STATUS: status,
      },
    },
  );
}

test('crea flags faltantes y activa solo las que nacen encendidas', () => {
  const seed = runSeed('200');
  assert.equal(seed.status, 0, seed.stderr);
  assert.match(seed.stdout, /2 flag\(s\) creadas, \d+ existentes sin cambios/);
});

test('reporta la flag si Unleash rechaza su activación', () => {
  const seed = runSeed('403');
  assert.equal(seed.status, 1, seed.stderr);
  assert.match(seed.stdout, /check-in.camera.*HTTP 403/);
  assert.match(seed.stderr, /la carga de 1 flag/);
});
