import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { CustomerReservationHistory, CustomerReservationHistoryItem } from '@mapit/api-client';
import { Subject, of, throwError } from 'rxjs';

import { CustomerHistoryApi } from '../data/customer-history-api';
import { CustomerHistoryStore } from './customer-history-store';

const AS_OF = '2026-10-25T12:00:00Z';
const ITEM: CustomerReservationHistoryItem = {
  id: '10000000-0000-0000-0000-000000000001',
  establishmentId: '20000000-0000-0000-0000-000000000001',
  establishmentName: 'La Bahía',
  spaceElementIds: ['30000000-0000-0000-0000-000000000001'],
  startsAt: '2026-10-25T18:00:00Z',
  endsAt: '2026-10-25T20:00:00Z',
  timezone: 'America/La_Paz',
  status: 'CANCELLED',
  createdAt: AS_OF,
};
const page = (
  items: CustomerReservationHistoryItem[] = [],
  hasMore = false,
): CustomerReservationHistory => ({
  items,
  hasMore,
  asOf: AS_OF,
});

describe('CustomerHistoryStore', () => {
  let store: CustomerHistoryStore;
  let api: {
    request: ReturnType<typeof vi.fn>;
    exchange: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    revoke: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(AS_OF));
    api = {
      request: vi.fn(() => of(null)),
      exchange: vi.fn(() => of({ sessionToken: 'session-A', expiresAt: '2026-10-25T12:30:00Z' })),
      list: vi.fn((_slug: string, _token: string, period: string) =>
        of(page(period === 'upcoming' ? [ITEM] : [])),
      ),
      revoke: vi.fn(() => of(null)),
    };
    TestBed.configureTestingModule({
      providers: [CustomerHistoryStore, { provide: CustomerHistoryApi, useValue: api }],
    });
    store = TestBed.inject(CustomerHistoryStore);
    store.setTenant('tenant-a');
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  async function authenticated(): Promise<void> {
    await store.exchange('link-A');
    await vi.waitFor(() => expect(store.past().status).toBe('loaded'));
  }

  it('valida el correo y muestra una confirmación neutra de solicitud', async () => {
    store.setEmail('no-es-correo');
    await store.requestAccess();
    expect(api.request).not.toHaveBeenCalled();
    expect(store.emailError()).not.toBe('');
    store.setEmail(' ana@example.com ');
    await store.requestAccess();
    expect(api.request).toHaveBeenCalledWith('tenant-a', 'ana@example.com');
    expect(store.requestStatus()).toBe('sent');
  });

  it('distingue rate limit de un fallo recuperable en la solicitud', async () => {
    store.setEmail('ana@example.com');
    api.request.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 429 })));
    await store.requestAccess();
    expect(store.errorMessage()).toContain('demasiadas');
    api.request.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })));
    await store.requestAccess();
    expect(store.errorMessage()).toContain('conexión');
  });

  it('canjea el enlace y comparte el asOf del servidor entre ambas secciones', async () => {
    await authenticated();
    expect(api.exchange).toHaveBeenCalledWith('tenant-a', 'link-A');
    expect(store.sessionActive()).toBe(true);
    expect(store.asOf()).toBe(AS_OF);
    expect(store.upcoming().items[0]?.status).toBe('CANCELLED');
    expect(api.list).toHaveBeenNthCalledWith(
      1,
      'tenant-a',
      'session-A',
      'upcoming',
      20,
      0,
      undefined,
    );
    expect(api.list).toHaveBeenNthCalledWith(2, 'tenant-a', 'session-A', 'past', 20, 0, AS_OF);
  });

  it('rechaza un enlace inválido o vencido sin conservar sesión', async () => {
    api.exchange.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 401 })));
    await store.exchange('usado');
    expect(store.exchangeStatus()).toBe('invalid');
    expect(store.sessionActive()).toBe(false);
    expect(store.errorMessage()).toContain('caducó');
    api.exchange.mockReturnValueOnce(of({ sessionToken: 'expired', expiresAt: AS_OF }));
    await store.exchange('vencido');
    expect(store.sessionActive()).toBe(false);
    expect(store.upcoming().items).toEqual([]);
  });

  it('vacía ambas secciones al vencer el temporizador y al recibir 401', async () => {
    await authenticated();
    await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
    expect(store.sessionActive()).toBe(false);
    expect(store.upcoming().items).toEqual([]);
    expect(store.past().items).toEqual([]);
    expect(store.sessionNotice()).toContain('caducó');

    vi.setSystemTime(new Date(AS_OF));
    await authenticated();
    api.list.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 401 })));
    await store.load('upcoming');
    expect(store.sessionActive()).toBe(false);
    expect(store.asOf()).toBeNull();
    expect(store.upcoming().items).toEqual([]);
  });

  it('revoca remotamente con la credencial anterior y borra datos incluso si falla la red', async () => {
    await authenticated();
    api.revoke.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })));
    await store.logout();
    expect(api.revoke).toHaveBeenCalledWith('tenant-a', 'session-A');
    expect(store.sessionActive()).toBe(false);
    expect(store.upcoming().items).toEqual([]);
    expect(store.sessionNotice()).toContain('cierre remoto');
  });

  it('ignora respuestas obsoletas y revoca la sesión del tenant anterior al cambiar', async () => {
    await authenticated();
    const pending = new Subject<CustomerReservationHistory>();
    api.list.mockReturnValueOnce(pending);
    const ongoing = store.load('upcoming');
    store.setTenant('tenant-b');
    expect(api.revoke).toHaveBeenCalledWith('tenant-a', 'session-A');
    pending.next(page([ITEM]));
    pending.complete();
    await ongoing;
    expect(store.tenantSlug()).toBe('tenant-b');
    expect(store.sessionActive()).toBe(false);
    expect(store.upcoming().items).toEqual([]);

    const exchange = new Subject<{ sessionToken: string; expiresAt: string }>();
    api.exchange.mockReturnValueOnce(exchange);
    const stale = store.exchange('old-link');
    store.setTenant('tenant-c');
    exchange.next({ sessionToken: 'session-B', expiresAt: '2026-10-25T12:30:00Z' });
    exchange.complete();
    await stale;
    expect(store.sessionActive()).toBe(false);
  });

  it('mantiene vacíos separados de errores, reintento y paginación independiente', async () => {
    api.list.mockImplementation((_slug: string, _token: string, period: string) =>
      of(page(period === 'upcoming' ? [ITEM] : [], period === 'upcoming')),
    );
    await authenticated();
    expect(store.past().items).toEqual([]);
    expect(store.past().status).toBe('loaded');
    api.list.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })));
    await store.load('upcoming', true);
    expect(store.upcoming().status).toBe('error');
    expect(store.upcoming().items).toEqual([ITEM]);
    api.list.mockReturnValueOnce(of(page([{ ...ITEM, id: 'other', status: 'CONFIRMED' }])));
    await store.load('upcoming', true);
    expect(store.upcoming().items).toHaveLength(2);
    expect(api.list).toHaveBeenLastCalledWith('tenant-a', 'session-A', 'upcoming', 20, 1, AS_OF);
    expect(store.past().items).toEqual([]);
  });
});
