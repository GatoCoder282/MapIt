import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appName = process.argv[2];
const appPaths = {
  console: 'apps/console',
  'public-web': 'apps/public-web',
};

if (!Object.hasOwn(appPaths, appName)) {
  throw new Error('Uso: node tools/scripts/configure-vercel.mjs <console|public-web>');
}

const apiBaseUrl = process.env.MAPIT_API_BASE_URL?.trim().replace(/\\/+$/, '');
if (!apiBaseUrl) {
  throw new Error('Define MAPIT_API_BASE_URL en las variables de entorno de Vercel.');
}

const apiUrl = new URL(apiBaseUrl);
if (apiUrl.protocol !== 'https:' || !apiUrl.pathname.replace(/\\/+$/, '').endsWith('/api/v1')) {
  throw new Error('MAPIT_API_BASE_URL debe ser HTTPS y terminar en /api/v1.');
}

const config = {
  apiBaseUrl,
  environment: 'production',
  logLevel: 'INFO',
};

if (appName === 'console') {
  const wsUrl =
    process.env.MAPIT_WS_URL?.trim() ||
    apiBaseUrl.replace(/^https:/, 'wss:').replace(/\\/api\\/v1$/, '/ws');
  if (new URL(wsUrl).protocol !== 'wss:') {
    throw new Error('MAPIT_WS_URL debe usar WSS en producción.');
  }

  config.wsUrl = wsUrl;
  config.unleashProxyUrl = process.env.UNLEASH_PROXY_URL?.trim() || '';
  config.unleashClientKey = process.env.UNLEASH_CLIENT_KEY?.trim() || '';
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const configPath = resolve(scriptDirectory, '..', '..', appPaths[appName], 'public', 'assets', 'config.json');
await writeFile(configPath, `${JSON.stringify(config, null, 2)}\\n`, 'utf8');
process.stdout.write(`Runtime config listo para ${appName}: ${configPath}\\n`);
