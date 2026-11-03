import { createLocalizedCatalog, type LocalizedShape } from '@mapit/i18n';
import { SITE_STRINGS_EN } from './site-strings.en';
import { SITE_STRINGS_JA } from './site-strings.ja';

/** Strings compartidos del chrome de navegación y pie del sitio público. */
const SITE_STRINGS_ES = {
  brand: 'MapIt',
  brandHomeAria: 'MapIt — página de inicio',
  nav: {
    aria: 'Navegación principal',
    product: 'Producto',
    howItWorks: 'Cómo funciona',
    businesses: 'Negocios',
    bookings: 'Reservas',
    openMenu: 'Abrir menú de navegación',
    closeMenu: 'Cerrar menú de navegación',
    mobileAria: 'Navegación mobile',
  },
  footer: {
    navAria: 'Navegación del pie de página',
    socialAria: 'Redes sociales',
    copyright: '© 2026 MapIt. Todos los derechos reservados.',
  },
} as const;

const SITE_CATALOGS = {
  es: SITE_STRINGS_ES,
  en: SITE_STRINGS_EN,
  'ja-JP': SITE_STRINGS_JA,
} satisfies Record<'es' | 'en' | 'ja-JP', LocalizedShape<typeof SITE_STRINGS_ES>>;

export const SITE_STRINGS = createLocalizedCatalog<typeof SITE_STRINGS_ES>(SITE_CATALOGS, 'es');

export type SiteStrings = typeof SITE_STRINGS_ES;
