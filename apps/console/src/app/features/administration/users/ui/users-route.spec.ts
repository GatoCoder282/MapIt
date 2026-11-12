import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, type CanActivateFn, type Route } from '@angular/router';
import { signal } from '@angular/core';
import { AuthSession, type SessionUser } from '@mapit/auth';

import { routes } from '../../../../app.routes';

const user: SessionUser = {
  id: 'id',
  tenantId: 'tenant',
  email: 'a@example.org',
  fullName: 'Ana',
  role: 'ADMIN',
};

describe('ruta /users', () => {
  const session = { user: signal<SessionUser | null>(user), loginUrl: () => '/login' };
  const route = routes
    .find((item) => item.path === '' && item.children)
    ?.children?.find((item) => item.path === 'users') as Route;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), { provide: AuthSession, useValue: session }],
    });
  });

  it('permite ADMIN y redirige MANAGER/STAFF y sesiones caducadas', () => {
    const guard = route.canActivate?.[0] as CanActivateFn;
    const check = () => TestBed.runInInjectionContext(() => guard({} as never, {} as never));
    session.user.set(user);
    expect(check()).toBe(true);
    for (const role of ['MANAGER', 'STAFF'] as const) {
      session.user.set({ ...user, role });
      expect(TestBed.inject(Router).serializeUrl(check() as never)).toBe('/home');
    }
    session.user.set(null);
    expect(TestBed.inject(Router).serializeUrl(check() as never)).toBe('/login');
  });
});
