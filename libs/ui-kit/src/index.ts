/**
 * Design system de MapIt.
 *
 * Regla: ui-kit es PURAMENTE presentacional. No conoce el cliente de API ni el
 * dominio: recibe datos por inputs y emite eventos por outputs. Hay una regla
 * de lint que lo impide importar `@mapit/api-client`.
 *
 * Los componentes se añaden conforme las features los necesiten, no antes.
 */
export const UI_KIT_VERSION = '0.1.0';

export { SiteNav } from './lib/site-nav/site-nav';
export { SiteFooter } from './lib/site-footer/site-footer';
export { RevealOnScroll } from './lib/reveal-on-scroll/reveal-on-scroll';
export { SITE_STRINGS } from './lib/site-strings';
