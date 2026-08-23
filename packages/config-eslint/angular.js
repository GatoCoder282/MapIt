// @ts-check
import angular from 'angular-eslint';
import tseslint from 'typescript-eslint';

/**
 * Codifica el style guide OFICIAL de Angular (angular.dev/style-guide) como reglas
 * de lint, para que el equipo de 5 no tenga que recordarlas.
 *
 * Cada bloque cita la recomendación que implementa.
 */
export default tseslint.config(
  {
    files: ['**/*.ts'],
    extends: [...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      // Style guide: los archivos NO llevan sufijo de tipo.
      // `user-profile.ts`, no `user-profile.component.ts`.
      '@angular-eslint/component-class-suffix': 'off',
      '@angular-eslint/directive-class-suffix': 'off',

      // Style guide: "Prefer using the `inject` function over injecting
      // constructor parameters."
      '@angular-eslint/prefer-inject': 'error',

      // v21+: los componentes son standalone por defecto; declararlo es ruido.
      '@angular-eslint/prefer-standalone': 'error',

      // Los selectores llevan prefijo por app, definido en cada eslint.config.js.
      '@angular-eslint/use-lifecycle-interface': 'error',
      '@angular-eslint/no-empty-lifecycle-method': 'error',

      // Signals: `computed()` en vez de getters que recalculan en cada CD.
      '@angular-eslint/prefer-signals': 'warn',

      // NOTA: las restricciones de import (Zone.js, NgClass, Konva, fronteras entre
      // features) viven TODAS en `./boundaries.js`. `no-restricted-imports` no se
      // fusiona entre configs —la última definición reemplaza a las anteriores—,
      // así que repartirlas haría que unas anularan a otras en silencio.
    },
  },
  {
    files: ['**/*.html'],
    // Las reglas de typescript-eslint que necesitan tipos NO pueden correr sobre
    // plantillas (las analiza el parser de Angular, no el de TS). Sin esto,
    // `processInlineTemplates` las arrastra a los templates inline y ESLint revienta.
    extends: [
      tseslint.configs.disableTypeChecked,
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility,
    ],
    rules: {
      // Style guide: el control flow nuevo (@if/@for/@switch) sustituye a las
      // directivas estructurales. Son más rápidas y no hay que importarlas.
      '@angular-eslint/template/prefer-control-flow': 'error',

      // Nota: angular-eslint no trae reglas `no-ngclass` / `no-ngstyle`.
      // La recomendación del style guide ("prefer class and style bindings over
      // NgClass and NgStyle") se aplica prohibiendo su IMPORTACIÓN más abajo,
      // que es equivalente y además detecta el import muerto.
      '@angular-eslint/template/prefer-self-closing-tags': 'warn',
      '@angular-eslint/template/prefer-ngsrc': 'warn',

      // `no-call-expression` está DESACTIVADA a propósito: es anterior a los signals.
      // Leer un signal en la plantilla se hace llamándolo —`flags.isEnabled('x')()`—
      // y es el patrón idiomático de Angular 22, no un problema de rendimiento
      // (un signal cachea su valor; un método normal se reevaluaba en cada ciclo).
      // La regla del style guide, "nada de lógica compleja en la plantilla", se
      // cumple usando `computed()` en el ViewModel, no prohibiendo las llamadas.
      '@angular-eslint/template/no-call-expression': 'off',

      // RNF07: la app se usa en tablet, la accesibilidad no es opcional.
      '@angular-eslint/template/click-events-have-key-events': 'error',
      '@angular-eslint/template/interactive-supports-focus': 'error',
    },
  },
);
