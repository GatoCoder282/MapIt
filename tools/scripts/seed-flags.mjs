#!/usr/bin/env node
/**
 * Carga en Unleash las flags definidas en `infra/docker/unleash/flags.json`.
 *
 * Solo configura las flags nuevas. Las existentes conservan su estado y estrategias.
 *
 * Lo ejecuta `pnpm setup` automáticamente.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, die, log, loadEnv, sleep } from './_lib.mjs';

loadEnv();

const UNLEASH = (process.env['UNLEASH_URL'] ?? 'http://localhost:4242/api').replace(
  /\/api\/?$/,
  '',
);
const TOKEN = process.env['UNLEASH_ADMIN_TOKEN'] ?? '*:*.unleash-insecure-admin-token';
const ENTORNO = process.env['UNLEASH_ENVIRONMENT'] ?? 'development';
const FEATURES = '/api/admin/projects/default/features';

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
  die('Unleash no respondió.', 'Levanta Unleash y vuelve a ejecutar pnpm db:seed:flags.');
}

let creadas = 0;
let existentes = 0;
let fallidas = 0;

const actuales = await api(FEATURES);
if (!actuales.ok) {
  die(
    `No se pudo leer el proyecto default (HTTP ${actuales.status}).`,
    'Revisa el token de Unleash.',
  );
}
const { features } = await actuales.json();
const nombresExistentes = new Set(features.map(({ name }) => name));

for (const flag of flags) {
  if (nombresExistentes.has(flag.name)) {
    existentes++;
    continue;
  }
  const crear = await api(FEATURES, {
    method: 'POST',
    body: JSON.stringify({
      name: flag.name,
      type: flag.type,
      description: flag.description,
      impressionData: flag.impressionData ?? false,
    }),
  });

  if (crear.status !== 201) {
    fallidas++;
    log.fail(`No se pudo crear "${flag.name}" (HTTP ${crear.status}).`);
    continue;
  }
  creadas++;

  // Al encender una flag nueva, Unleash aplica la estrategia predeterminada del entorno.
  if (flag.enabled) {
    const activar = await api(
      `${FEATURES}/${flag.name}/environments/${encodeURIComponent(ENTORNO)}/on`,
      {
        method: 'POST',
      },
    );
    if (!activar.ok) {
      fallidas++;
      log.fail(
        `"${flag.name}" se creó, pero no se pudo activar en ${ENTORNO} (HTTP ${activar.status}). Actívala desde Unleash.`,
      );
    }
  }
}

log.info(`${creadas} flag(s) creadas, ${existentes} existentes sin cambios.`);
if (fallidas) {
  die(
    `Falló la carga de ${fallidas} flag(s).`,
    'Revisa el entorno y el token definidos para Unleash.',
  );
}
