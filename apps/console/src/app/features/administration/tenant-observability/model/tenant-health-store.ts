import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { TenantHealthDetail } from '@mapit/api-client';
import { TenantObservabilityApi, type WindowDays } from '../data/tenant-observability-api';
import { observabilityFailure, type ObservabilityStatus } from './observability-status';

/** ViewModel del detalle agregado de una empresa. */
@Injectable()
export class TenantHealthStore {
  private readonly api = inject(TenantObservabilityApi);
  private readonly destroyRef = inject(DestroyRef);
  private request = 0;

  readonly days = signal<WindowDays>(7);
  readonly status = signal<ObservabilityStatus>('loading');
  readonly detail = signal<TenantHealthDetail | null>(null);
  private slug = '';

  open(slug: string): void {
    this.slug = slug;
    this.load();
  }

  setDays(days: WindowDays): void {
    this.days.set(days);
    this.load();
  }

  load(): void {
    const current = ++this.request;
    this.status.set('loading');
    this.detail.set(null);
    this.api
      .tenant(this.slug, this.days())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          if (current !== this.request) return;
          this.detail.set(detail);
          this.status.set('loaded');
        },
        error: (error: unknown) => {
          if (current === this.request) this.status.set(observabilityFailure(error));
        },
      });
  }
}
