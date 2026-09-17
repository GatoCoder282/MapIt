import { authGuard, roleGuard } from '@mapit/auth';
import { type Routes } from '@angular/router';

import { STRINGS } from './core/strings';

/**
 * Rutas de la consola de staff.
 *
 * Organización feature-first (recomendación explícita del style guide oficial:
 * agrupar por feature, no por tipo de archivo). Cada feature se carga perezosamente
 * para que el editor de mapas —que es el bundle pesado— no penalice al resto.
 *
 * Estructura:
 *   /login, /empresa/:tenantSlug/login   públicas
 *   /admin/**                            SUPER_ADMIN (plataforma): auditoría CU-01/CU-03
 *   /administration/*                    sección operativa de staff (futuros CU)
 *   /home, /demo-items, /establishments  staff autenticado de cualquier rol
 *
 * El guard de rol es UX: la autorización real la aplica el backend (403).
 */
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login/ui/login').then((m) => m.Login),
  },
  {
    path: 'empresa/:tenantSlug/login',
    loadComponent: () => import('./features/login/ui/login').then((m) => m.Login),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login',
  },
  {
    // Shell de plataforma: exclusivo del SUPER_ADMIN (CU-01/CU-03).
    path: 'admin',
    canActivate: [roleGuard('SUPER_ADMIN')],
    loadComponent: () => import('./layout/admin-shell').then((m) => m.AdminShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/administration/dashboard/ui/dashboard').then((m) => m.AdminDashboard),
      },
      {
        path: 'tenants',
        loadComponent: () =>
          import('./features/administration/tenants/ui/tenant-list').then((m) => m.TenantList),
      },
      {
        path: 'tenants/new',
        loadComponent: () =>
          import('./features/administration/tenant-registration/ui/tenant-registration').then(
            (m) => m.TenantRegistration,
          ),
      },
      {
        path: 'tenants/:tenantId',
        loadComponent: () =>
          import('./features/administration/tenants/ui/tenant-detail').then((m) => m.TenantDetail),
      },
      {
        path: 'settings',
        data: { title: STRINGS.shell.nav.settings },
        loadComponent: () => import('./layout/admin-placeholder').then((m) => m.AdminPlaceholder),
      },
      {
        path: 'profile',
        data: { title: STRINGS.shell.nav.profile },
        loadComponent: () => import('./layout/admin-placeholder').then((m) => m.AdminPlaceholder),
      },
    ],
  },
  {
    // Shell de staff: topbar + sidebar para las secciones operativas del tenant
    // (Inicio, Establecimientos, Pisos/sectores, Demo). Todo bajo authGuard.
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/staff-shell').then((m) => m.StaffShell),
    children: [
      {
        path: 'home',
        loadComponent: () => import('./features/home/home').then((m) => m.Home),
      },
      {
        // Establecimientos (CU-04): staff de un tenant (ADMIN+, con contexto tenant).
        path: 'establishments',
        loadComponent: () =>
          import('./features/administration/establishments/ui/establishments').then(
            (m) => m.Establishments,
          ),
      },
      {
        // CU-05 (MAP-67/MAP-68): configuración de pisos y sectores (HU-2.02).
        path: 'spaces/floors',
        loadComponent: () => import('./features/spaces/ui/spaces').then((m) => m.SpacesComponent),
      },
      {
        path: 'spaces/floors/:floorId/sectors',
        loadComponent: () =>
          import('./features/spaces/ui/sector-page').then((m) => m.SectorPageComponent),
      },
      {
        path: 'demo-items',
        loadComponent: () => import('./features/demo-items/ui/demo-items').then((m) => m.DemoItems),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
  },
];
