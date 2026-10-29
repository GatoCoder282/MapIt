import { currentLanguageCode } from './language';

export type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { readonly [K in keyof T]?: DeepPartial<T[K]> }
    : T;

/** Locale catalog shape with string leaves widened for translated values. */
export type LocalizedShape<T> = T extends string
  ? string
  : T extends readonly unknown[]
    ? { readonly [K in keyof T]: LocalizedShape<T[K]> }
    : T extends object
      ? { readonly [K in keyof T]: LocalizedShape<T[K]> }
      : T;

type CatalogMap = Readonly<Record<string, object>>;

function atPath(source: unknown, path: readonly PropertyKey[]): unknown {
  let value = source;
  for (const key of path) {
    if (value === null || typeof value !== 'object' || !(key in value)) return undefined;
    value = Reflect.get(value, key);
  }
  return value;
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Creates a typed, reactive view over locale catalogs. Missing or `undefined`
 * values resolve from the designated fallback catalog.
 */
export function createLocalizedCatalog<T extends object>(
  catalogs: CatalogMap,
  fallbackLanguage: string,
): T {
  if (!catalogs[fallbackLanguage]) {
    throw new Error(`No existe el catálogo de fallback «${fallbackLanguage}».`);
  }

  const resolve = (path: readonly PropertyKey[]): unknown => {
    const active = atPath(catalogs[currentLanguageCode()], path);
    return active ?? atPath(catalogs[fallbackLanguage], path);
  };

  const viewAt = (path: readonly PropertyKey[]): object =>
    new Proxy(Object.create(null) as object, {
      get(_target, property) {
        if (property === Symbol.toStringTag) return 'LocalizedCatalog';
        const next = [...path, property];
        const value = resolve(next);
        return isRecord(value) ? viewAt(next) : value;
      },
      ownKeys() {
        const selected = atPath(catalogs[currentLanguageCode()], path);
        const fallback = atPath(catalogs[fallbackLanguage], path);
        return [
          ...new Set([
            ...Object.keys(isRecord(fallback) ? fallback : {}),
            ...Object.keys(isRecord(selected) ? selected : {}),
          ]),
        ];
      },
      getOwnPropertyDescriptor(_target, property) {
        const value = resolve([...path, property]);
        return value === undefined
          ? undefined
          : { configurable: true, enumerable: true, value, writable: false };
      },
      has(_target, property) {
        return resolve([...path, property]) !== undefined;
      },
    });

  return viewAt([]) as T;
}

/**
 * Resolves a stored canonical message into the active locale. This lets
 * transient errors survive a language change without keeping a stale string.
 */
export function createLocalizedTextResolver(
  catalogs: CatalogMap,
  fallbackLanguage: string,
): (canonicalText: string) => string {
  const fallbackCatalog = catalogs[fallbackLanguage];
  if (!fallbackCatalog) {
    throw new Error(`No existe el catálogo de fallback «${fallbackLanguage}».`);
  }

  const translations = new Map<string, Map<string, string>>();
  for (const [language, catalog] of Object.entries(catalogs)) {
    const localized = new Map<string, string>();
    const visit = (fallback: unknown, path: readonly PropertyKey[]): void => {
      if (typeof fallback === 'string') {
        const resolved = atPath(catalog, path);
        const target = typeof resolved === 'string' ? resolved : fallback;
        for (const source of Object.values(catalogs)) {
          const sourceText = atPath(source, path);
          if (typeof sourceText === 'string' && !localized.has(sourceText)) {
            localized.set(sourceText, target);
          }
        }
      } else if (Array.isArray(fallback)) {
        fallback.forEach((value, index) => visit(value, [...path, String(index)]));
      } else if (isRecord(fallback)) {
        for (const [key, value] of Object.entries(fallback)) visit(value, [...path, key]);
      }
    };
    visit(fallbackCatalog, []);
    translations.set(language, localized);
  }

  return (canonicalText: string): string =>
    translations.get(currentLanguageCode())?.get(canonicalText) ?? canonicalText;
}
