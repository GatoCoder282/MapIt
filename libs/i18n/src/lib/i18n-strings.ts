import { createLocalizedCatalog, type LocalizedShape } from './localized-catalog';

const STRINGS_ES = { selectorLabel: 'Idioma' } as const;
const STRINGS_EN = { selectorLabel: 'Language' } as const;
const STRINGS_JA = { selectorLabel: '\u8a00\u8a9e' } as const;

const I18N_CATALOGS = {
  es: STRINGS_ES,
  en: STRINGS_EN,
  'ja-JP': STRINGS_JA,
} satisfies Record<'es' | 'en' | 'ja-JP', LocalizedShape<typeof STRINGS_ES>>;

export const I18N_STRINGS = createLocalizedCatalog<typeof STRINGS_ES>(I18N_CATALOGS, 'es');
