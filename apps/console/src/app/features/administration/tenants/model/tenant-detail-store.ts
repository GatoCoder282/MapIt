import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { Tenant, TenantStatus } from '@mapit/api-client';
import { finalize } from 'rxjs';

import { STRINGS } from '../../../../core/strings';
import { TenantsApi } from '../data/tenants-api';

export type DetailStatus = 'loading' | 'ready' | 'error' | 'not-found';

/** ViewModel del detalle de un tenant: carga, edición de nombre y ciclo de vida. */
@Injectable()
export class TenantDetailStore {
  private readonly api = inject(TenantsApi);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<DetailStatus>('loading');
  readonly tenant = signal<Tenant | null>(null);
  readonly saving = signal(false);
  readonly confirming = signal<TenantStatus | null>(null);
  readonly feedback = signal<{ kind: 'success' | 'error'; message: string } | null>(null);

  readonly isActive = computed(() => this.tenant()?.status === 'ACTIVE');

  load(tenantId: string): void {
    this.status.set('loading');
    this.feedback.set(null);
    this.api
      .getById(tenantId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tenant) => {
          this.tenant.set(tenant);
          this.status.set('ready');
        },
        error: (error: unknown) => {
          this.status.set(
            error instanceof HttpErrorResponse && error.status === 404 ? 'not-found' : 'error',
          );
        },
      });
  }

  /** Edición parcial: solo el nombre viaja; slug y vertical no salen del formulario. */
  rename(name: string): void {
    const current = this.tenant();
    if (!current || this.saving()) return;
    this.saving.set(true);
    this.feedback.set(null);
    this.api
      .update(current.id, { name: name.trim() })
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (tenant) => {
          this.tenant.set(tenant);
          this.feedback.set({ kind: 'success', message: STRINGS.tenantForm.successUpdate });
        },
        error: (error: unknown) =>
          this.feedback.set({ kind: 'error', message: this.messageFor(error) }),
      });
  }

  askStatusChange(): void {
    const current = this.tenant();
    if (!current) return;
    this.confirming.set(current.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE');
  }

  cancelStatusChange(): void {
    this.confirming.set(null);
  }

  confirmStatusChange(): void {
    const current = this.tenant();
    const target = this.confirming();
    if (!current || !target || this.saving()) return;
    this.saving.set(true);
    this.api
      .changeStatus(current.id, target)
      .pipe(
        finalize(() => {
          this.saving.set(false);
          this.confirming.set(null);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (tenant) => {
          this.tenant.set(tenant);
          this.feedback.set({ kind: 'success', message: STRINGS.tenantDetail.statusUpdated });
        },
        error: (error: unknown) =>
          this.feedback.set({ kind: 'error', message: this.messageFor(error) }),
      });
  }

  private messageFor(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 400) return STRINGS.tenantForm.errors.badRequest;
      if (error.status === 401) return STRINGS.tenantForm.errors.unauthorized;
      if (error.status === 403) return STRINGS.tenantForm.errors.forbidden;
      if (error.status === 404) return STRINGS.tenantDetail.notFound;
      if (error.status === 409) return STRINGS.tenantForm.errors.slugConflict;
    }
    return STRINGS.tenantForm.errors.generic;
  }
}
