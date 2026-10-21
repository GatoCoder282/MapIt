import { TestBed } from '@angular/core/testing';
import type { PublicAvailability } from '@mapit/api-client';
import { Subject, of, throwError } from 'rxjs';

import { AvailabilityApi } from '../data/availability-api';
import { AvailabilityStore } from './availability-store';

describe('AvailabilityStore', () => {
  const result: PublicAvailability = {
    establishmentId: '10000000-0000-0000-0000-000000000001',
    date: '2026-10-25',
    elements: [{ id: '20000000-0000-0000-0000-000000000001', type: 'TABLE' }],
  };

  let api: { find: ReturnType<typeof vi.fn> };
  let store: AvailabilityStore;

  beforeEach(() => {
    api = { find: vi.fn() };
    TestBed.configureTestingModule({
      providers: [AvailabilityStore, { provide: AvailabilityApi, useValue: api }],
    });
    store = TestBed.inject(AvailabilityStore);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('carga los elementos disponibles para el día seleccionado', async () => {
    api.find.mockReturnValue(of(result));

    await store.search('demo', 'la-bahia', '2026-10-25');

    expect(api.find).toHaveBeenCalledWith('demo', 'la-bahia', '2026-10-25');
    expect(store.status()).toBe('loaded');
    expect(store.date()).toBe('2026-10-25');
    expect(store.elements()).toEqual(result.elements);
  });

  it('limpia los resultados y muestra error cuando falla la consulta', async () => {
    api.find.mockReturnValue(throwError(() => new Error('offline')));

    await store.search('demo', 'la-bahia', '2026-10-25');

    expect(store.status()).toBe('error');
    expect(store.elements()).toEqual([]);
  });

  it('ignora la respuesta de una búsqueda invalidada al cambiar de establecimiento', async () => {
    const pendingResponse = new Subject<PublicAvailability>();
    api.find.mockReturnValue(pendingResponse);

    const pending = store.search('demo', 'la-bahia', '2026-10-25');
    store.reset();
    pendingResponse.next(result);
    pendingResponse.complete();
    await pending;

    expect(store.status()).toBe('idle');
    expect(store.elements()).toEqual([]);
  });
});
