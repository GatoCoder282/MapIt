import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { PlatformObservability, TenantHealthPage } from '@mapit/api-client';
import { forkJoin } from 'rxjs';
import {
  TenantObservabilityApi,
  type TenantStatusFilter,
  type WindowDays,
} from '../data/tenant-observability-api';
import { observabilityFailure, type ObservabilityStatus } from './observability-status';

/** ViewModel del resumen de plataforma y del listado de empresas (HU-7.08). */
@Injectable()
export class ObservabilityStore {
  private readonly api = inject(TenantObservabilityApi);
  private readonly destroyRef = inject(DestroyRef);
  private request = 0;

  readonly days = signal<WindowDays>(7);
  readonly search = signal('');
  readonly filter = signal<TenantStatusFilter>('');
  readonly page = signal(0);
  readonly status = signal<ObservabilityStatus>('loading');
  readonly overview = signal<PlatformObservability | null>(null);
  readonly tenants = signal<TenantHealthPage | null>(null);

  load(): void {
    const current = ++this.request;
    this.status.set('loading');
    forkJoin({
      overview: this.api.overview(this.days()),
      tenants: this.api.tenants(this.days(), this.search().trim(), this.filter(), this.page()),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ overview, tenants }) => {
          if (current !== this.request) return;
          this.overview.set(overview);
          this.tenants.set(tenants);
          this.status.set('loaded');
        },
        error: (error: unknown) => {
          if (current !== this.request) return;
          // No se conservan cifras viejas como si fueran actuales.
          this.overview.set(null);
          this.tenants.set(null);
          this.status.set(observabilityFailure(error));
        },
      });
  }

  setDays(days: WindowDays): void {
    this.days.set(days);
    this.load();
  }

  apply(search: string, filter: TenantStatusFilter): void {
    this.search.set(search);
    this.filter.set(filter);
    this.page.set(0);
    this.load();
  }

  changePage(page: number): void {
    this.page.set(page);
    this.load();
  }
}
