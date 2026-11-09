import { inject } from '@angular/core';
import { Router, type Routes } from '@angular/router';

/**
 * Rutas públicas. Las features llegan con sus casos de uso:
 *   availability      CU-15  consultar disponibilidad
 *   booking           CU-16  crear reserva
 *   payment           CU-17  pagar anticipo por QR
 *   my-reservations   CU-18  historial
 */
export const routes: Routes = [
  {
    path: 'pago/:tenantSlug/:establishmentSlug/:reservationId',
    loadComponent: () => import('./features/payment/ui/payment-page').then((m) => m.PaymentPage),
  },
  {
    path: 'simulacion/qr/:token',
    loadComponent: () =>
      import('./features/payment/ui/simulation-page').then((m) => m.SimulationPage),
  },
  {
    path: 'comprobante/:token',
    loadComponent: () => import('./features/payment/ui/receipt-page').then((m) => m.ReceiptPage),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'acerca-de-mapit',
  },
  {
    path: 'negocios',
    title: 'MapIt — Negocios',
    loadComponent: () => import('./features/negocios/negocios').then((m) => m.Negocios),
  },
  {
    path: 'acerca-de-mapit',
    title: 'MapIt — Acerca de MapIt',
    loadComponent: () => import('./features/about/about').then((m) => m.About),
  },
  {
    path: 'como-funciona',
    title: 'MapIt — Cómo funciona',
    loadComponent: () => import('./features/how-it-works/how-it-works').then((m) => m.HowItWorks),
  },
  {
    path: 'reservas',
    loadComponent: () => import('./features/reservas/reservas').then((m) => m.Reservas),
  },
  {
    path: 'disponibilidad/:tenantSlug/:establishmentSlug',
    data: { selectionStep: false },
    loadComponent: () =>
      import('./features/availability/ui/availability-page').then((m) => m.AvailabilityPage),
  },
  {
    path: 'elegir-espacio/:tenantSlug/:establishmentSlug',
    data: { selectionStep: true },
    loadComponent: () =>
      import('./features/availability/ui/availability-page').then((m) => m.AvailabilityPage),
  },
  {
    path: 'reservar/:tenantSlug/:establishmentSlug/:elementId',
    canActivate: [
      (route) => {
        const reservationId = route.queryParamMap.get('reservationId');
        return reservationId
          ? inject(Router).createUrlTree(
              [
                '/pago',
                route.paramMap.get('tenantSlug'),
                route.paramMap.get('establishmentSlug'),
                reservationId,
              ],
              { fragment: route.fragment ?? '' },
            )
          : true;
      },
    ],
    loadComponent: () => import('./features/booking/ui/booking-page').then((m) => m.BookingPage),
  },
  {
    path: 'mis-reservas/:tenantSlug',
    loadComponent: () =>
      import('./features/my-reservations/ui/my-reservations-page').then(
        (m) => m.MyReservationsPage,
      ),
  },
  {
    // CU-25: el primer ADMIN abre el enlace del correo y define su contraseña.
    // Es pública: aún no existe sesión; el token del enlace es la credencial.
    path: 'activar',
    loadComponent: () => import('./features/activation/ui/activation').then((m) => m.Activation),
  },
];
