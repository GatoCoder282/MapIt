#!/usr/bin/env node
/**
 * Carga en Unleash las flags definidas en `infra/docker/unleash/flags.json`.
 *
 * Sin esto, cada integrante tendría que crearlas a mano en la UI y acabaríamos
 * con cinco entornos distintos. Es idempotente: se puede correr las veces que haga falta.
 *
 * Lo ejecuta `pnpm setup` automáticamente.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, c, log, loadEnv, sleep } from './_lib.mjs';

loadEnv();

const UNLEASH = (process.env['UNLEASH_URL'] ?? 'http://localhost:4242/api').replace(/\/api\/?$/, '');
const TOKEN = process.env['UNLEASH_ADMIN_TOKEN'] ?? '*:*.unleash-insecure-admin-token';
const ENTORNO = process.env['UNLEASH_ENVIRONMENT'] ?? 'development';
const PROYECTO = 'default';

const flags = JSON.parse(
  readFileSync(join(ROOT, 'infra', 'docker', 'unleash', 'flags.json'), 'utf8'),
).features;

async function api(ruta, opciones = {}) {
  return fetch(`${UNLEASH}${ruta}`, {
    ...opciones,
    headers: {
      Authorization: TOKEN,
      'Content-Type': 'application/json',
      ...(opciones.headers ?? {}),
    },
  });
}

async function esperarAUnleash() {
  for (let intento = 0; intento < 40; intento++) {
    try {
      const r = await fetch(`${UNLEASH}/health`);
      if (r.ok) return true;
    } catch {
      /* aún no responde */
    }
    await sleep(2000);
  }
  return false;
}

log.step('Cargando feature flags en Unleash');

if (!(await esperarAUnleash())) {
  log.warn('Unleash no respondió; las flags usarán sus valores por defecto del catálogo.');
  log.info(`Puedes cargarlas luego con:  pnpm db:seed:flags`);
  process.exit(0);
}

let creadas = 0;
let existentes = 0;

for (const flag of flags) {
  // 1. Crear la definición de la flag (idempotente: 409 si ya existe).
  const crear = await api(`/api/admin/projects/${PROYECTO}/features`, {
    method: 'POST',
    body: JSON.stringify({
      name: flag.name,
      type: flag.type,
      description: flag.description,
      impressionData: flag.impressionData ?? false,
    }),
  });

  if (crear.status === 201) creadas++;
  else if (crear.status === 409) existentes++;
  else {
    log.warn(`no se pudo crear "${flag.name}" (HTTP ${crear.status})`);
    continue;
  }

  // 2. Una flag SIN estrategia evalúa siempre false, aunque esté "activada".
  //    Es el error clásico al automatizar Unleash: la flag aparece encendida en
  //    la UI pero el cliente nunca la recibe.
  await api(
    `/api/admin/projects/${PROYECTO}/features/${flag.name}/environments/${ENTORNO}/strategies`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: 'flexibleRollout',
        parameters: { rollout: '100', stickiness: 'default', groupId: flag.name },
      }),
    },
  );

  // 3. Encender o apagar según el bootstrap.
  await api(
    `/api/admin/projects/${PROYECTO}/features/${flag.name}/environments/${ENTORNO}/${
      flag.enabled ? 'on' : 'off'
    }`,
    { method: 'POST' },
  );
}

log.ok(`${creadas} flag(s) creadas, ${existentes} ya existían`);
console.log(
  `  ${c.gray('UI de Unleash:')} ${c.cyan(`http://localhost:${process.env['UNLEASH_PORT'] ?? 4242}`)}` +
    ` ${c.gray(`(${process.env['UNLEASH_ADMIN_USER'] ?? 'admin'} / ${process.env['UNLEASH_ADMIN_PASSWORD'] ?? 'unleash4all'})`)}\n`,
);
