#!/usr/bin/env node
/**
 * Crea una feature Angular con la estructura ui/ model/ data/ (MVVM).
 *
 * PENDIENTE DE IMPLEMENTAR — se completa cuando el caso de uso lo necesite.
 * Está declarado en package.json para que el comando exista desde el día 1
 * y falle con un mensaje claro en vez de con "script not found".
 */
import { log, c } from './_lib.mjs';

log.warn('Este comando todavía no está implementado.');
console.log(`
  Crea una feature Angular con la estructura ui/ model/ data/ (MVVM).

  ${c.gray('Se implementará en la fase correspondiente del roadmap.')}
  ${c.gray('Si lo necesitas ahora, este archivo es el sitio: tools/scripts/new-feature.mjs')}
`);
process.exit(0);
