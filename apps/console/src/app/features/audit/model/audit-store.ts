import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { AuditEventType, AuditLogEntry, AuditResourceType } from '@mapit/api-client';
import { finalize } from 'rxjs';

import { STRINGS } from '../../../core/strings';
import { AuditApi, type AuditQuery } from '../data/audit-api';

export type AuditListStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface AuditFilters {
  resourceType: AuditResourceType | '';
  eventType: AuditEventType | '';
  resourceId: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: AuditFilters = {
  resourceType: '',
  eventType: '',
  resourceId: '',
  from: '',
  to: '',
};

/** ViewModel de la bitácora: conserva filtros, página y estados de consulta. */
@Injectable()
export class AuditStore {
  private readonly api = inject(AuditApi);
  private readonly destroyRef = inject(DestroyRef);
  private version = 0;

  readonly status = signal<AuditListStatus>('idle');
  readonly entries = signal<readonly AuditLogEntry[]>([]);
  readonly filters = signal<AuditFilters>({ ...EMPTY_FILTERS });
  readonly page = signal(0);
  readonly size = signal(20);
  readonly totalElements = signal(0);
  readonly totalPages = signal(0);
  readonly errorMessage = signal('');

  readonly isEmpty = computed(() => this.status() === 'ready' && this.entries().length === 0);
  readonly canGoPrev = computed(() => this.page() > 0 && this.status() !== 'loading');
  readonly canGoNext = computed(
    () => this.page() + 1 < this.totalPages() && this.status() !== 'loading',
  );

  refresh(requestedPage = this.page()): void {
    const version = ++this.version;
    this.status.set('loading');
    this.errorMessage.set('');

    this.api
      .list(this.buildQuery(requestedPage))
      .pipe(
        finalize(() => {
          if (version === this.version && this.status() === 'loading') this.status.set('ready');
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          if (version !== this.version) return;
          this.entries.set(result.content);
          this.page.set(result.page);
          this.totalElements.set(result.totalElements);
          this.totalPages.set(result.totalPages);
        },
        error: (error: unknown) => {
          if (version !== this.version) return;
          const forbidden = error instanceof HttpErrorResponse && error.status === 403;
          this.errorMessage.set(forbidden ? STRINGS.audit.forbidden : STRINGS.audit.error);
          this.status.set('error');
        },
      });
  }

  updateFilter<K extends keyof AuditFilters>(key: K, value: AuditFilters[K]): void {
    this.filters.update((current) => ({ ...current, [key]: value }));
  }

  applyFilters(): void {
    this.page.set(0);
    this.refresh(0);
  }

  clearFilters(): void {
    this.filters.set({ ...EMPTY_FILTERS });
    this.page.set(0);
    this.refresh(0);
  }

  retry(): void {
    this.refresh();
  }

  goPrev(): void {
    if (this.canGoPrev()) this.refresh(this.page() - 1);
  }

  goNext(): void {
    if (this.canGoNext()) this.refresh(this.page() + 1);
  }

  private buildQuery(page: number): AuditQuery {
    const filters = this.filters();
    const query: AuditQuery = { page, size: this.size() };
    if (filters.resourceType) query.resourceType = filters.resourceType;
    if (filters.eventType) query.eventType = filters.eventType;
    if (filters.resourceId.trim()) query.resourceId = filters.resourceId.trim();
    if (filters.from) query.from = this.dateBoundary(filters.from, false);
    if (filters.to) query.to = this.dateBoundary(filters.to, true);
    return query;
  }

  private dateBoundary(value: string, endOfDay: boolean): string {
    const suffix = endOfDay ? 'T23:59:59.999' : 'T00:00:00.000';
    return new Date(`${value}${suffix}`).toISOString();
  }
}
