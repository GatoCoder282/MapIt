import { inject, Injectable } from '@angular/core';
import { AuthService, type LoginRequest } from '@mapit/api-client';

/** Adaptador del contrato de autenticación. */
@Injectable({ providedIn: 'root' })
export class LoginApi {
  private readonly api = inject(AuthService);
  login(request: LoginRequest) {
    return this.api.login({ loginRequest: request }, 'body', false, { transferCache: false });
  }
}
