import { HttpErrorResponse, HttpResponse, type HttpInterceptorFn } from '@angular/common/http';
import { InjectionToken, inject } from '@angular/core';
import { defer, tap } from 'rxjs';
import { UUID, type LogOperation } from './catalog';
import { Logger } from './logger';

/** Getter evaluated per request after runtime config, never an injected HttpClient dependency. */
export const LOGGING_API_URL = new InjectionToken<() => string>('mapit.logging.api-url');

export const loggingInterceptor: HttpInterceptorFn = (request, next) => {
  const logger = inject(Logger);
  const apiUrl = inject(LOGGING_API_URL);
  const operation = apiOperation(request.url, apiUrl());
  if (operation === null) return next(request);
  return defer(() => {
    const requestId = newRequestId();
    const start = performance.now();
    const correlated = request.clone({ setHeaders: { 'X-Request-ID': requestId } });
    return next(correlated).pipe(
      tap({
        next: (response) => {
          if (!(response instanceof HttpResponse)) return;
          const returnedId = response.headers.get('X-Request-ID');
          logger.log('INFO', 'http.request.completed', {
            request_id: returnedId && UUID.test(returnedId) ? returnedId : requestId,
            method: request.method,
            operation,
            status: response.status,
            duration_ms: performance.now() - start,
          });
        },
        error: (error: unknown) => {
          const response = error instanceof HttpErrorResponse ? error : null;
          const returnedId = response?.headers.get('X-Request-ID');
          const status = response?.status ?? 0;
          const level =
            status === 0 || status >= 500
              ? 'ERROR'
              : status === 401 || status === 403
                ? 'WARN'
                : 'DEBUG';
          logger.report(level, 'http.request.failed', error, {
            request_id: returnedId && UUID.test(returnedId) ? returnedId : requestId,
            method: request.method,
            operation,
            status,
            duration_ms: performance.now() - start,
          });
        },
      }),
    );
  });
};

/** getRandomValues also works on a local network served over HTTP (tablet deployments). */
function newRequestId(): string {
  if (typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function apiOperation(url: string, base: string): LogOperation | null {
  try {
    const target = new URL(url, globalThis.location.origin);
    const api = new URL(base, globalThis.location.origin);
    const prefix = api.pathname.replace(/\/$/, '');
    if (
      !['http:', 'https:'].includes(target.protocol) ||
      target.origin !== api.origin ||
      !(target.pathname === prefix || target.pathname.startsWith(`${prefix}/`))
    )
      return null;
    const root = target.pathname.slice(prefix.length).split('/')[1];
    switch (root) {
      case 'auth':
      case 'tenants':
      case 'establishments':
      case 'spaces':
      case 'demo':
        return root;
      default:
        return 'api.other';
    }
  } catch {
    return null;
  }
}
