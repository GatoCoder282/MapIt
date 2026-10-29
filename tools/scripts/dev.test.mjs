import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import net from 'node:net';
import { once } from 'node:events';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { join } from 'node:path';
import { ROOT } from './_lib.mjs';

const execute = promisify(execFile);

async function checkBusyPort(host, mode, portVariable, name) {
  const server = net.createServer();
  server.listen(0, host);
  await once(server, 'listening');
  const port = server.address().port;
  try {
    await assert.rejects(
      execute(process.execPath, [join(ROOT, 'tools/scripts/dev.mjs'), mode], {
        env: { ...process.env, [portVariable]: String(port) },
        timeout: 10000,
      }),
      (error) => {
        assert.equal(error.code, 1);
        assert.ok(error.stderr.includes(`${name}: ${port}`));
        assert.match(error.stderr, /No se inició ningún proceso nuevo/);
        assert.doesNotMatch(error.stdout, /Infraestructura|Backend \(Spring Boot\)|Frontend:/);
        if (mode === 'front') assert.doesNotMatch(error.stderr, /Backend:/);
        return true;
      },
    );
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test('rechaza backend ocupado en IPv4 antes de iniciar procesos', () =>
  checkBusyPort('127.0.0.1', 'back', 'SERVER_PORT', 'Backend'));
test('rechaza backend ocupado únicamente en IPv6', () =>
  checkBusyPort('::1', 'back', 'SERVER_PORT', 'Backend'));
test('modo front identifica Console y no comprueba el backend', () =>
  checkBusyPort('127.0.0.1', 'front', 'CONSOLE_PORT', 'Console'));
