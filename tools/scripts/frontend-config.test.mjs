import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './_lib.mjs';
import { ENVIRONMENTS, LOG_LEVELS, buildConfig } from './frontend-config.mjs';

const PROD_API = 'https://mapit-qmr4.onrender.com/api/v1';
const QA_API = 'https://mapit-qa.onrender.com/api/v1';

test('con las variables actuales de producción el resultado no cambia (y public-web gana wsUrl)', () => {
  assert.deepEqual(
    buildConfig('console', { API_BASE_URL: PROD_API, WS_URL: 'wss://mapit-qmr4.onrender.com/ws' }),
    {
      apiBaseUrl: PROD_API,
      environment: 'production',
      logLevel: 'INFO',
      unleashProxyUrl: '',
      unleashClientKey: '',
      wsUrl: 'wss://mapit-qmr4.onrender.com/ws',
    },
  );
  assert.deepEqual(
    buildConfig('public-web', {
      API_BASE_URL: PROD_API,
      CONSOLE_BASE_URL: 'https://map-it-n7y1.vercel.app/',
    }),
    {
      apiBaseUrl: PROD_API,
      environment: 'production',
      logLevel: 'INFO',
      unleashProxyUrl: '',
      unleashClientKey: '',
      wsUrl: 'wss://mapit-qmr4.onrender.com/ws',
      consoleBaseUrl: 'https://map-it-n7y1.vercel.app',
    },
  );
});

test('el entorno Preview (QA) publica staging, Unleash y el origen público de pagos', () => {
  const config = buildConfig('console', {
    API_BASE_URL: QA_API,
    APP_ENV: 'Staging',
    LOG_LEVEL: 'debug',
    UNLEASH_FRONTEND_URL: 'https://mapit-unleash.onrender.com/api/frontend/',
    UNLEASH_FRONTEND_TOKEN: 'default:development.0123abcd',
    PUBLIC_WEB_URL: 'https://mapit-qa-web.vercel.app',
  });
  assert.equal(config.environment, 'staging');
  assert.equal(config.logLevel, 'DEBUG');
  assert.equal(config.wsUrl, 'wss://mapit-qa.onrender.com/ws');
  assert.equal(config.unleashProxyUrl, 'https://mapit-unleash.onrender.com/api/frontend');
  assert.equal(config.unleashClientKey, 'default:development.0123abcd');
  assert.equal(config.paymentPublicOrigin, 'https://mapit-qa-web.vercel.app');
});

test('las variables obligatorias siguen siendo obligatorias', () => {
  assert.throws(() => buildConfig('console', {}), /Falta API_BASE_URL/);
  assert.throws(
    () => buildConfig('public-web', { API_BASE_URL: PROD_API }),
    /Falta CONSOLE_BASE_URL/,
  );
  assert.throws(() => buildConfig('otra', { API_BASE_URL: PROD_API }), /Uso:/);
});

test('rechaza valores inseguros o inválidos', () => {
  const base = { API_BASE_URL: PROD_API };
  assert.throws(
    () => buildConfig('console', { API_BASE_URL: 'http://mapit.example/api' }),
    /https/,
  );
  assert.throws(() => buildConfig('console', { ...base, WS_URL: 'ws://mapit.example/ws' }), /wss/);
  assert.throws(() => buildConfig('console', { ...base, APP_ENV: 'qa' }), /APP_ENV=qa/);
  assert.throws(() => buildConfig('console', { ...base, APP_ENV: 'unknown' }), /APP_ENV/);
  assert.throws(() => buildConfig('console', { ...base, LOG_LEVEL: 'TRACE' }), /LOG_LEVEL/);
  assert.throws(
    () =>
      buildConfig('console', { ...base, PUBLIC_WEB_URL: 'https://mapit-qa-web.vercel.app/pago' }),
    /solo un origen/,
  );
});

test('Unleash exige URL y token frontend juntos, nunca un token admin', () => {
  const base = { API_BASE_URL: PROD_API };
  const url = 'https://mapit-unleash.onrender.com/api/frontend';
  assert.throws(() => buildConfig('console', { ...base, UNLEASH_FRONTEND_URL: url }), /juntas/);
  assert.throws(
    () => buildConfig('console', { ...base, UNLEASH_FRONTEND_TOKEN: 'default:production.abc' }),
    /juntas/,
  );
  assert.throws(
    () =>
      buildConfig('console', {
        ...base,
        UNLEASH_FRONTEND_URL: 'https://mapit-unleash.onrender.com/api/client',
        UNLEASH_FRONTEND_TOKEN: 'default:production.abc',
      }),
    /Frontend API/,
  );
  assert.throws(
    () =>
      buildConfig('console', {
        ...base,
        UNLEASH_FRONTEND_URL: url,
        UNLEASH_FRONTEND_TOKEN: '*:*.0123abcd',
      }),
    /nunca admin/,
  );
});

test('los entornos y niveles permitidos coinciden con el catálogo de logging', () => {
  const catalog = readFileSync(join(ROOT, 'libs/logging/src/catalog.ts'), 'utf8');
  const list = (name) =>
    [...new RegExp(`${name}[^=]*=\\s*\\[([^\\]]*)\\]`).exec(catalog)[1].matchAll(/'([^']+)'/g)].map(
      (m) => m[1],
    );
  assert.deepEqual(
    ENVIRONMENTS,
    list('LOG_ENVIRONMENTS').filter((e) => e !== 'unknown'),
  );
  assert.deepEqual(LOG_LEVELS, list('LOG_LEVELS'));
});
