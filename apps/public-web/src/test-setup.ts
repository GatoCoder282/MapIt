/**
 * Arranque del entorno de tests (Vitest, el runner por defecto de Angular 22).
 *
 * Deliberadamente NO se importa `zone.js` ni el `setup-zone` de @analogjs:
 * MapIt es zoneless (default desde Angular 21), y el builder `@angular/build:unit-test`
 * inicializa el TestBed por su cuenta.
 *
 * Aquí van los mocks globales y la configuración común de los tests cuando hagan falta.
 */
export {};
