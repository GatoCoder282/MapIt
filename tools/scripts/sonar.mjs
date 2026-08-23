#!/usr/bin/env node
/**
 * Lanza el análisis de SonarQube (solo en la máquina de calidad).
 *
 * PENDIENTE DE IMPLEMENTAR — se completa cuando el caso de uso lo necesite.
 * Está declarado en package.json para que el comando exista desde el día 1
 * y falle con un mensaje claro en vez de con "script not found".
 */
import { log, c } from './_lib.mjs';

log.warn('Este comando todavía no está implementado.');
console.log(`
  Lanza el análisis de SonarQube (solo en la máquina de calidad).

  ${c.gray('Se implementará en la fase correspondiente del roadmap.')}
  ${c.gray('Si lo necesitas ahora, este archivo es el sitio: tools/scripts/sonar.mjs')}
`);
process.exit(0);
