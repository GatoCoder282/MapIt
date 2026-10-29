import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import type { CustomerReservationHistoryItem } from '@mapit/api-client';
import { firstValueFrom } from 'rxjs';

import { STRINGS } from '../../../core/strings';
import { CustomerHistoryApi, type HistoryPeriod } from '../data/customer-history-api';

type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';
export type HistorySection = {
  readonly items: readonly CustomerReservationHistoryItem[];
  readonly status: LoadStatus;
  readonly hasMore: boolean;
};

const EMPTY_SECTION: HistorySection = { items: [], status: 'idle', hasMore: false };
const PAGE_SIZE = 20;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Estado sensible limitado a la vida de esta ruta; ninguna credencial se persiste. */
@Injectable()
export class CustomerHistoryStore {
  private readonly api = inject(CustomerHistoryApi);
  private readonly destroyRef = inject(DestroyRef);
  private version = 0;
  private token: string | null = null;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  readonly tenantSlug = signal('');
  readonly email = signal('');
  readonly submitted = signal(false);
  readonly requestStatus = signal<'idle' | 'loading' | 'sent' | 'error'>('idle');
  readonly exchangeStatus = signal<'idle' | 'loading' | 'invalid'>('idle');
  readonly errorMessage = signal('');
  readonly sessionActive = signal(false);
  readonly sessionNotice = signal('');
  readonly asOf = signal<string | null>(null);
  readonly upcoming = signal<HistorySection>(EMPTY_SECTION);
  readonly past = signal<HistorySection>(EMPTY_SECTION);
  readonly emailError = computed(() =>
    this.submitted() && !EMAIL_PATTERN.test(this.email().trim())
      ? STRINGS.myReservations.invalidEmail
      : '',
  );

  constructor() {
    this.destroyRef.onDestroy(() => this.clear());
  }

  setTenant(slug: string): void {
    if (this.tenantSlug() === slug) return;
    const oldTenant = this.tenantSlug();
    const oldToken = this.token;
    this.clear();
    this.tenantSlug.set(slug);
    this.email.set('');
    this.submitted.set(false);
    if (oldTenant && oldToken)
      void firstValueFrom(this.api.revoke(oldTenant, oldToken)).catch(() => {
        // No mostrar un error perteneciente al tenant anterior en el nuevo tenant.
      });
  }

  setEmail(value: string): void {
    this.email.set(value);
    if (this.requestStatus() === 'error') this.requestStatus.set('idle');
    this.errorMessage.set('');
  }

  async requestAccess(): Promise<void> {
    if (this.requestStatus() === 'loading') return;
    this.submitted.set(true);
    if (this.emailError()) return;
    const version = this.version;
    const slug = this.tenantSlug();
    this.requestStatus.set('loading');
    this.errorMessage.set('');
    try {
      await firstValueFrom(this.api.request(slug, this.email().trim()));
      if (version !== this.version) return;
      this.requestStatus.set('sent');
    } catch (error: unknown) {
      if (version !== this.version) return;
      this.requestStatus.set('error');
      this.errorMessage.set(
        error instanceof HttpErrorResponse && error.status === 429
          ? STRINGS.myReservations.errors.rateLimit
          : STRINGS.myReservations.errors.request,
      );
    }
  }

  async exchange(linkToken: string): Promise<void> {
    if (!linkToken) return;
    this.clear();
    const version = this.version;
    const slug = this.tenantSlug();
    this.exchangeStatus.set('loading');
    try {
      const session = await firstValueFrom(this.api.exchange(slug, linkToken));
      if (version !== this.version) return;
      this.exchangeStatus.set('idle');
      this.token = session.sessionToken;
      const remaining = Date.parse(session.expiresAt) - Date.now();
      if (!Number.isFinite(remaining) || remaining <= 0) {
        this.expire();
        return;
      }
      this.sessionActive.set(true);
      this.expiryTimer = setTimeout(() => this.expire(), remaining);
      await this.load('upcoming');
    } catch {
      if (version !== this.version) return;
      this.exchangeStatus.set('invalid');
      this.errorMessage.set(STRINGS.myReservations.errors.linkInvalid);
    }
  }

  async load(period: HistoryPeriod, more = false): Promise<void> {
    if (!this.sessionActive() || !this.token) return;
    if (period === 'past' && !this.asOf()) {
      if (this.upcoming().status !== 'loading') await this.load('upcoming');
      return;
    }
    const state = this.section(period)();
    if (state.status === 'loading' || (more && !state.hasMore)) return;
    const version = this.version;
    const slug = this.tenantSlug();
    const token = this.token;
    this.section(period).set({ ...state, status: 'loading' });
    try {
      const page = await firstValueFrom(
        this.api.list(
          slug,
          token,
          period,
          PAGE_SIZE,
          more ? state.items.length : 0,
          this.asOf() ?? undefined,
        ),
      );
      if (version !== this.version || this.token !== token) return;
      if (!this.asOf()) this.asOf.set(page.asOf);
      this.section(period).set({
        items: more ? [...state.items, ...page.items] : page.items,
        status: 'loaded',
        hasMore: page.hasMore,
      });
      if (period === 'upcoming' && this.past().status === 'idle') void this.load('past');
    } catch (error: unknown) {
      if (version !== this.version || this.token !== token) return;
      if (error instanceof HttpErrorResponse && error.status === 401) {
        this.expire();
        return;
      }
      this.section(period).set({ ...state, status: 'error' });
    }
  }

  async logout(): Promise<void> {
    const slug = this.tenantSlug();
    const token = this.token;
    this.clear();
    if (!token) return;
    const version = this.version;
    try {
      await firstValueFrom(this.api.revoke(slug, token));
    } catch {
      if (version === this.version) this.sessionNotice.set(STRINGS.myReservations.errors.revoke);
    }
  }

  private section(period: HistoryPeriod) {
    return period === 'upcoming' ? this.upcoming : this.past;
  }

  private expire(): void {
    this.clear();
    this.sessionNotice.set(STRINGS.myReservations.errors.expired);
  }

  private clear(): void {
    this.version++;
    if (this.expiryTimer !== null) clearTimeout(this.expiryTimer);
    this.expiryTimer = null;
    this.token = null;
    this.sessionActive.set(false);
    this.asOf.set(null);
    this.upcoming.set(EMPTY_SECTION);
    this.past.set(EMPTY_SECTION);
    this.requestStatus.set('idle');
    this.exchangeStatus.set('idle');
    this.errorMessage.set('');
    this.sessionNotice.set('');
  }
}
