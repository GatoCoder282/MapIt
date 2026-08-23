// @ts-check
import base from '@mapit/config-eslint';
import angular from '@mapit/config-eslint/angular';
import boundaries from '@mapit/config-eslint/boundaries';
import tseslint from 'typescript-eslint';

/**
 * Configuración ÚNICA de lint del monorepo.
 *
 * Dos cosas que cuestan un rato descubrir y conviene no volver a tropezar:
 *
 * 1. En flat config (ESLint 9) NO se combinan los `eslint.config.js` de las
 *    subcarpetas como hacía `.eslintrc`: solo se usa el de la raíz. Tener configs
 *    por app daría una falsa sensación de seguridad, porque se ignorarían en
 *    silencio. Por eso todo vive aquí.
 *
 * 2. Los configs importados se expanden con `...`, NO se meten dentro de un bloque
 *    con `files`. Al usar `extends:` dentro de un objeto con `files`, esos `files`
 *    externos sustituyen a los internos, y el parser de plantillas de Angular
 *    acabaría aplicándose a archivos .ts. Cada config ya trae su propio alcance.
 */
export default tseslint.config(
  ...base,
  ...angular,
  ...boundaries,

  // ── Prefijos de selector por app ────────────────────────────
  {
    files: ['apps/console/**/*.ts'],
    rules: {
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'mapit', style: 'kebab-case' },
      ],
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'mapit', style: 'camelCase' },
      ],
    },
  },
  {
    files: ['apps/public-web/**/*.ts'],
    rules: {
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'mp', style: 'kebab-case' },
      ],
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'mp', style: 'camelCase' },
      ],
    },
  },

  // ── Librerías compartidas ───────────────────────────────────
  {
    files: ['libs/**/*.ts'],
    rules: {
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'mapit', style: 'kebab-case' },
      ],
      // La directiva `*featureFlag` se usa sin prefijo a propósito: es parte del
      // vocabulario del proyecto y `*mapitFeatureFlag` sería ruido en cada plantilla.
      '@angular-eslint/directive-selector': 'off',
    },
  },

  // ── Tooling: Node puro ──────────────────────────────────────
  {
    files: ['tools/**/*.mjs', '*.config.js', '*.config.mjs'],
    rules: { 'no-console': 'off' },
  },

  // ── Tests E2E ───────────────────────────────────────────────
  {
    files: ['apps/e2e/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
);
