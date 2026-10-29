export { LanguageSelector } from './lib/language-selector';
export { LocalizedDatePipe, type LocalizedDatePreset } from './lib/localized-date.pipe';
export { LocalizedNumberPipe } from './lib/localized-number.pipe';
export { I18N_STRINGS } from './lib/i18n-strings';
export {
  DEFAULT_I18N_CONFIGURATION,
  I18N_CONFIGURATION,
  LANGUAGE_STORAGE_KEY,
  MAPIT_LANGUAGES,
  I18nService,
  currentLanguageCode,
  currentLocaleTag,
  provideI18n,
  type I18nConfiguration,
  type LanguageOption,
} from './lib/language';
export {
  createLocalizedCatalog,
  createLocalizedTextResolver,
  type DeepPartial,
  type LocalizedShape,
} from './lib/localized-catalog';
