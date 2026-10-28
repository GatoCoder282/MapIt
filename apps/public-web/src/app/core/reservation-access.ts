import { Injectable } from '@angular/core';

export interface ReservationAccessScope {
  readonly tenantSlug: string;
  readonly establishmentSlug: string;
  readonly reservationId: string;
}
interface StoredAccess {
  readonly token: string;
  readonly expiresAt: string | null;
}
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** Credencial pública limitada a una reserva; nunca utiliza el JWT de personal. */
@Injectable({ providedIn: 'root' })
export class ReservationAccess {
  private readonly memory = new Map<string, StoredAccess>();

  save(scope: ReservationAccessScope, token: string, expiresAt: string | null): boolean {
    if (
      !TOKEN.test(token) ||
      (expiresAt !== null &&
        (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now()))
    )
      return false;
    const record = { token, expiresAt };
    const key = this.key(scope);
    this.memory.set(key, record);
    try {
      sessionStorage.setItem(key, JSON.stringify(record));
    } catch {
      /* Sigue disponible en esta pestaña. */
    }
    return true;
  }

  capture(scope: ReservationAccessScope, fragment: string): boolean {
    const values = new URLSearchParams(fragment.replace(/^#/, ''));
    const token = values.get('access');
    if (!token || [...values.keys()].length !== 1) return false;
    return this.save(scope, token, null);
  }

  read(scope: ReservationAccessScope): string | null {
    const key = this.key(scope);
    let record = this.memory.get(key);
    if (!record) {
      try {
        const raw = sessionStorage.getItem(key);
        const candidate: unknown = raw ? JSON.parse(raw) : null;
        if (
          candidate &&
          typeof candidate === 'object' &&
          'token' in candidate &&
          typeof candidate.token === 'string' &&
          'expiresAt' in candidate &&
          (candidate.expiresAt === null || typeof candidate.expiresAt === 'string')
        ) {
          record = { token: candidate.token, expiresAt: candidate.expiresAt };
        }
      } catch {
        /* El servidor sigue siendo la autoridad de acceso. */
      }
    }
    if (
      !record ||
      !TOKEN.test(record.token) ||
      (record.expiresAt !== null &&
        (!Number.isFinite(Date.parse(record.expiresAt)) ||
          Date.parse(record.expiresAt) <= Date.now()))
    ) {
      this.forget(scope);
      return null;
    }
    this.memory.set(key, record);
    return record.token;
  }

  forget(scope: ReservationAccessScope): void {
    const key = this.key(scope);
    this.memory.delete(key);
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* Sin almacenamiento persistente. */
    }
  }

  path(scope: ReservationAccessScope): string {
    return (
      '/pago/' +
      [scope.tenantSlug, scope.establishmentSlug, scope.reservationId]
        .map(encodeURIComponent)
        .join('/')
    );
  }

  fragment(scope: ReservationAccessScope): string | null {
    const token = this.read(scope);
    return token ? 'access=' + token : null;
  }

  private key(scope: ReservationAccessScope): string {
    return (
      'mapit.reservation-access:' +
      JSON.stringify([scope.tenantSlug, scope.establishmentSlug, scope.reservationId])
    );
  }
}
