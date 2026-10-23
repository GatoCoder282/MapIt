import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthSession, type SessionUser } from './auth-session';

/**
 * Guard de autorización por rol (CU-24). Requiere sesión (como `authGuard`) y
 * además que el rol del usuario esté en la lista permitida.
 *
 * Uso: `canActivate: [roleGuard('SUPER_ADMIN')]`.
 *
 * Aviso de seguridad: este guard es solo UX. La autorización real vive en el
 * backend (403). Un JWT con rol manipulado pierde contra el servidor igual.
 */
export function roleGuard(...allowed: SessionUser['role'][]): CanActivateFn {
  return () => {
    const session = inject(AuthSession);
    const router = inject(Router);
    const user = session.user();
    if (!user) {
      return router.parseUrl(session.loginUrl());
    }
    return allowed.includes(user.role) ? true : router.parseUrl('/home');
  };
}
