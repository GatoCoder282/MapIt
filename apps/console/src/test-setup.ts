/**
 * Arranque del entorno de tests (Vitest, el runner por defecto de Angular 22).
 *
 * Deliberadamente NO se importa `zone.js` ni el `setup-zone` de @analogjs:
 * MapIt es zoneless (default desde Angular 21), y el builder `@angular/build:unit-test`
 * inicializa el TestBed por su cuenta.
 *
 * Aquí van los mocks globales y la configuración común de los tests cuando hagan falta.
 */

/**
 * `ResizeObserver` no existe en jsdom y `ngx-echarts` lo exige para observar
 * el tamaño del lienzo (si no, lanza al inicializar). Stub mínimo: no hace
 * falta que redimensione nada en un test.
 */
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = ResizeObserverStub;
}

export {};
