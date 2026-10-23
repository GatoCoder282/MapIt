import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { InjectionToken, inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthSession } from './auth-session';

export const AUTH_API_URL = new InjectionToken<() => string>('AUTH_API_URL');

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const apiUrl = inject(AUTH_API_URL)();
  let target: URL;
  let base: URL;
  try {
    target = new URL(request.url, globalThis.location.origin);
    base = new URL(apiUrl, globalThis.location.origin);
  } catch {
    return next(request);
  }
  const prefix = base.pathname.replace(/\/+$/, '');
  if (
    !['http:', 'https:'].includes(base.protocol) ||
    target.origin !== base.origin ||
    !(target.pathname === prefix || target.pathname.startsWith(`${prefix}/`)) ||
    target.pathname.replace(/\/+$/, '') === `${prefix}/auth/login`
  ) {
    return next(request);
  }
  const session = inject(AuthSession);
  const token = session.token();
  if (!token) return next(request);
  return next(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) session.clearIfCurrent(token);
      return throwError(() => error);
    }),
  );
};
