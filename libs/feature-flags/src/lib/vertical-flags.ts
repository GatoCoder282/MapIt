import type { FeatureFlagKey } from './feature-flag.catalog';

/**
 * Flag de Unleash que habilita cada vertical (HU-7.01/7.02, spec D3).
 *
 * Restaurante y Discoteca son el producto base y no llevan flag. Es la misma tabla que
 * `VerticalCatalog` en el backend, que es quien decide: en el navegador solo sirve para no
 * ofrecer una vertical que el backend rechazaría con `403 vertical-disabled`.
 */
export const VERTICAL_FLAGS: Readonly<Record<string, FeatureFlagKey | undefined>> = {
  HOTEL: 'vertical.hotel',
  EVENT_HALL: 'vertical.event-hall',
};
