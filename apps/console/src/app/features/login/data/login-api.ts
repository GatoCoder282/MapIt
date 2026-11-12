import { inject, Injectable } from '@angular/core';
import { AuthService, type GlobalLoginRequest } from '@mapit/api-client';

/** Adaptador del contrato de autenticación. */
@Injectable({ providedIn: 'root' })
export class LoginApi {
  private readonly api = inject(AuthService);
  login(request: GlobalLoginRequest) {
    return this.api.globalLogin({ globalLoginRequest: request }, 'body', false, {
      transferCache: false,
    });
  }
}
