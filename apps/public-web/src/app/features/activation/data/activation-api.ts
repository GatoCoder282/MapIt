import { Injectable, inject } from '@angular/core';
import { AuthService } from '@mapit/api-client';
import type { ActivationResponse } from '@mapit/api-client';
import type { Observable } from 'rxjs';

/** Adaptador de datos de la activación pública: consume solo el contrato generado. */
@Injectable({ providedIn: 'root' })
export class ActivationApi {
  private readonly client = inject(AuthService);

  activate(
    tenantSlug: string,
    token: string,
    password: string,
    passwordConfirm: string,
  ): Observable<ActivationResponse> {
    return this.client.activateAdmin({
      activationRequest: { tenantSlug, token, password, passwordConfirm },
    });
  }
}
