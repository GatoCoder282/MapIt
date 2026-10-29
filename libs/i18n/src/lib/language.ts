import {
  InjectionToken,
  Injectable,
  computed,
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
  signal,
  type EnvironmentProviders,
} from '@angular/core';

export interface LanguageOption {
  readonly code: string;
  readonly locale: string;
  readonly nativeName: string;
}

export interface I18nConfiguration {
  readonly languages: readonly LanguageOption[];
  readonly defaultLanguage: string;
}

export const LANGUAGE_STORAGE_KEY = 'mapit.interface-language';

export const MAPIT_LANGUAGES = [
  { code: 'es', locale: 'es-BO', nativeName: 'Espa\u00f1ol' },
  { code: 'en', locale: 'en-US', nativeName: 'English' },
  { code: 'ja-JP', locale: 'ja-JP', nativeName: '\u65e5\u672c\u8a9e' },
] as const satisfies readonly LanguageOption[];

export const DEFAULT_I18N_CONFIGURATION: I18nConfiguration = {
  languages: MAPIT_LANGUAGES,
  defaultLanguage: 'es',
};

export const I18N_CONFIGURATION = new InjectionToken<I18nConfiguration>(
  'MAPIT_I18N_CONFIGURATION',
  {
    providedIn: 'root',
    factory: () => DEFAULT_I18N_CONFIGURATION,
  },
);

const activeLanguageState = signal(DEFAULT_I18N_CONFIGURATION.defaultLanguage);
const activeLocaleState = signal(
  DEFAULT_I18N_CONFIGURATION.languages[0]?.locale ?? DEFAULT_I18N_CONFIGURATION.defaultLanguage,
);

/** Read the active value while keeping Angular templates/computeds reactive. */
export function currentLanguageCode(): string {
  return activeLanguageState();
}

/** Read the active BCP 47 locale while keeping Angular templates/computeds reactive. */
export function currentLocaleTag(): string {
  return activeLocaleState();
}

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly configuration = inject(I18N_CONFIGURATION);

  readonly languages = this.configuration.languages;
  readonly language = activeLanguageState.asReadonly();
  readonly locale = activeLocaleState.asReadonly();

  readonly selectedLanguage = computed(
    () =>
      this.configuration.languages.find((option) => option.code === this.language()) ??
      this.defaultOption(),
  );

  initialize(): void {
    const stored = this.readStoredLanguage();
    const initial = this.isSupported(stored) ? stored : this.configuration.defaultLanguage;
    this.applyLanguage(initial, false);
  }

  setLanguage(code: string): boolean {
    return this.applyLanguage(code, true);
  }

  private applyLanguage(code: string, persist: boolean): boolean {
    const option = this.configuration.languages.find((candidate) => candidate.code === code);
    if (!option) return false;

    activeLanguageState.set(option.code);
    activeLocaleState.set(option.locale);
    if (typeof document !== 'undefined') document.documentElement.lang = option.code;

    if (persist) {
      try {
        globalThis.localStorage?.setItem(LANGUAGE_STORAGE_KEY, option.code);
      } catch {
        // The current page still uses the chosen language; the preference is session-only.
      }
    }
    return true;
  }

  private readStoredLanguage(): string | null {
    try {
      return globalThis.localStorage?.getItem(LANGUAGE_STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }

  private isSupported(code: string | null): code is string {
    return code !== null && this.configuration.languages.some((option) => option.code === code);
  }

  private defaultOption(): LanguageOption {
    return (
      this.configuration.languages.find(
        (option) => option.code === this.configuration.defaultLanguage,
      ) ??
      this.configuration.languages[0] ?? {
        code: 'es',
        locale: 'es-BO',
        nativeName: 'Espa\u00f1ol',
      }
    );
  }
}

export function provideI18n(
  configuration: I18nConfiguration = DEFAULT_I18N_CONFIGURATION,
): EnvironmentProviders {
  if (!configuration.languages.some((option) => option.code === configuration.defaultLanguage)) {
    throw new Error('El idioma predeterminado debe pertenecer al cat\u00e1logo admitido.');
  }

  return makeEnvironmentProviders([
    { provide: I18N_CONFIGURATION, useValue: configuration },
    provideAppInitializer(() => inject(I18nService).initialize()),
  ]);
}
