import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { Tenant, TenantStatus } from '@mapit/api-client';
import { Subject, debounceTime, distinctUntilChanged, finalize } from 'rxjs';

import { STRINGS } from '../../../../core/strings';
import { TenantsApi } from '../data/tenants-api';

export type ListStatus = 'idle' | 'loading' | 'ready' | 'error';

/** ViewModel del listado de tenants: filtros, paginación y estados de carga. */
@Injectable()
export class TenantsListStore {
  private readonly api = inject(TenantsApi);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<ListStatus>('idle');
  readonly tenants = signal<readonly Tenant[]>([]);
  readonly page = signal(0);
  readonly size = signal(20);
  readonly totalElements = signal(0);
  readonly totalPages = signal(0);
  readonly searchInput = signal('');
  readonly statusFilter = signal<TenantStatus | ''>('');
  readonly errorMessage = signal('');

  readonly isEmpty = computed(() => this.status() === 'ready' && this.tenants().length === 0);
  readonly hasError = computed(() => this.status() === 'error');
  readonly canGoPrev = computed(() => this.page() > 0 && this.status() !== 'loading');
  readonly canGoNext = computed(
    () => this.page() + 1 < this.totalPages() && this.status() !== 'loading',
  );

  /** Búsqueda con debounce para no golpear la API en cada tecla. */
  private readonly searchTrigger = new Subject<string>();
  private version = 0;

  constructor() {
    this.searchTrigger
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.page.set(0);
        this.refresh({ search: value });
      });
  }

  /** Primera carga o recarga con los filtros actuales. */
  refresh(overrides?: { search?: string; status?: TenantStatus | ''; page?: number }): void {
    const version = ++this.version;
    this.status.set('loading');
    this.errorMessage.set('');

    const search = overrides?.search ?? this.searchInput();
    const statusFilter = overrides?.status ?? this.statusFilter();
    const page = overrides?.page ?? this.page();

    const params: { search?: string; status?: TenantStatus; page: number; size: number } = {
      page,
      size: this.size(),
    };
    const trimmed = search.trim();
    if (trimmed) params.search = trimmed;
    if (statusFilter) params.status = statusFilter;

    this.api
      .list(params)
      .pipe(
        finalize(() => {
          if (version === this.version && this.status() === 'loading') {
            this.status.set(this.errorMessage() ? 'error' : 'ready');
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          if (version !== this.version) return;
          this.tenants.set(result.content);
          this.page.set(result.page);
          this.totalElements.set(result.totalElements);
          this.totalPages.set(result.totalPages);
        },
        error: (error: unknown) => {
          if (version !== this.version) return;
          this.errorMessage.set(STRINGS.tenants.error);
          if (error instanceof HttpErrorResponse && error.status === 401) return; // interceptor ya cierra sesión
        },
      });
  }

  onSearchInput(value: string): void {
    this.searchInput.set(value);
    this.searchTrigger.next(value);
  }

  onStatusFilter(value: TenantStatus | ''): void {
    this.statusFilter.set(value);
    this.page.set(0);
    this.refresh({ status: value });
  }

  retry(): void {
    this.refresh();
  }

  goPrev(): void {
    if (!this.canGoPrev()) return;
    this.refresh({ page: this.page() - 1 });
  }

  goNext(): void {
    if (!this.canGoNext()) return;
    this.refresh({ page: this.page() + 1 });
  }
}
