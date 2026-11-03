import { createLocalizedCatalog, type LocalizedShape } from '@mapit/i18n';

import { AUTH_STRINGS_EN } from './auth-strings.en';
import { AUTH_STRINGS_JA } from './auth-strings.ja';

const AUTH_STRINGS_ES = {
  storageWarning:
    'La sesión se mantendrá solo en esta página porque el navegador no permite guardarla.',
  sessionInvalid: 'Respuesta de autenticación inválida.',
} as const;

const AUTH_CATALOGS = {
  es: AUTH_STRINGS_ES,
  en: AUTH_STRINGS_EN,
  'ja-JP': AUTH_STRINGS_JA,
} satisfies Record<'es' | 'en' | 'ja-JP', LocalizedShape<typeof AUTH_STRINGS_ES>>;

export const AUTH_STRINGS = createLocalizedCatalog<typeof AUTH_STRINGS_ES>(AUTH_CATALOGS, 'es');
