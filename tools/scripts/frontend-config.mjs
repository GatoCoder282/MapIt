import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './_lib.mjs';

// Ejecutar después de ng build. Solo publica configuración pública, nunca secretos.
const app = process.argv[2];
if (!['console', 'public-web'].includes(app)) {
  throw new Error('Uso: node tools/scripts/frontend-config.mjs console|public-web');
}

function publicUrl(name, protocols = ['https:']) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta ${name} en las variables del build`);
  const url = new URL(value);
  if (!protocols.includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} debe ser una URL pública sin credenciales, query ni fragmento`);
  }
  return url.href.replace(/\/$/, '');
}

const config = {
  apiBaseUrl: publicUrl('API_BASE_URL'),
  environment: 'production',
  logLevel: 'INFO',
  unleashProxyUrl: '',
  unleashClientKey: '',
};
if (app === 'console') {
  config.wsUrl = publicUrl('WS_URL', ['wss:']);
} else {
  config.consoleBaseUrl = publicUrl('CONSOLE_BASE_URL');
}

const output = join(ROOT, 'dist', app, 'browser');
if (!existsSync(join(output, 'index.html'))) {
  throw new Error(`No existe el build de ${app}; ejecuta ng build primero`);
}
mkdirSync(join(output, 'assets'), { recursive: true });
writeFileSync(join(output, 'assets', 'config.json'), JSON.stringify(config, null, 2) + '\n');
// public-web conserva una ruta antigua de configuración; publicar los mismos valores.
if (app === 'public-web') {
  writeFileSync(join(output, 'config.json'), JSON.stringify(config, null, 2) + '\n');
}
console.log(`Configuración pública de producción generada para ${app}`);
