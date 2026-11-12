import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { AuditEventType, AuditLogEntry, AuditResourceType } from '@mapit/api-client';
import { finalize } from 'rxjs';

import { STRINGS } from '../../../core/strings';
import { AuditApi, type AuditQuery } from '../data/audit-api';

export type AuditListStatus = 'idle' | 'loading' | 'ready' | 'error';
export type AuditPeriod = 'week' | 'month' | 'all' | 'custom';

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
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const PAGE_SIZES = [10, 20, 50] as const;

function dateBoundary(value: string, endOfDay: boolean): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(value + 'T00:00:00');
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day)
    return undefined;
  if (endOfDay) date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

function presetStart(period: 'week' | 'month'): string {
  const date = new Date();
  date.setDate(date.getDate() - (period === 'week' ? 6 : 29));
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

/** ViewModel de la bitácora: conserva filtros, página y estados de consulta. */
@Injectable()
export class AuditStore {
  private readonly api = inject(AuditApi);
  private readonly destroyRef = inject(DestroyRef);
  private version = 0;
  private requestedPage = 0;
  private applied: Omit<AuditQuery, 'page' | 'size'> = { from: presetStart('week') };

  readonly status = signal<AuditListStatus>('idle');
  readonly entries = signal<readonly AuditLogEntry[]>([]);
  readonly filters = signal<AuditFilters>({ ...EMPTY_FILTERS });
  readonly period = signal<AuditPeriod>('week');
  readonly page = signal(0);
  readonly pageSizes = PAGE_SIZES;
  readonly size = signal<number>(PAGE_SIZES[0]);
  readonly totalElements = signal(0);
  readonly totalPages = signal(0);
  readonly errorMessage = signal('');
  readonly filterError = signal('');
  readonly selectedId = signal<string | null>(null);
  readonly selectedEntry = computed(() => {
    const id = this.selectedId();
    return this.entries().find((entry) => entry.id === id);
  });

  readonly isEmpty = computed(() => this.status() === 'ready' && this.entries().length === 0);
  readonly canGoPrev = computed(() => this.page() > 0 && this.status() !== 'loading');
  readonly canGoNext = computed(
    () => this.page() + 1 < this.totalPages() && this.status() !== 'loading',
  );

  refresh(requestedPage = this.page()): void {
    this.requestedPage = requestedPage;
    const version = ++this.version;
    this.status.set('loading');
    this.errorMessage.set('');

    this.api
      .list({ ...this.applied, page: requestedPage, size: this.size() })
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
          this.size.set(result.size);
          this.totalElements.set(result.totalElements);
          this.totalPages.set(result.totalPages);
          if (!this.selectedEntry()) this.selectedId.set(null);
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
    this.filterError.set('');
  }

  updatePeriod(period: AuditPeriod): void {
    this.period.set(period);
    this.filterError.set('');
  }

  applyFilters(): void {
    const filters = this.filters();
    const resourceId = filters.resourceId.trim();
    if (resourceId && !UUID.test(resourceId)) {
      this.filterError.set(STRINGS.audit.invalidResourceId);
      return;
    }

    const period = this.period();
    const from =
      period === 'custom' && filters.from ? dateBoundary(filters.from, false) : undefined;
    const to = period === 'custom' && filters.to ? dateBoundary(filters.to, true) : undefined;
    if (
      period === 'custom' &&
      ((filters.from && !from) || (filters.to && !to) || (from && to && from > to))
    ) {
      this.filterError.set(STRINGS.audit.invalidPeriod);
      return;
    }

    this.applied = {};
    if (filters.resourceType) this.applied.resourceType = filters.resourceType;
    if (filters.eventType) this.applied.eventType = filters.eventType;
    if (resourceId) this.applied.resourceId = resourceId;
    if (period === 'week' || period === 'month') this.applied.from = presetStart(period);
    if (from) this.applied.from = from;
    if (to) this.applied.to = to;
    this.filterError.set('');
    this.refresh(0);
  }

  clearFilters(): void {
    this.filters.set({ ...EMPTY_FILTERS });
    this.period.set('all');
    this.applyFilters();
  }

  retry(): void {
    this.refresh(this.requestedPage);
  }

  goPrev(): void {
    if (this.canGoPrev()) this.refresh(this.page() - 1);
  }

  goNext(): void {
    if (this.canGoNext()) this.refresh(this.page() + 1);
  }

  setPageSize(size: number): void {
    if (!this.pageSizes.some((option) => option === size) || this.size() === size) return;
    this.size.set(size);
    this.refresh(0);
  }

  select(id: string | null): void {
    this.selectedId.set(id);
  }
}
