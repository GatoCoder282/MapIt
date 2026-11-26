import { inject, Injectable } from '@angular/core';
import { BusinessApplicationsService } from '@mapit/api-client';
import type { BusinessApplicationCreateRequest } from '@mapit/api-client';
import type { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class BusinessApplicationApi {
  private readonly client = inject(BusinessApplicationsService);

  submit(request: BusinessApplicationCreateRequest): Observable<unknown> {
    return this.client.submitBusinessApplication({ businessApplicationCreateRequest: request });
  }

  verify(token: string): Observable<unknown> {
    return this.client.verifyBusinessApplicationContact({
      businessApplicationVerificationRequest: { token },
    });
  }
}
