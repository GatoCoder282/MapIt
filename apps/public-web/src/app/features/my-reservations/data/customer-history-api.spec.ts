import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BASE_PATH } from '@mapit/api-client';

import { CustomerHistoryApi } from './customer-history-api';

describe('CustomerHistoryApi', () => {
  let api: CustomerHistoryApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        CustomerHistoryApi,
        { provide: BASE_PATH, useValue: '/api/v1' },
      ],
    });
    api = TestBed.inject(CustomerHistoryApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('solo transmite la credencial a la lectura y la revocación, sin Bearer ni caché privada', () => {
    api.request('demo', 'ana@example.com').subscribe();
    const request = http.expectOne('/api/v1/public/tenants/demo/history-access-requests');
    expect(request.request.headers.has('X-Customer-History-Session')).toBe(false);
    expect(request.request.body).toEqual({ email: 'ana@example.com' });
    request.flush(null, { status: 202, statusText: 'Accepted' });

    api.exchange('demo', 'enlace').subscribe();
    const exchange = http.expectOne('/api/v1/public/tenants/demo/history-sessions');
    expect(exchange.request.headers.has('X-Customer-History-Session')).toBe(false);
    expect(exchange.request.body).toEqual({ token: 'enlace' });
    exchange.flush({ sessionToken: 'sesion', expiresAt: '2026-10-25T13:00:00Z' });

    api.list('demo', 'secreto-privado', 'past', 20, 40, '2026-10-25T12:00:00Z').subscribe();
    const list = http.expectOne((r) => r.url === '/api/v1/public/tenants/demo/my-reservations');
    expect(list.request.headers.get('X-Customer-History-Session')).toBe('secreto-privado');
    expect(list.request.headers.has('Authorization')).toBe(false);
    expect(list.request.transferCache).toBe(false);
    expect(list.request.params.get('period')).toBe('past');
    expect(decodeURIComponent(list.request.params.get('asOf') ?? '')).toBe('2026-10-25T12:00:00Z');
    list.flush({ items: [], hasMore: false, asOf: '2026-10-25T12:00:00Z' });

    api.revoke('demo', 'secreto-privado').subscribe();
    const revoke = http.expectOne('/api/v1/public/tenants/demo/history-sessions/revoke');
    expect(revoke.request.headers.get('X-Customer-History-Session')).toBe('secreto-privado');
    expect(revoke.request.headers.has('Authorization')).toBe(false);
    revoke.flush(null, { status: 204, statusText: 'No Content' });
  });
});
