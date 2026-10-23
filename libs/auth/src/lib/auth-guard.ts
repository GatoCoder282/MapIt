import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthSession } from './auth-session';

export const authGuard: CanActivateFn = () => {
  const session = inject(AuthSession);
  return session.token() ? true : inject(Router).parseUrl(session.loginUrl());
};
