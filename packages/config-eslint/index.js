// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Base para todo el TypeScript del monorepo.
 * Las apps Angular añaden `./angular` y `./boundaries` encima (ver eslint.config.js raíz).
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/.angular/**',
      '**/coverage/**',
      '**/node_modules/**',
      // Código generado desde el contrato OpenAPI: no se lintea, se regenera.
      '**/generated/**',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
  },

  // ── TypeScript ────────────────────────────────────────────────
  // IMPORTANTE: estas reglas van SIEMPRE limitadas a `**/*.ts`.
  // Sin el `files`, se aplicarían también a las plantillas .html —incluidas las
  // inline que extrae `processInlineTemplates`— y ESLint revienta, porque esas
  // las analiza el parser de Angular y no expone un AST de TypeScript.
  {
    files: ['**/*.ts'],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      // projectService descubre el tsconfig.json más cercano a cada archivo.
      // Por eso cada app y cada lib tiene el suyo.
      parserOptions: { projectService: true },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // ── JavaScript (archivos de configuración, scripts) ───────────
  // Son JS puro y no pertenecen a ningún tsconfig: sin análisis de tipos.
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    extends: [eslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },
);
