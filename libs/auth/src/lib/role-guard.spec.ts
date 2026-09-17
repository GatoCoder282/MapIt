import { TestBed } from '@angular/core/testing';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { signal } from '@angular/core';

import { AuthSession, type SessionUser } from './auth-session';
import { roleGuard } from './role-guard';

function userWithRole(role: SessionUser['role']): SessionUser {
  return {
    id: '00000000-0000-0000-0000-0000000000aa',
    tenantId: 'demo',
    email: 'tester@example.test',
    fullName: 'Tester',
    role,
  };
}

describe('roleGuard', () => {
  function run(allowed: SessionUser['role'][], user: SessionUser | null) {
    const session = {
      user: signal(user).asReadonly(),
      loginUrl: () => '/login',
    } as unknown as AuthSession;
    TestBed.configureTestingModule({
      providers: [{ provide: AuthSession, useValue: session }],
    });
    return TestBed.runInInjectionContext(() =>
      roleGuard(...allowed)({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  }

  it('permite al rol listado', () => {
    expect(run(['SUPER_ADMIN'], userWithRole('SUPER_ADMIN'))).toBe(true);
  });

  it('redirige a /home a un rol autenticado no autorizado', () => {
    expect(run(['SUPER_ADMIN'], userWithRole('STAFF'))).not.toBe(true);
  });

  it('redirige al login si no hay sesión', () => {
    expect(run(['SUPER_ADMIN'], null)).not.toBe(true);
  });

  it('acepta varios roles permitidos', () => {
    expect(run(['ADMIN', 'MANAGER'], userWithRole('MANAGER'))).toBe(true);
  });
});
