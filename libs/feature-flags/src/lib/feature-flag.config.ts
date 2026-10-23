import { InjectionToken, type EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';

export interface FeatureFlagConfig {
  /** URL del unleash-proxy. NUNCA la del servidor de Unleash. */
  readonly proxyUrl: string;
  /** Clave pública del proxy. Es visible en el navegador por diseño. */
  readonly clientKey: string;
  /** Cada cuánto se vuelven a pedir las flags, en milisegundos. */
  readonly intervaloRefrescoMs: number;
}

export const FEATURE_FLAG_CONFIG = new InjectionToken<FeatureFlagConfig>('mapit.feature-flags');

const POR_DEFECTO: FeatureFlagConfig = {
  proxyUrl: 'http://localhost:3063/proxy',
  clientKey: 'dev-proxy-key-change-me',
  intervaloRefrescoMs: 15_000,
};

/**
 * Registra los feature toggles en la aplicación.
 *
 * En despliegue, los valores llegan de `/assets/config.json` (config de runtime),
 * no de un `environment.ts` incrustado en el bundle.
 */
export function provideFeatureFlags(
  config: Partial<FeatureFlagConfig> | (() => Partial<FeatureFlagConfig>) = {},
): EnvironmentProviders {
  const resolver = typeof config === 'function' ? config : () => config;
  // useFactory (no useValue): la config de runtime llega vía APP_INITIALIZER y solo
  // está disponible cuando el primer inyector resuelve el token, no al registrarse.
  return makeEnvironmentProviders([
    {
      provide: FEATURE_FLAG_CONFIG,
      useFactory: () => ({ ...POR_DEFECTO, ...resolver() }),
    },
  ]);
}
