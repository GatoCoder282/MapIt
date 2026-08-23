import { type Routes } from '@angular/router';

/**
 * Rutas públicas. Las features llegan con sus casos de uso:
 *   availability      CU-15  consultar disponibilidad
 *   booking           CU-16  crear reserva
 *   payment           CU-17  pagar anticipo por QR
 *   my-reservations   CU-18  historial
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/landing/landing').then((m) => m.Landing),
  },
];
