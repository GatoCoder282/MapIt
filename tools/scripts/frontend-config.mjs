import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from './_lib.mjs';

// Ejecutar después de ng build (Build Command de Vercel). Genera el config.json de runtime con
// configuración PÚBLICA por entorno: cada variable se define en Vercel con scope Production o
// Preview (QA). Nunca escribe secretos: todo lo que sale de aquí lo descarga el navegador.

export const APPS = ['console', 'public-web'];
// Espejo de LOG_ENVIRONMENTS (libs/logging/src/catalog.ts) sin `unknown`; el test lo verifica.
export const ENVIRONMENTS = ['development', 'test', 'staging', 'production'];
// Espejo de LOG_LEVELS (libs/logging/src/catalog.ts); el test lo verifica.
export const LOG_LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'OFF'];

function read(env, name) {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

function publicUrl(env, name, { protocols = ['https:'], required = true } = {}) {
  const value = read(env, name);
  if (!value) {
    if (required) throw new Error(`Falta ${name} en las variables del build`);
    return undefined;
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} no es una URL válida: ${value}`);
  }
  if (!protocols.includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error(
      `${name} debe ser una URL pública ${protocols.join('/')} sin credenciales, query ni fragmento`,
    );
  }
  return url;
}

const sinBarraFinal = (url) => url.href.replace(/\/$/, '');

function originOnly(env, name) {
  const url = publicUrl(env, name, { required: false });
  if (!url) return undefined;
  if (url.pathname !== '/') throw new Error(`${name} debe ser solo un origen, sin ruta`);
  return url.origin;
}

function oneOf(env, name, allowed, fallback, normalize = (v) => v) {
  const value = read(env, name);
  if (!value) return fallback;
  const normalized = normalize(value);
  if (!allowed.includes(normalized)) {
    throw new Error(`${name}=${value} no es válido; usa uno de: ${allowed.join(', ')}`);
  }
  return normalized;
}

// Token de la Frontend API de Unleash: `<proyecto>:<entorno>.<secreto>`. Un token admin
// (`*:*.`) nunca puede llegar al navegador.
const UNLEASH_TOKEN = /^[^\s:]+:[^\s.*]+\.[A-Za-z0-9_-]+$/;

function unleash(env) {
  const url = publicUrl(env, 'UNLEASH_FRONTEND_URL', { required: false });
  const token = read(env, 'UNLEASH_FRONTEND_TOKEN');
  if (!url && !token) return { unleashProxyUrl: '', unleashClientKey: '' };
  if (!url || !token) {
    throw new Error('Define UNLEASH_FRONTEND_URL y UNLEASH_FRONTEND_TOKEN juntas, o ninguna');
  }
  const href = sinBarraFinal(url);
  if (!href.endsWith('/api/frontend')) {
    throw new Error(
      'UNLEASH_FRONTEND_URL debe apuntar a la Frontend API: https://<unleash>/api/frontend',
    );
  }
  if (token.startsWith('*:*.') || !UNLEASH_TOKEN.test(token)) {
    throw new Error(
      'UNLEASH_FRONTEND_TOKEN debe ser un token de tipo frontend (<proyecto>:<entorno>.<secreto>), nunca admin',
    );
  }
  return { unleashProxyUrl: href, unleashClientKey: token };
}

/** Construye el config.json público de `app` a partir de las variables del build. */
export function buildConfig(app, env = process.env) {
  if (!APPS.includes(app)) {
    throw new Error('Uso: node tools/scripts/frontend-config.mjs console|public-web');
  }
  const api = publicUrl(env, 'API_BASE_URL');
  // Sin WS_URL, el broker STOMP vive en la raíz del mismo backend que la API.
  const ws =
    publicUrl(env, 'WS_URL', { protocols: ['wss:'], required: false }) ??
    new URL('/ws', api.origin.replace(/^https:/, 'wss:'));

  const config = {
    apiBaseUrl: sinBarraFinal(api),
    environment: oneOf(env, 'APP_ENV', ENVIRONMENTS, 'production', (v) => v.toLowerCase()),
    logLevel: oneOf(env, 'LOG_LEVEL', LOG_LEVELS, 'INFO', (v) => v.toUpperCase()),
    ...unleash(env),
    wsUrl: sinBarraFinal(ws),
  };
  const paymentPublicOrigin = originOnly(env, 'PUBLIC_WEB_URL');
  if (paymentPublicOrigin) config.paymentPublicOrigin = paymentPublicOrigin;
  if (app === 'public-web') {
    config.consoleBaseUrl = sinBarraFinal(publicUrl(env, 'CONSOLE_BASE_URL'));
  }
  return config;
}

function main() {
  const app = process.argv[2];
  const config = buildConfig(app);
  const output = join(ROOT, 'dist', app, 'browser');
  if (!existsSync(join(output, 'index.html'))) {
    throw new Error(`No existe el build de ${app}; ejecuta ng build primero`);
  }
  const json = JSON.stringify(config, null, 2) + '\n';
  mkdirSync(join(output, 'assets'), { recursive: true });
  writeFileSync(join(output, 'assets', 'config.json'), json);
  // public-web conserva una ruta antigua de configuración; publicar los mismos valores.
  if (app === 'public-web') writeFileSync(join(output, 'config.json'), json);
  console.log(
    `Configuración pública (${config.environment}) generada para ${app} → ${config.apiBaseUrl}`,
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
