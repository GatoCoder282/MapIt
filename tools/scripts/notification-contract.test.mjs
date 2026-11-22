import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { ROOT } from './_lib.mjs';

// Usar el CLI instalado del contrato para leer YAML, sin añadir parsers/dependencias globales.
const contractDirectory = join(ROOT, 'packages/api-contract');
const requireContract = createRequire(join(contractDirectory, 'package.json'));
const cliPackage = requireContract.resolve('@redocly/cli/package.json');
const cli = JSON.parse(readFileSync(cliPackage, 'utf8'));
const scratch = mkdtempSync(join(tmpdir(), 'mapit-notification-contract-'));
after(() => {
  const inside = relative(tmpdir(), scratch);
  assert.ok(!inside.startsWith('..') && !isAbsolute(inside));
  rmSync(scratch, { recursive: true, force: true });
});
const output = join(scratch, 'contract.json');
const bundled = spawnSync(
  process.execPath,
  [join(dirname(cliPackage), cli.bin.redocly), 'bundle', 'openapi.yaml', '--output', output],
  { cwd: contractDirectory, encoding: 'utf8' },
);
assert.equal(bundled.status, 0, bundled.stdout + bundled.stderr);
const contract = JSON.parse(readFileSync(output, 'utf8'));
const resolve = (value) =>
  value.$ref
    ? value.$ref
        .slice(2)
        .split('/')
        .reduce((node, key) => node[key], contract)
    : value;
const operations = [
  ['/me/notifications', 'get', 'listMyNotifications'],
  ['/me/notifications/unread-count', 'get', 'countMyUnreadNotifications'],
  ['/me/notifications/{notificationId}/read', 'patch', 'markMyNotificationRead'],
  ['/me/notifications/read-all', 'patch', 'markAllMyNotificationsRead'],
];

test('solo las cuatro operaciones MVP, autenticadas y explícitamente pendientes', () => {
  assert.deepEqual(
    Object.keys(contract.paths)
      .filter((path) => path.startsWith('/me/notification'))
      .sort(),
    operations.map(([path]) => path).sort(),
  );
  for (const [path, method, operationId] of operations) {
    const op = contract.paths[path][method];
    assert.equal(op.operationId, operationId);
    assert.equal(op['x-implementation-status'], 'pending');
    assert.deepEqual(op.security, [{ bearerAuth: [] }]);
    assert.equal(op.requestBody, undefined);
    const parameters = op.parameters.map(resolve);
    assert.ok(
      parameters.every((parameter) =>
        ['X-Request-ID', 'limit', 'cursor', 'notificationId'].includes(parameter.name),
      ),
    );
    if (operationId !== 'listMyNotifications') {
      assert.ok(parameters.every((parameter) => parameter.in !== 'query'));
    }
  }
});

test('cursor opaco acotado y límite alineado al dominio, sin sort/offset/filtros de identidad', () => {
  const op = contract.paths['/me/notifications'].get;
  const query = op.parameters.map(resolve).filter((parameter) => parameter.in === 'query');
  assert.deepEqual(query.map((parameter) => parameter.name).sort(), ['cursor', 'limit']);
  const limit = query.find((parameter) => parameter.name === 'limit').schema;
  const domain = readFileSync(
    join(
      ROOT,
      'apps/backend/modules/operations/operations-domain/src/main/java/com/mapit/operations/domain/notification/NotificationPageRequest.java',
    ),
    'utf8',
  );
  const max = Number(/MAX_LIMIT\s*=\s*(\d+)/.exec(domain)[1]);
  assert.equal(limit.minimum, 1);
  assert.equal(limit.maximum, max);
  assert.equal(limit.default, 20);
  const cursor = resolve(query.find((parameter) => parameter.name === 'cursor').schema);
  assert.equal(cursor.type, 'string');
  assert.equal(cursor.minLength, 1);
  assert.equal(cursor.maxLength, 2048);
  const pattern = new RegExp(cursor.pattern);
  assert.ok(pattern.test('opaque-server-token_123'));
  for (const invalid of ['', '{"tenantId":"other"}', 'jwt.payload.signature'])
    assert.ok(!pattern.test(invalid));
});

