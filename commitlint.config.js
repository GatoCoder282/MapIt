/**
 * Conventional Commits. El hook rechaza un mensaje mal formado AL HACER EL COMMIT,
 * no en el PR, que es cuando ya molesta.
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        // Módulos del backend
        'platform',
        'identity',
        'spaces',
        'operations',
        'reservations',
        'payments',
        // Frontend
        'console',
        'public-web',
        'ui-kit',
        'api-client',
        'auth',
        'feature-flags',
        'realtime',
        'map-engine',
        // Transversal
        'contract',
        'infra',
        'db',
        'ci',
        'docs',
        'specs',
        'deps',
        'tooling',
      ],
    ],
    'subject-case': [0], // los mensajes van en español; no forzamos capitalización
    'header-max-length': [2, 'always', 100],
  },
};
