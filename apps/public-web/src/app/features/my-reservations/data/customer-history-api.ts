import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  BASE_PATH,
  Configuration,
  CustomerHistoryService,
  type CustomerHistorySession,
  type CustomerReservationHistory,
} from '@mapit/api-client';
import type { Observable } from 'rxjs';

export type HistoryPeriod = 'upcoming' | 'past';

/** Cada llamada protegida recibe un cliente aislado con su credencial capturada. */
@Injectable()
export class CustomerHistoryApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(BASE_PATH);
  private readonly publicClient = inject(CustomerHistoryService);

  request(tenantSlug: string, email: string): Observable<unknown> {
    return this.publicClient.requestCustomerHistoryAccess(
      { tenantSlug, customerHistoryAccessRequest: { email } },
      'body',
      false,
      { transferCache: false },
    );
  }

  exchange(tenantSlug: string, token: string): Observable<CustomerHistorySession> {
    return this.publicClient.exchangeCustomerHistoryLink(
      { tenantSlug, customerHistoryLinkExchangeRequest: { token } },
      'body',
      false,
      { transferCache: false },
    );
  }

  list(
    tenantSlug: string,
    token: string,
    period: HistoryPeriod,
    limit: number,
    offset: number,
    asOf?: string,
  ): Observable<CustomerReservationHistory> {
    return this.authorizedClient(token).listMyReservations(
      { tenantSlug, period, limit, offset, ...(asOf ? { asOf } : {}) },
      'body',
      false,
      { transferCache: false },
    );
  }

  revoke(tenantSlug: string, token: string): Observable<unknown> {
    return this.authorizedClient(token).revokeCustomerHistorySession(
      { tenantSlug },
      'body',
      false,
      { transferCache: false },
    );
  }

  private authorizedClient(token: string): CustomerHistoryService {
    return new CustomerHistoryService(
      this.http,
      this.basePath,
      new Configuration({
        basePath: this.basePath,
        credentials: { customerHistorySession: token },
      }),
    );
  }
}