test('éxitos y errores usan no-store, correlación y Problem compartido', () => {
  for (const [path, method] of operations) {
    const responses = contract.paths[path][method].responses;
    assert.deepEqual(Object.keys(responses).sort(), [
      '200',
      '400',
      '401',
      '403',
      '404',
      '500',
      '503',
    ]);
    for (const [status, value] of Object.entries(responses)) {
      const response = resolve(value);
      assert.equal(resolve(response.headers['Cache-Control']).schema.const, 'no-store');
      assert.equal(resolve(response.headers['Cache-Control']).required, true);
      assert.equal(resolve(response.headers['X-Request-ID']).required, true);
      if (status !== '200') {
        assert.equal(
          response.content['application/problem+json'].schema.$ref,
          '#/components/schemas/Problem',
        );
      }
    }
  }
});

test('el aviso público es mínimo y sus tipos coinciden con el catálogo existente', () => {
  const item = contract.components.schemas.NotificationItem;
  assert.equal(item.additionalProperties, false);
  assert.deepEqual(
    Object.keys(item.properties).sort(),
    [
      'id',
      'type',
      'category',
      'establishmentId',
      'reservationId',
      'occurredAt',
      'createdAt',
      'readAt',
    ].sort(),
  );
  assert.deepEqual(item.properties.readAt.type, ['string', 'null']);
  const domain = readFileSync(
    join(
      ROOT,
      'apps/backend/modules/operations/operations-domain/src/main/java/com/mapit/operations/domain/notification/NotificationType.java',
    ),
    'utf8',
  );
  const types = [...domain.matchAll(/\b([A-Z][A-Z0-9_]*)\("/g)].map((match) => match[1]);
  assert.deepEqual(contract.components.schemas.NotificationType.enum, types);
  assert.deepEqual(contract.components.schemas.NotificationCategory.enum, [
    'RESERVATIONS',
    'OPERATIONS',
  ]);
});

test('la página y ejemplos conservan continuación y estados leído/no leído sin exponer ámbito', () => {
  const page = contract.components.schemas.NotificationPage;
  assert.equal(page.additionalProperties, false);
  assert.equal(page.properties.content.maxItems, 100);
  assert.equal(page.properties.nextCursor.$ref, '#/components/schemas/NotificationCursor');
  const examples =
    contract.paths['/me/notifications'].get.responses['200'].content['application/json'].examples;
  for (const { value } of Object.values(examples)) {
    assert.ok(value.content.length <= 100);
    assert.equal(typeof value.hasMore, 'boolean');
    assert.equal('nextCursor' in value, value.hasMore);
    for (const item of value.content) {
      assert.ok(Date.parse(item.createdAt) >= Date.parse(item.occurredAt));
      if (item.readAt !== null) assert.ok(Date.parse(item.readAt) >= Date.parse(item.createdAt));
      assert.equal(
        item.category,
        item.type === 'RESERVATION_CREATED' ? 'RESERVATIONS' : 'OPERATIONS',
      );
    }
  }
});

test('mutaciones sin cuerpo ni corte del cliente y resultados proyectables desde los casos de uso', () => {
  const schemas = contract.components.schemas;
  assert.deepEqual(Object.keys(schemas.NotificationReadResult.properties).sort(), ['id', 'readAt']);
  assert.deepEqual(Object.keys(schemas.NotificationUnreadCount.properties), ['unreadCount']);
  assert.deepEqual(Object.keys(schemas.NotificationMarkAllReadResult.properties), ['updatedCount']);
  for (const schema of [schemas.NotificationUnreadCount, schemas.NotificationMarkAllReadResult]) {
    assert.equal(schema.additionalProperties, false);
    const [counter] = Object.values(schema.properties);
    assert.equal(counter.minimum, 0);
    assert.equal(counter.format, 'int64');
  }
});
