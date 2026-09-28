import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { SpaceElement } from '@mapit/api-client';
import type { RealtimeEventEnvelope } from '@mapit/realtime';
import { of, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LIVE_FALLBACK_POLL_MS, SpacesStore } from './spaces-store';
import { SpacesApiService } from '../data/spaces-api';
import { SpaceElementsRealtime } from '../data/space-elements-realtime';

const EST = '0199a000-0000-7000-8000-000000000001';
const SECTOR_A = '0199a000-0000-7000-8000-00000000000a';
const SECTOR_B = '0199a000-0000-7000-8000-00000000000b';
const EL_1 = '0199a000-0000-7000-8000-000000000101';
const EL_2 = '0199a000-0000-7000-8000-000000000102';

function element(id: string, sectorId: string): SpaceElement {
  return {
    id,
    sectorId,
    type: 'TABLE',
    x: 1,
    y: 2,
    state: 'AVAILABLE',
    createdAt: '2026-09-27T00:00:00Z',
    updatedAt: '2026-09-27T00:00:00Z',
  };
}

function stateChanged(
  spaceElementId: string,
  state: 'OCCUPIED' | 'CLEANING',
  sectorId = SECTOR_A,
): RealtimeEventEnvelope {
  return {
    eventId: `${spaceElementId}-${state}`,
    eventType: 'space-element.state.changed.v1',
    schemaVersion: 1,
    occurredAt: '2026-09-27T12:00:00Z',
    establishmentId: EST,
    sectorId,
    aggregateVersion: 1,
    payload: { spaceElementId, previousState: 'AVAILABLE', state },
  };
}

/** Reglas del ViewModel en vivo (HU-3.02 / MAP-149-150), con la capa de datos simulada. */
describe('SpacesStore — elementos en tiempo real', () => {
  let rooms: Map<string, Subject<RealtimeEventEnvelope>>;
  let realtime: {
    connectionState: ReturnType<typeof signal>;
    sectorEvents: ReturnType<typeof vi.fn>;
  };
  let store: SpacesStore;
  let api: {
    listSpaceElementsBySector: ReturnType<typeof vi.fn>;
    listFloors: ReturnType<typeof vi.fn>;
  };

  afterEach(() => vi.useRealTimers());

  beforeEach(() => {
    rooms = new Map();
    realtime = {
      connectionState: signal('connected'),
      sectorEvents: vi.fn((establishmentId: string, sectorId: string) => {
        const room = new Subject<RealtimeEventEnvelope>();
        rooms.set(`${establishmentId}/${sectorId}`, room);
        return room;
      }),
    };
    api = {
      listSpaceElementsBySector: vi.fn((sectorId: string) =>
        of([element(EL_1, sectorId), element(EL_2, sectorId)]),
      ),
      listFloors: vi.fn().mockReturnValue(of([])),
    };
    TestBed.configureTestingModule({
      providers: [
        SpacesStore,
        { provide: SpacesApiService, useValue: api },
        { provide: SpaceElementsRealtime, useValue: realtime },
      ],
    });
    store = TestBed.inject(SpacesStore);
    store.loadSpaceElementsBySector(SECTOR_A);
  });

  it('se suscribe solo a la sala del sector abierto, con el establecimiento del contexto', () => {
    const watch = store.watchSectorLive(SECTOR_A, EST);

    expect(realtime.sectorEvents).toHaveBeenCalledTimes(1);
    expect(realtime.sectorEvents).toHaveBeenCalledWith(EST, SECTOR_A);
    watch.unsubscribe();
  });

  it('al cambiar de sector suelta la sala anterior y no duplica suscripciones', () => {
    const first = store.watchSectorLive(SECTOR_A, EST);
    first.unsubscribe();
    const second = store.watchSectorLive(SECTOR_B, EST);

    expect(rooms.get(`${EST}/${SECTOR_A}`)?.observed).toBe(false);
    expect(rooms.get(`${EST}/${SECTOR_B}`)?.observed).toBe(true);
    second.unsubscribe();
  });

  it('no construye salas sin establecimiento o con identificadores mal formados', () => {
    store.watchSectorLive(SECTOR_A, null).unsubscribe();
    store.watchSectorLive(SECTOR_A, '../otro-tenant').unsubscribe();
    store.watchSectorLive('sector-inventado', EST).unsubscribe();

    expect(realtime.sectorEvents).not.toHaveBeenCalled();
  });

  it('un evento recibido actualiza el estado del elemento sin recargar', () => {
    const watch = store.watchSectorLive(SECTOR_A, EST);
    const before = store.elementsBySector()[SECTOR_A];

    rooms.get(`${EST}/${SECTOR_A}`)?.next(stateChanged(EL_1, 'OCCUPIED'));

    const after = store.elementsBySector()[SECTOR_A];
    expect(after?.find((e) => e.id === EL_1)?.state).toBe('OCCUPIED');
    // Inmutable: lista nueva, el elemento no afectado conserva su referencia.
    expect(after).not.toBe(before);
    expect(after?.[1]).toBe(before?.[1]);
    watch.unsubscribe();
  });

  it('un evento sin cambio real o de un elemento ajeno no toca el estado', () => {
    const before = store.elementsBySector();

    store.applyRealtimeStateChange({
      ...stateChanged(EL_1, 'OCCUPIED'),
      payload: { spaceElementId: EL_1, state: 'AVAILABLE' },
    });
    store.applyRealtimeStateChange(stateChanged('no-existe', 'OCCUPIED'));
    store.applyRealtimeStateChange(stateChanged(EL_1, 'OCCUPIED', SECTOR_B));

    expect(store.elementsBySector()).toBe(before);
  });

  it('marca la vista en vivo solo con sala abierta y socket conectado', () => {
    expect(store.liveStatus()).toBe('polling');

    const watch = store.watchSectorLive(SECTOR_A, EST);
    expect(store.liveStatus()).toBe('live');

    realtime.connectionState.set('disconnected');
    expect(store.liveStatus()).toBe('polling');

    realtime.connectionState.set('connected');
    watch.unsubscribe();
    expect(store.liveStatus()).toBe('polling');
  });

  it('con la flag apagada o sin conexión, se actualiza por sondeo HTTP', () => {
    vi.useFakeTimers();
    realtime.connectionState.set('disabled');
    const watch = store.watchSectorLive(SECTOR_A, EST);
    api.listSpaceElementsBySector.mockClear();

    vi.advanceTimersByTime(LIVE_FALLBACK_POLL_MS);
    expect(api.listSpaceElementsBySector).toHaveBeenCalledWith(SECTOR_A);

    watch.unsubscribe();
    api.listSpaceElementsBySector.mockClear();
    vi.advanceTimersByTime(LIVE_FALLBACK_POLL_MS * 3);
    expect(api.listSpaceElementsBySector).not.toHaveBeenCalled();
  });

  it('en vivo no sondea: los cambios llegan por el socket', () => {
    vi.useFakeTimers();
    const watch = store.watchSectorLive(SECTOR_A, EST);
    api.listSpaceElementsBySector.mockClear();

    vi.advanceTimersByTime(LIVE_FALLBACK_POLL_MS * 3);

    expect(api.listSpaceElementsBySector).not.toHaveBeenCalled();
    watch.unsubscribe();
  });
});
