import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appName = process.argv[2];
const appPaths = {
  console: 'apps/console',
  'public-web': 'apps/public-web',
};
const appPath = appPaths[appName];

if (!appPath) {
  throw new Error('Uso: node tools/scripts/configure-vercel.mjs <console|public-web>');
}

const rawApiBaseUrl = process.env.MAPIT_API_BASE_URL?.trim();
if (!rawApiBaseUrl) {
  throw new Error('Define MAPIT_API_BASE_URL en las variables de entorno de Vercel.');
}

const apiUrl = new URL(rawApiBaseUrl);
const apiPath = apiUrl.pathname.endsWith('/') ? apiUrl.pathname.slice(0, -1) : apiUrl.pathname;
if (apiUrl.protocol !== 'https:' || !apiPath.endsWith('/api/v1')) {
  throw new Error('MAPIT_API_BASE_URL debe ser HTTPS y terminar en /api/v1.');
}

const config = {
  apiBaseUrl: apiUrl.origin + apiPath,
  environment: 'production',
  logLevel: 'INFO',
};

if (appName === 'console') {
  const wsUrl = process.env.MAPIT_WS_URL?.trim() || 'wss://' + apiUrl.host + '/ws';
  if (new URL(wsUrl).protocol !== 'wss:') {
    throw new Error('MAPIT_WS_URL debe usar WSS en producción.');
  }

  config.wsUrl = wsUrl;
  config.unleashProxyUrl = process.env.UNLEASH_PROXY_URL?.trim() || '';
  config.unleashClientKey = process.env.UNLEASH_CLIENT_KEY?.trim() || '';
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const configPath = resolve(scriptDirectory, '..', '..', appPath, 'public', 'assets', 'config.json');
await writeFile(configPath, JSON.stringify(config, null, 2) + String.fromCharCode(10), 'utf8');
process.stdout.write(
  'Runtime config listo para ' + appName + ': ' + configPath + String.fromCharCode(10),
);
