import { routes } from './app.routes';
// eslint-disable-next-line no-restricted-imports -- El test de rutas comprueba el componente cargado.
import { Negocios } from './features/negocios/negocios';
// eslint-disable-next-line no-restricted-imports -- El test de rutas comprueba el componente cargado.
import { Reservas } from './features/reservas/reservas';
// eslint-disable-next-line no-restricted-imports -- El test de rutas comprueba el componente cargado.
import { PaymentPage } from './features/payment/ui/payment-page';
// eslint-disable-next-line no-restricted-imports -- El test de rutas comprueba el componente cargado.
import { Activation } from './features/activation/ui/activation';
// eslint-disable-next-line no-restricted-imports -- Comprueba el componente cargado por la ruta pública.
import { HowItWorks } from './features/how-it-works/how-it-works';
// eslint-disable-next-line no-restricted-imports -- Comprueba el componente de la ruta pública.
import { About } from './features/about/about';

describe('rutas públicas', () => {
  it('abre Acerca de MapIt desde / y conserva las otras páginas públicas', async () => {
    const home = routes.find(
      (candidate) => candidate.path === '' && candidate.pathMatch === 'full',
    );
    const businesses = routes.find((candidate) => candidate.path === 'negocios');

    expect(home?.redirectTo).toBe('acerca-de-mapit');
    expect(await businesses?.loadComponent?.()).toBe(Negocios);
    expect(
      await routes.find((candidate) => candidate.path === 'acerca-de-mapit')?.loadComponent?.(),
    ).toBe(About);
    expect(
      await routes.find((candidate) => candidate.path === 'como-funciona')?.loadComponent?.(),
    ).toBe(HowItWorks);
  });

  it('preserva las rutas públicas de reservas, pago y activación', async () => {
    expect(await routes.find((candidate) => candidate.path === 'reservas')?.loadComponent?.()).toBe(
      Reservas,
    );
    expect(
      await routes
        .find(
          (candidate) => candidate.path === 'pago/:tenantSlug/:establishmentSlug/:reservationId',
        )
        ?.loadComponent?.(),
    ).toBe(PaymentPage);
    expect(await routes.find((candidate) => candidate.path === 'activar')?.loadComponent?.()).toBe(
      Activation,
    );
  });
});
