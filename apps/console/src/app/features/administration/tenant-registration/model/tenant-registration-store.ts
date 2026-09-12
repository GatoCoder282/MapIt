import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import type { BusinessVertical, Tenant, TenantRequest } from '@mapit/api-client';
import { finalize } from 'rxjs';
import { TenantRegistrationApi } from '../data/tenant-registration-api';

export interface TenantRegistrationDraft {
  name: string;
  slug: string;
  vertical: BusinessVertical;
  administratorEmail: string;
}

/** ViewModel del registro de tenants basado en Signals. */
@Injectable()
export class TenantRegistrationStore {
  private readonly api = inject(TenantRegistrationApi);
  private readonly savingState = signal(false);
  private readonly successState = signal<Tenant | null>(null);
  private readonly errorState = signal<string | null>(null);

  readonly saving = this.savingState.asReadonly();
  readonly success = this.successState.asReadonly();
  readonly error = this.errorState.asReadonly();

  register(draft: TenantRegistrationDraft): void {
    const request: TenantRequest = {
      name: draft.name.trim(),
      slug: draft.slug.trim(),
      vertical: draft.vertical,
      administratorEmail: draft.administratorEmail.trim(),
    };

    this.savingState.set(true);
    this.successState.set(null);
    this.errorState.set(null);
    this.api
      .create(request)
      .pipe(finalize(() => this.savingState.set(false)))
      .subscribe({
        next: (tenant) => this.successState.set(tenant),
        error: (error: unknown) => this.errorState.set(this.messageFor(error)),
      });
  }

  clearFeedback(): void {
    this.successState.set(null);
    this.errorState.set(null);
  }

  private messageFor(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 400) {
        return 'Revisa los datos ingresados.';
      }
      if (error.status === 401 || error.status === 403) {
        return 'No tienes permisos para registrar un tenant.';
      }
      if (error.status === 409) {
        return 'El slug ya está registrado.';
      }
      if (error.status === 503) {
        return 'No se pudo enviar el correo de confirmación. Intenta nuevamente.';
      }
    }
    return 'No se pudo registrar el tenant.';
  }
}
