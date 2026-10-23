/**
 * Textos visibles de los componentes de chrome compartidos (nav + footer del
 * sitio público). Viven en la lib porque `ui-kit` no importa de las apps.
 */
export const SITE_STRINGS = {
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

export type SiteStrings = typeof SITE_STRINGS;
