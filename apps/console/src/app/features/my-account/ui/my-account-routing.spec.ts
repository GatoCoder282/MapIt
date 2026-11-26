import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, type Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthSession, type SessionUser } from '@mapit/auth';
import { provideFeatureFlags } from '@mapit/feature-flags';
import { of } from 'rxjs';
import { routes } from '../../../app.routes';
import { MyAccountApi } from '../data/my-account-api';
import { EstablishmentContext } from '../../../core/establishment-context';
import { MyAccountAccess } from '../../../core/my-account-access';

@Component({ template: '' })
class Destination {}

describe('rutas reales de Mi cuenta', () => {
  async function setup(options?: {
    enabled?: boolean;
    ready?: boolean;
    authenticated?: boolean;
    role?: SessionUser['role'];
  }) {
    const enabled = signal(options?.enabled ?? false);
    const ready = signal(options?.ready ?? true);
    const authenticated = options?.authenticated ?? true;
    const role = options?.role ?? 'STAFF';
    const user = signal(
      authenticated
        ? {
            id: 'self',
            tenantId: 'tenant-a',
            fullName: 'Nombre de sesión',
            email: 'self@example.com',
            role,
          }
        : null,
    );
    const staff = routes.find((route) => route.path === '' && route.children)!;
    const admin = routes.find((route) => route.path === 'admin')!;
    const testRoutes: Routes = [
      { path: 'login', component: Destination },
      {
        ...admin,
        children: [
          admin.children!.find((route) => route.path === 'profile')!,
          { path: 'dashboard', component: Destination },
        ],
      },
      {
        ...staff,
        children: [
          staff.children!.find((route) => route.path === 'my-account')!,
          { path: 'home', component: Destination },
        ],
      },
    ];
    const read = vi.fn(() =>
      of({
        fullName: 'Nombre real',
        email: 'self@example.com',
        contactPhone: null,
        preferredLanguage: null,
      }),
    );
    TestBed.configureTestingModule({
      providers: [
        provideRouter(testRoutes),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideFeatureFlags({ proxyUrl: '' }),
        {
          provide: AuthSession,
          useValue: {
            user,
            revision: signal(1),
            token: () => (authenticated ? 'validated-by-backend' : null),
            loginUrl: () => '/login',
            logout: vi.fn(),
            warning: signal(''),
            updateFullName: vi.fn(() => true),
          },
        },
        {
          provide: MyAccountAccess,
          useValue: {
            enabled,
            scope: computed(() => (user() ? 'scope' : null)),
            state: computed(() => ({ ready: ready(), enabled: enabled() })),
          },
        },
        { provide: MyAccountApi, useValue: { read, update: vi.fn() } },
        {
          provide: EstablishmentContext,
          useValue: {
            active: signal(null),
            establishments: signal([]),
            status: signal(role === 'ADMIN' ? 'ready' : 'idle'),
            load: vi.fn(),
          },
        },
      ],
    });
    const harness = await RouterTestingHarness.create();
    return { harness, router: TestBed.inject(Router), enabled, ready, read };
  }

  it.each(['/my-account', '/admin/profile'])(
    'rechaza acceso directo a %s sin autenticación aunque la flag esté ON',
    async (url) => {
      const { harness, router, read } = await setup({ enabled: true, authenticated: false });
      await harness.navigateByUrl(url);
      expect(router.url).toBe('/login');
      expect(read).not.toHaveBeenCalled();
    },
  );

  it('rol staff no puede usar /admin/profile aunque la flag esté ON', async () => {
    const { harness, router, read } = await setup({ enabled: true });
    await harness.navigateByUrl('/admin/profile');
    expect(router.url).toBe('/home');
    expect(read).not.toHaveBeenCalled();
  });

  it('rechaza acceso directo con OFF sin cargar perfil', async () => {
    const { harness, router, read } = await setup();
    await harness.navigateByUrl('/my-account');
    expect(router.url).toBe('/home');
    expect(read).not.toHaveBeenCalled();
    expect(harness.routeNativeElement?.querySelector('a[href="/my-account"]')).toBeNull();
  });

  it('espera la evaluación inicial y permite ON por URL sin establecimiento', async () => {
    const { harness, router, ready, enabled, read } = await setup({ ready: false });
    const navigation = harness.navigateByUrl('/my-account');
    await vi.waitFor(() => expect(router.getCurrentNavigation()).not.toBeNull());
    expect(read).not.toHaveBeenCalled();
    enabled.set(true);
    ready.set(true);
    await navigation;
    expect(router.url).toBe('/my-account');
    expect(read).toHaveBeenCalledOnce();
    expect(
      harness.routeNativeElement?.querySelector<HTMLInputElement>('#account-name')?.value,
    ).toBe('Nombre real');
    expect(harness.routeNativeElement?.querySelector('mapit-establishment-selector')).toBeNull();
  });

  it('ADMIN sin ningún negocio puede consultar su cuenta sin redirección al alta', async () => {
    const { harness, router } = await setup({ enabled: true, role: 'ADMIN' });
    await harness.navigateByUrl('/my-account');
    expect(router.url).toBe('/my-account');
    expect(harness.routeNativeElement?.querySelector('#account-email')).not.toBeNull();
    expect(harness.routeNativeElement?.querySelector('mapit-establishment-selector')).toBeNull();
  });

  it('SUPER_ADMIN reutiliza la misma pantalla en su shell y OFF cierra acceso directo', async () => {
    const { harness, router, enabled, read } = await setup({ enabled: true, role: 'SUPER_ADMIN' });
    await harness.navigateByUrl('/admin/profile');
    expect(router.url).toBe('/admin/profile');
    expect(harness.routeNativeElement?.querySelector('mapit-my-account')).not.toBeNull();
    expect(read).toHaveBeenCalledOnce();
    enabled.set(false);
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('a[href="/admin/profile"]')).toBeNull();
    expect(harness.routeNativeElement?.querySelector('#account-email')).toBeNull();
    await harness.navigateByUrl('/admin/dashboard');
    await harness.navigateByUrl('/admin/profile');
    expect(router.url).toBe('/admin/dashboard');
    expect(read).toHaveBeenCalledOnce();
  });
});
