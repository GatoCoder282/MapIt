import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationCancel, NavigationEnd, provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthSession, authGuard } from '@mapit/auth';
import { filter, firstValueFrom } from 'rxjs';
import { confirmOperationalExit, operationalExitGuard } from './operational-exit-guard';
import { routes } from '../app.routes';

@Component({ template: '' })
class Login {}

@Component({ template: '' })
class Editor {
  canDeactivate(): boolean {
    return false;
  }
}

describe('operational exit protection', () => {
  afterEach(() => vi.restoreAllMocks());

  it('permite salir con formulario limpio sin preguntar', () => {
    const confirm = vi.spyOn(globalThis, 'confirm');
    expect(confirmOperationalExit(false, false)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('mantiene borrador y ruta si se rechaza descartarlo', () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
    expect(confirmOperationalExit(false, true)).toBe(false);
  });

  it('permite descartar un borrador tras confirmación', () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    expect(confirmOperationalExit(false, true)).toBe(true);
  });

  it('bloquea toda salida durante una escritura sin ofrecer descarte', () => {
    const confirm = vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    expect(confirmOperationalExit(true, false)).toBe(false);
    expect(confirmOperationalExit(true, true)).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('redirige al login si vence la sesión con el editor bloqueando la salida', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'login', component: Login },
          {
            path: 'spaces/editor/:sectorId',
            component: Editor,
            canActivate: [authGuard],
            canDeactivate: [operationalExitGuard],
          },
        ]),
      ],
    });
    const session = TestBed.inject(AuthSession);
    const router = TestBed.inject(Router);
    const expiresAt = Date.now() + 60_000;
    session.start(
      {
        accessToken: 'header.payload.signature',
        tokenType: 'Bearer',
        expiresAt: new Date(expiresAt).toISOString(),
        user: {
          id: '00000000-0000-0000-0000-000000000001',
          tenantId: 'demo',
          email: 'admin@example.com',
          fullName: 'Admin',
          role: 'ADMIN',
        },
      },
      false,
    );

    try {
      await RouterTestingHarness.create('/spaces/editor/sector-1?floorId=floor-1');
      expect(await router.navigateByUrl('/login')).toBe(false);

      const redirect = firstValueFrom(
        router.events.pipe(
          filter((event) => event instanceof NavigationEnd || event instanceof NavigationCancel),
        ),
      );
      vi.setSystemTime(expiresAt);
      expect(session.token()).toBeNull();
      expect(await redirect).toBeInstanceOf(NavigationEnd);
      expect(router.url).toBe('/login');
    } finally {
      vi.useRealTimers();
    }
  });

  it('protege rutas operativas sin imponer establecimiento a plataforma', () => {
    const staff = routes.find((entry) => entry.path === '' && entry.children);
    for (const path of ['map', 'check-in', 'administration/settings/payment-methods']) {
      expect(staff?.children?.find((entry) => entry.path === path)?.canDeactivate).toContain(
        operationalExitGuard,
      );
    }
    const platform = routes.find((entry) => entry.path === 'admin');
    expect(platform?.canDeactivate).toBeUndefined();
    expect(
      platform?.children
        ?.filter((entry) => entry.path !== 'profile')
        .every((entry) => !entry.canDeactivate),
    ).toBe(true);
    // El formulario personal protege borradores/escrituras sin exigir un establecimiento.
    expect(platform?.children?.find((entry) => entry.path === 'profile')?.canDeactivate).toContain(
      operationalExitGuard,
    );
  });
});
