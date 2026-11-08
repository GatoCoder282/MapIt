import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { EstablishmentsService, type AccessibleEstablishment } from '@mapit/api-client';
import { AuthSession, type SessionUser } from '@mapit/auth';
import { firstValueFrom } from 'rxjs';

type Status = 'idle' | 'loading' | 'ready' | 'error';
type Identity = { tenantId: string; userId: string; sessionUser: SessionUser };

@Injectable({ providedIn: 'root' })
export class EstablishmentContext {
  private readonly api = inject(EstablishmentsService);
  private readonly session = inject(AuthSession);
  private readonly itemsState = signal<readonly AccessibleEstablishment[]>([]);
  private readonly activeState = signal<AccessibleEstablishment | null>(null);
  private readonly statusState = signal<Status>('idle');
  private identity: Identity | null = null;
  private generation = 0;
  private pending: Promise<void> | null = null;

  readonly establishments = this.itemsState.asReadonly();
  readonly active = computed(() => {
    const user = this.session.user();
    const active = this.activeState();
    const identity = this.identity;
    return identity && user === identity.sessionUser ? active : null;
  });
  readonly status = this.statusState.asReadonly();

  // Loading is identity-driven on entry; explicit calls refresh or retry empty/error states.
  constructor() {
    effect(() => {
      const user = this.session.user();
      const next = user ? { tenantId: user.tenantId, userId: user.id, sessionUser: user } : null;
      if (next?.sessionUser === this.identity?.sessionUser) return;

      this.generation++;
      this.identity = next;
      this.pending = null;
      this.itemsState.set([]);
      this.activeState.set(null);
      this.statusState.set('idle');
      if (next) void this.load();
    });
  }

  load(): Promise<void> {
    const user = this.session.user();
    if (!user) return Promise.resolve();
    const identity = { tenantId: user.tenantId, userId: user.id, sessionUser: user };
    if (identity.sessionUser !== this.identity?.sessionUser) {
      return Promise.resolve();
    }
    if (this.pending) return this.pending;

    const generation = this.generation;
    const key = this.storageKey(identity);
    this.itemsState.set([]);
    this.activeState.set(null);
    this.statusState.set('loading');
    const request = firstValueFrom(this.api.listAccessibleEstablishments())
      .then((items) => {
        if (generation !== this.generation || !this.isCurrent(identity)) return;
        this.itemsState.set(items);
        const savedId = this.readPreference(key);
        const restored = items.find((item) => item.id === savedId) ?? null;
        this.activeState.set(restored);
        if (savedId !== null && !restored) this.removePreference(key);
        this.statusState.set('ready');
      })
      .catch(() => {
        if (generation === this.generation && this.isCurrent(identity)) {
          this.itemsState.set([]);
          this.activeState.set(null);
          this.statusState.set('error');
        }
      })
      .finally(() => {
        if (this.pending === request) this.pending = null;
      });
    this.pending = request;
    return request;
  }

  confirm(id: string): boolean {
    const identity = this.identity;
    if (!identity || !this.isCurrent(identity) || this.statusState() !== 'ready') {
      return false;
    }
    const establishment = this.itemsState().find((item) => item.id === id);
    if (!establishment) return false;
    this.activeState.set(establishment);
    try {
      globalThis.localStorage.setItem(this.storageKey(identity), id);
    } catch {
      // Selection remains valid for this session when browser storage is unavailable.
    }
    return true;
  }

  private isCurrent(identity: Identity): boolean {
    return this.session.user() === identity.sessionUser;
  }

  private storageKey(identity: Identity): string {
    return `mapit.establishment.${identity.tenantId}.${identity.userId}`;
  }

  private readPreference(key: string): string | null {
    try {
      return globalThis.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private removePreference(key: string): void {
    try {
      globalThis.localStorage.removeItem(key);
    } catch {
      // A rejected preference stays unusable even if the browser blocks cleanup.
    }
  }
}
