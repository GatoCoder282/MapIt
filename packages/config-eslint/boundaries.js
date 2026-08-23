// @ts-check
import tseslint from 'typescript-eslint';

/**
 * Fronteras de arquitectura del frontend.
 *
 * Es el equivalente en TypeScript de lo que en el backend hacen los módulos Gradle
 * y ArchUnit: reglas que la herramienta aplica, en vez de depender de que 5 personas
 * recuerden la convención.
 *
 * IMPORTANTE: **todas** las restricciones de import viven en este único bloque.
 * `no-restricted-imports` no se fusiona entre configs: la última definición
 * REEMPLAZA a las anteriores. Si se reparten entre archivos, unas anulan a otras
 * en silencio — que es justo el fallo que estas reglas pretenden evitar.
 */
export default tseslint.config({
  files: ['**/*.ts'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            // Style guide: "Prefer `class` and `style` bindings over using the
            // `NgClass` and `NgStyle` directives" — más legibles y más rápidas.
            name: '@angular/common',
            importNames: ['NgClass', 'NgStyle'],
            message:
              'Usa bindings: [class.activo]="cond" o [style.width.px]="ancho". ' +
              'NgClass y NgStyle son más lentas y menos legibles (style guide oficial).',
          },
          {
            name: '@angular/common',
            importNames: ['NgIf', 'NgFor', 'NgForOf', 'NgSwitch'],
            message:
              'Usa el control flow nuevo: @if, @for, @switch. No hay que importarlo y es más rápido.',
          },
          {
            name: '@angular/core',
            importNames: ['provideZoneChangeDetection'],
            message:
              'MapIt es zoneless (default en Angular 21+). No reintroduzcas Zone.js: ' +
              'usa signals para que la vista reaccione a los cambios.',
          },
        ],
        patterns: [
          {
            group: ['zone.js', 'zone.js/*'],
            message: 'MapIt es zoneless. Zone.js no debe importarse.',
          },
          {
            // El motor de mapa se usa por su puerto, no por su implementación.
            // Es lo que permite cambiar Konva por otra solución (ADR-0006).
            group: ['konva', 'konva/*'],
            message:
              'No importes Konva directamente: usa MapEnginePort de @mapit/map-engine. ' +
              'El motor de mapa aún no está decidido y debe poder cambiarse.',
          },
          {
            // Una feature no importa de otra feature.
            // Se cubren las dos formas de escribirlo: por alias/ruta absoluta, y
            // relativa saliendo de la feature actual hacia las carpetas de otra.
            group: [
              '**/features/*/**',
              '../*/ui/**',
              '../*/model/**',
              '../*/data/**',
              '../../*/ui/**',
              '../../*/model/**',
              '../../*/data/**',
            ],
            message:
              'Una feature no puede importar de otra feature. ' +
              'Si el código es compartido, muévelo a libs/ o a core/.',
          },
          {
            // Las apps son despliegues independientes.
            group: ['**/apps/**'],
            message:
              'Las apps son independientes (console y public-web se despliegan por separado). ' +
              'Lo compartido va en libs/.',
          },
        ],
      },
    ],
  },
});
