import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { FeatureFlagService } from '@mapit/feature-flags';
import { Client, type IFrame } from '@stomp/stompjs';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { BASE_PATH } from '@mapit/api-client';
import { ReservationAccess } from '../../../core/reservation-access';
import { PublicRuntimeConfig } from '../../../core/runtime-config';
import { PublicPaymentApi } from './public-payment-api';
describe('PublicPaymentApi', () => {
  const scope = {
    tenantSlug: 'tenant-a',
    establishmentSlug: 'venue-a',
    reservationId: '10000000-0000-0000-0000-000000000001',
  };
  let api: PublicPaymentApi;
  let http: HttpTestingController;
  const websocket = signal(true);
  beforeEach(() => {
    websocket.set(true);
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BASE_PATH, useValue: '/api/v1' },
        { provide: FeatureFlagService, useValue: { isEnabled: () => websocket } },
        {
          provide: PublicRuntimeConfig,
          useValue: {
            config: () => ({
              environment: 'test',
              paymentPreviewEnabled: false,
              wsUrl: 'ws://localhost/ws',
            }),
          },
        },
      ],
    });
    api = TestBed.inject(PublicPaymentApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });
  it('no usa UUID como credencial ni consulta sin capability', () => {
    expect(() => api.checkout(scope)).toThrow();
    http.expectNone(() => true);
  });
  it('transporta capability solo en header y no envía importe al iniciar cobro', () => {
    const token = 'a'.repeat(43);
    TestBed.inject(ReservationAccess).save(scope, token, null);
    api.checkout(scope).subscribe();
    const get = http.expectOne((request) => request.url.endsWith('/checkout'));
    expect(get.request.headers.get('X-Reservation-Access')).toBe(token);
    expect(get.request.urlWithParams).not.toContain(token);
    get.flush({});
    api.start(scope, 'method-a', 'request-a').subscribe();
    const post = http.expectOne((request) => request.url.endsWith('/payments'));
    expect(post.request.body).toEqual({ methodId: 'method-a', requestId: 'request-a' });
    expect(post.request.headers.has('Authorization')).toBe(false);
    post.flush({});
  });
  it('reenvía el outcome exacto al simulador manteniendo capability solo en header', () => {
    const token = 'a'.repeat(43);
    TestBed.inject(ReservationAccess).save(scope, token, null);
    for (const outcome of ['CONFIRMED', 'CANCELLED', 'EXPIRED', 'FAILED'] as const) {
      api.simulate(scope, '20000000-0000-0000-0000-000000000002', outcome).subscribe();
      const post = http.expectOne(
        (request) =>
          request.method === 'POST' &&
          request.url.endsWith('/payments/20000000-0000-0000-0000-000000000002/simulate'),
      );
      expect(post.request.body).toEqual({ outcome });
      expect(post.request.headers.get('X-Reservation-Access')).toBe(token);
      expect(post.request.urlWithParams).not.toContain(token);
      post.flush({});
    }
  });
  it('respeta kill switch, sala propia, reconexión y liberación del socket', () => {
    TestBed.inject(ReservationAccess).save(scope, 'a'.repeat(43), null);
    const activated: Client[] = [];
    const activate = vi.spyOn(Client.prototype, 'activate').mockImplementation(function (
      this: Client,
    ) {
      activated.push(this);
    });
    const deactivate = vi.spyOn(Client.prototype, 'deactivate').mockResolvedValue(undefined);
    const subscribe = vi
      .spyOn(Client.prototype, 'subscribe')
      .mockReturnValue({ id: 'own-room', unsubscribe: vi.fn() });
    const refresh = vi.fn(),
      connection = vi.fn();
    websocket.set(false);
    const stop = api.watch(scope, refresh, connection);
    TestBed.tick();
    expect(activate).not.toHaveBeenCalled();
    websocket.set(true);
    TestBed.tick();
    const client = activated[0]!;
    const connected: IFrame = {
      command: 'CONNECTED',
      headers: {},
      isBinaryBody: false,
      body: '',
      binaryBody: new Uint8Array(),
    };
    client.onConnect(connected);
    client.onConnect(connected);
    expect(subscribe).toHaveBeenCalledWith(
      '/topic/reservations/' + scope.reservationId + '/payments',
      expect.any(Function),
    );
    expect(refresh).toHaveBeenCalledTimes(2);
    websocket.set(false);
    TestBed.tick();
    expect(deactivate).toHaveBeenCalled();
    stop();
    expect(deactivate).toHaveBeenCalledTimes(3);
  });
});
