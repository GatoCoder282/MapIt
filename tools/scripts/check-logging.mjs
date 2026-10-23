#!/usr/bin/env node
/** MAP-189: prueba del JSON real de los contenedores, sin imprimir sus contenidos. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { capture, log } from './_lib.mjs';

const api = process.env.API_BASE_URL ?? 'http://localhost:8080/api/v1';
const sites = [
  ['mapit-console', process.env.CONSOLE_URL ?? 'http://localhost:4200'],
  ['mapit-public-web', process.env.PUBLIC_WEB_URL ?? 'http://localhost:4300'],
];
const since = new Date().toISOString();
const sentinel = `mapit-private-${randomUUID()}`;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function containerLogs(name) {
  const result = capture('docker', ['logs', '--since', since, name]);
  assert.ok(result.ok, `No se pudieron leer los logs de ${name}`);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.ok(!output.includes(sentinel), `Se filtró el secreto señuelo en ${name}`);
  return output
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith('{'))
    .map((line) => JSON.parse(line));
}

async function verify() {
  const sentId = randomUUID();
  const response = await fetch(`${api}/tenants?token=${sentinel}`, {
    headers: { 'X-Request-ID': sentId.toUpperCase(), Authorization: `Bearer ${sentinel}` },
    signal: globalThis.AbortSignal.timeout(15_000),
  });
  assert.equal(response.status, 401, 'El token inválido debe seguir produciendo 401');
  assert.equal(response.headers.get('X-Request-ID'), sentId, 'Debe normalizar el UUID');

  const invalid = await fetch(`${api}/tenants`, {
    headers: { 'X-Request-ID': sentinel },
    signal: globalThis.AbortSignal.timeout(15_000),
  });
  assert.match(invalid.headers.get('X-Request-ID') ?? '', uuid, 'Debe reemplazar el ID inválido');

  for (const [, base] of sites) {
    const missing = await fetch(`${base}/${sentinel}.js?token=${sentinel}`, {
      headers: {
        Referer: `https://example.invalid/?token=${sentinel}`,
        Cookie: `secret=${sentinel}`,
      },
      signal: globalThis.AbortSignal.timeout(15_000),
    });
    assert.equal(missing.status, 404, 'El recurso señuelo no debe existir');
    await missing.arrayBuffer();
  }

  // Espera acotada a la escritura del access log tras finalizar la respuesta.
  let found = false;
  for (let attempt = 0; attempt < 20; attempt++) {
    const events = containerLogs('mapit-backend');
    const summary = events.find(
      (event) => event.event === 'http.request.completed' && event.request_id === sentId,
    );
    if (summary) {
      assert.equal(summary.status, 401);
      assert.equal(typeof summary.duration_ms, 'number');
      assert.ok(!summary.tenant_id, 'Un JWT inválido no debe crear contexto de tenant');
      found = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(found, 'Debe existir el resumen HTTP correlacionado en stdout del backend');

  for (const [name] of sites) {
    const events = containerLogs(name);
    assert.ok(
      events.some((event) => event.event === 'http.request.completed' && event.status === 404),
      `Falta el acceso fallido estructurado de ${name}`,
    );
  }
  for (const name of ['mapit-backend', ...sites.map(([name]) => name)]) {
    const config = capture('docker', [
      'inspect',
      '--format',
      '{{json .HostConfig.LogConfig}}',
      name,
    ]);
    assert.ok(config.ok, `No se pudo verificar la rotación de ${name}`);
    const parsed = JSON.parse(config.stdout);
    assert.equal(parsed.Type, 'json-file');
    assert.equal(parsed.Config['max-size'], '10m');
    assert.equal(parsed.Config['max-file'], '3');
  }
  log.ok('MAP-189: correlación HTTP, privacidad, JSON Nginx y rotación Docker verificados.');
}

verify().catch((error) => {
  log.fail(
    error instanceof assert.AssertionError
      ? error.message
      : 'No se pudo consultar el stack; comprueba pnpm infra:full.',
  );
  process.exitCode = 1;
});
