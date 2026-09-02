import { type Routes } from '@angular/router';

/**
 * Rutas de la consola de staff.
 *
 * Organización feature-first (recomendación explícita del style guide oficial:
 * agrupar por feature, no por tipo de archivo). Cada feature se carga perezosamente
 * para que el editor de mapas —que es el bundle pesado— no penalice al resto.
 *
 * Las features llegan en sus casos de uso:
 *   map-editor      CU-06..CU-08   (Integrante C)
 *   operations      CU-09, CU-10   (Integrante D)
 *   reservations    CU-11..CU-14   (Integrante D)
 *   administration  CU-01..CU-05   (Integrante A/E)
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'home',
  },
  {
    path: 'demo-items',
    loadComponent: () => import('./features/demo-items/ui/demo-items').then((m) => m.DemoItems),
  },
  {
    path: 'home',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
  },
];
