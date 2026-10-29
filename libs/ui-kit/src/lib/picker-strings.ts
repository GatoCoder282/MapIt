import { createLocalizedCatalog, type LocalizedShape } from '@mapit/i18n';
import { PICKER_STRINGS_EN } from './picker-strings.en';
import { PICKER_STRINGS_JA } from './picker-strings.ja';

/** Cadenas del selector de zona horaria compartido. */
const PICKER_STRINGS_ES = {
  timezonePlaceholder: 'Buscar zona horaria…',
  timezoneNoResults: 'Sin coincidencias',
  timezoneAria: 'Zona horaria con buscador',
} as const;

const PICKER_CATALOGS = {
  es: PICKER_STRINGS_ES,
  en: PICKER_STRINGS_EN,
  'ja-JP': PICKER_STRINGS_JA,
} satisfies Record<'es' | 'en' | 'ja-JP', LocalizedShape<typeof PICKER_STRINGS_ES>>;

export const PICKER_STRINGS = createLocalizedCatalog<typeof PICKER_STRINGS_ES>(
  PICKER_CATALOGS,
  'es',
);

export type PickerStrings = typeof PICKER_STRINGS_ES;
