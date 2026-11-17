import { authGuard, roleGuard } from '@mapit/auth';
import { type Routes } from '@angular/router';

import { STRINGS } from './core/strings';
import { operationalExitGuard } from './core/operational-exit-guard';

/**
 * Rutas de la consola de staff.
 *
 * Organización feature-first (recomendación explícita del style guide oficial:
 * agrupar por feature, no por tipo de archivo). Cada feature se carga perezosamente
 * para que el editor de mapas —que es el bundle pesado— no penalice al resto.
 *
 * Estructura:
 *   /login                                pública
 *   /admin/**                            SUPER_ADMIN (plataforma): auditoría CU-01/CU-03
 *   /administration/*                    sección operativa de staff (futuros CU)
 *   /home, /demo-items, /establishments (redirect) staff autenticado de cualquier rol
 *
 * El guard de rol es UX: la autorización real la aplica el backend (403).
 */
export const routes: Routes = [
  {
    path: 'login',
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
        loadComponent: () => import('./features/home/ui/home').then((m) => m.Home),
      },
      {
        // Secciones del roadmap sin caso de uso todavía: placeholder honesto
        // hasta que exista la feature real (mismo patrón que /admin/settings).
        path: 'users',
        data: { title: STRINGS.staffShell.nav.users },
        loadComponent: () => import('./layout/admin-placeholder').then((m) => m.AdminPlaceholder),
      },
      {
        path: 'reports',
        data: { title: STRINGS.staffShell.nav.reports },
        loadComponent: () => import('./layout/admin-placeholder').then((m) => m.AdminPlaceholder),
      },
      {
        // Acceso Negocios: reabre el selector global sobre Inicio.
        path: 'establishments',
        pathMatch: 'full',
        redirectTo: '/home?selectEstablishment=1',
      },
      {
        // CU-05 (MAP-67/MAP-68) + HU-2.03: asistente de configuración del espacio.
        // El contexto global fija el establecimiento; las URLs de recursos
        // se validan contra él y nunca cambian la selección operativa.
        path: 'spaces',
        children: [
          {
            path: 'setup',
            canDeactivate: [operationalExitGuard],
            loadComponent: () =>
              import('./features/spaces/ui/wizard-establishment').then(
                (m) => m.WizardEstablishmentComponent,
              ),
          },
          {
            path: 'floors',
            pathMatch: 'full',
            redirectTo: 'setup',
          },
          {
            path: 'floors/:establishmentId',
            canDeactivate: [operationalExitGuard],
            loadComponent: () =>
              import('./features/spaces/ui/spaces').then((m) => m.SpacesComponent),
          },
          {
            path: 'floors/:floorId/sectors',
            canDeactivate: [operationalExitGuard],
            loadComponent: () =>
              import('./features/spaces/ui/sector-page').then((m) => m.SectorPageComponent),
          },
          {
            path: 'summary/:establishmentId',
            loadComponent: () =>
              import('./features/spaces/ui/wizard-summary').then((m) => m.WizardSummaryComponent),
          },
          {
            // Plantillas de elementos HU-4.02 (MAP-191).
            path: 'templates',
            loadComponent: () =>
              import('./features/spaces/ui/element-template-list-page').then(
                (m) => m.ElementTemplateListPageComponent,
              ),
          },
          {
            // CU-06 (MAP-196): editor visual de elementos espaciales (Konva.js).
            path: 'editor/:sectorId',
            canDeactivate: [operationalExitGuard],
            loadComponent: () =>
              import('./features/map-editor/ui/map-editor-page').then(
                (m) => m.MapEditorPageComponent,
              ),
          },
          {
            // HU-4.01: vista de planta — composición de sectores sobre el lienzo.
            path: 'floors/:floorId/editor',
            canDeactivate: [operationalExitGuard],
            loadComponent: () =>
              import('./features/map-editor/ui/floor-editor-page').then(
                (m) => m.FloorEditorPageComponent,
              ),
          },
        ],
      },
      {
        path: 'reservations/new',
        canDeactivate: [operationalExitGuard],
        loadComponent: () =>
          import('./features/reservations/ui/reservation-form').then((m) => m.ReservationForm),
      },
      {
        path: 'payment-methods',
        pathMatch: 'full',
        redirectTo: 'administration/settings/payment-methods',
      },
      {
        path: 'administration/settings/payment-methods',
        canDeactivate: [operationalExitGuard],
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () =>
          import('./features/payments/ui/payment-methods').then((m) => m.PaymentMethods),
      },
      {
        path: 'check-in',
        canDeactivate: [operationalExitGuard],
        canActivate: [roleGuard('ADMIN', 'STAFF')],
        loadComponent: () => import('./features/check-in/ui/check-in').then((m) => m.CheckIn),
      },
      {
        path: 'audit',
        canActivate: [roleGuard('ADMIN')],
        loadComponent: () => import('./features/audit/ui/audit-page').then((m) => m.AuditPage),
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
