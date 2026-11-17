import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AUTH_STRINGS } from './auth-strings';

export interface SessionUser {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'STAFF';
}

export interface SessionResponse {
  accessToken: string;
  tokenType: string;
  expiresAt: string;
  user: SessionUser;
}

const SESSION_KEY = 'mapit.auth.session';

function validSession(value: unknown): value is SessionResponse {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<SessionResponse>;
  const user = session.user;
  return (
    typeof session.accessToken === 'string' &&
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(session.accessToken) &&
    session.tokenType === 'Bearer' &&
    typeof session.expiresAt === 'string' &&
    Number.isFinite(Date.parse(session.expiresAt)) &&
    Date.parse(session.expiresAt) > Date.now() &&
    !!user &&
    typeof user.id === 'string' &&
    /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(user.id) &&
    typeof user.tenantId === 'string' &&
    user.tenantId.length >= 2 &&
    user.tenantId.length <= 63 &&
    typeof user.email === 'string' &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email) &&
    typeof user.fullName === 'string' &&
    user.fullName.trim().length > 0 &&
    ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'].includes(user.role)
  );
}

@Injectable({ providedIn: 'root' })
export class AuthSession {
  private readonly router = inject(Router);
  private readonly currentUser = signal<SessionUser | null>(null);
  private readonly storageWarningVisible = signal(false);
  private current: SessionResponse | null = null;
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;
  readonly user = this.currentUser.asReadonly();
  readonly warning = computed(() =>
    this.storageWarningVisible() ? AUTH_STRINGS.storageWarning : '',
  );

  constructor() {
    this.restore();
    inject(DestroyRef).onDestroy(() => clearTimeout(this.expiryTimer));
  }

  start(response: SessionResponse, remember: boolean): void {
    const candidate: unknown = response;
    if (!validSession(candidate)) throw new Error(AUTH_STRINGS.sessionInvalid);
    // Seleccionar campos explícitos impide persistir datos ajenos al contrato.
    const { id, tenantId, email, fullName, role } = candidate.user;
    this.current = {
      accessToken: candidate.accessToken,
      tokenType: 'Bearer',
      expiresAt: candidate.expiresAt,
      user: { id, tenantId, email, fullName, role },
    };
    this.currentUser.set(this.current.user);
    this.storageWarningVisible.set(false);
    this.removeStoredSessions();
    this.withStorage(remember ? 'localStorage' : 'sessionStorage', (storage) => {
      storage.setItem(SESSION_KEY, JSON.stringify(this.current));
    });
    this.scheduleExpiry();
  }

  token(): string | null {
    if (this.current && Date.parse(this.current.expiresAt) <= Date.now()) this.logout();
    return this.current?.accessToken ?? null;
  }

  loginUrl(): string {
    return '/login';
  }

  logout(): void {
    this.current = null;
    this.currentUser.set(null);
    clearTimeout(this.expiryTimer);
    this.removeStoredSessions();
    void this.router.navigateByUrl(this.loginUrl());
  }

  clearIfCurrent(token: string): void {
    if (this.current?.accessToken === token) this.logout();
  }

  private restore(): void {
    for (const name of ['sessionStorage', 'localStorage'] as const) {
      this.withStorage(name, (storage) => {
        const raw = storage.getItem(SESSION_KEY);
        if (!raw) return;
        let stored: unknown;
        try {
          stored = JSON.parse(raw);
        } catch {
          storage.removeItem(SESSION_KEY);
          return;
        }
        if (!validSession(stored) || this.current) {
          storage.removeItem(SESSION_KEY);
          return;
        }
        this.current = stored;
        this.currentUser.set(stored.user);
      });
    }
    this.scheduleExpiry();
  }

  private scheduleExpiry(): void {
    clearTimeout(this.expiryTimer);
    if (!this.current) return;
    const delay = Math.min(Date.parse(this.current.expiresAt) - Date.now(), 2_147_483_647);
    this.expiryTimer = setTimeout(
      () => {
        if (this.token()) this.scheduleExpiry();
      },
      Math.max(0, delay),
    );
  }

  private removeStoredSessions(): void {
    for (const name of ['sessionStorage', 'localStorage'] as const) {
      this.withStorage(name, (storage) => storage.removeItem(SESSION_KEY));
    }
  }

  private withStorage(
    name: 'localStorage' | 'sessionStorage',
    action: (storage: Storage) => void,
  ): void {
    try {
      action(globalThis[name]);
    } catch {
      this.storageWarningVisible.set(true);
    }
  }
}
