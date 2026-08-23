#!/usr/bin/env node
/**
 * Envoltorio de docker compose. Elige los archivos y perfiles correctos
 * para que nadie tenga que recordar la combinación de flags.
 */
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { ROOT, run, capture, log, die, c, loadEnv } from './_lib.mjs';

loadEnv();

const DOCKER_DIR = join(ROOT, 'infra', 'docker');
const BASE = join(DOCKER_DIR, 'compose.yml');
const TOOLS = join(DOCKER_DIR, 'compose.tools.yml');
const FULL = join(DOCKER_DIR, 'compose.full.yml');
const ENV_FILE = join(ROOT, '.env');

function guard() {
  if (!capture('docker', ['info']).ok) {
    die(
      'Docker no responde',
      '  Abre Docker Desktop y espera a que diga "Running".\n  Luego reintenta.',
    );
  }
  if (!existsSync(ENV_FILE)) {
    die('Falta el archivo .env', '  pnpm setup');
  }
}

/** Construye los args base de compose (archivos + env-file). */
function dc(files, args) {
  const fileArgs = files.flatMap((f) => ['-f', f]);
  return ['compose', '--env-file', ENV_FILE, ...fileArgs, ...args];
}

const action = process.argv[2] ?? 'up';
const rest = process.argv.slice(3);

guard();

switch (action) {
  case 'up':
    log.step('Levantando infraestructura (postgres, unleash, mailpit)');
    run('docker', dc([BASE], ['up', '-d', '--remove-orphans', ...rest]));
    break;

  case 'down':
    log.step('Deteniendo todos los servicios');
    run('docker', dc([BASE, TOOLS, FULL], ['down', '--remove-orphans', ...rest]), {
      allowFailure: true,
    });
    log.ok('detenido (los datos se conservan; usa `pnpm infra:reset` para borrarlos)');
    break;

  case 'reset': {
    log.step('RESET: borra los volúmenes y recrea la base de datos desde cero');
    log.warn('Esto elimina TODOS los datos locales (BD y flags de Unleash).');
    run('docker', dc([BASE, TOOLS, FULL], ['down', '-v', '--remove-orphans']), {
      allowFailure: true,
    });
    run('docker', dc([BASE], ['up', '-d', '--remove-orphans']));
    log.ok('infraestructura recreada. Ahora:  pnpm db:migrate && pnpm db:seed');
    break;
  }

  case 'logs':
    run('docker', dc([BASE, TOOLS, FULL], ['logs', '-f', '--tail', '80', ...rest]));
    break;

  case 'ps':
    run('docker', dc([BASE, TOOLS, FULL], ['ps', ...rest]));
    break;

  case 'tools':
    log.step('Levantando herramientas opcionales (sonarqube, pgadmin, prism)');
    log.info('SonarQube tarda ~2 min en arrancar y pide >= 8GB de RAM en Docker.');
    run('docker', dc([BASE, TOOLS], ['--profile', 'tools', 'up', '-d', ...rest]));
    break;

  case 'mock':
    log.step('Levantando el mock del contrato OpenAPI (Prism)');
    run('docker', dc([BASE, TOOLS], ['--profile', 'tools', 'up', '-d', 'prism']));
    log.ok(`mock disponible en http://localhost:${process.env.PRISM_PORT ?? 4010}`);
    break;

  case 'full':
    log.step('Levantando el sistema COMPLETO contenerizado (ensayo de despliegue)');
    run('docker', dc([BASE, FULL], ['up', '-d', '--build', ...rest]));
    break;

  default:
    console.log(`
${c.bold('Uso:')} pnpm infra:<acción>

  ${c.cyan('up')}      levanta postgres + unleash + mailpit
  ${c.cyan('down')}    detiene todo (conserva los datos)
  ${c.cyan('reset')}   ${c.yellow('borra los volúmenes')} y recrea desde cero
  ${c.cyan('logs')}    sigue los logs
  ${c.cyan('ps')}      estado de los contenedores
  ${c.cyan('tools')}   + sonarqube, pgadmin, prism
  ${c.cyan('full')}    todo contenerizado, incluidos backend y fronts
`);
    process.exit(1);
}
