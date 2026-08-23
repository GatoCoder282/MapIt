#!/usr/bin/env node
/**
 * Envoltorio del wrapper de Gradle.
 * Elige gradlew.bat o ./gradlew según el SO, para que nadie lo escriba a mano.
 */
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { ROOT, IS_WINDOWS, run, capture, die, loadEnv } from './_lib.mjs';

loadEnv();

const BACKEND = join(ROOT, 'apps', 'backend');
const wrapper = join(BACKEND, IS_WINDOWS ? 'gradlew.bat' : 'gradlew');

if (!existsSync(wrapper)) {
  die(
    'No se encontró el wrapper de Gradle en apps/backend',
    '  El backend aún no está inicializado, o el clone quedó incompleto.\n  Verifica que exista apps/backend/gradlew',
  );
}

if (!capture('java', ['-version']).ok) {
  die(
    'Java no está instalado — Gradle no puede correr',
    IS_WINDOWS
      ? '  winget install EclipseAdoptium.Temurin.25.JDK\n  (cierra y reabre la terminal)\n  Guía: https://adoptium.net/installation/'
      : '  macOS:  brew install --cask temurin@25\n  Linux:  https://adoptium.net/installation/',
  );
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Uso: node tools/scripts/gradle.mjs <tarea> [...]');
  process.exit(1);
}

process.exit(run(wrapper, args, { cwd: BACKEND, allowFailure: true }));
