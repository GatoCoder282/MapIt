import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OperationsService, SpacesService, type SpaceElement } from '@mapit/api-client';
import { AuthSession } from '@mapit/auth';
import {
  RealtimeClient,
  type RealtimeConnectionState,
  type RealtimeEventEnvelope,
} from '@mapit/realtime';
import { of, Subject } from 'rxjs';
import { EstablishmentContext } from '../../../core/establishment-context';
import { OperationalMapData } from '../../../core/operational-map-data';
import { SpaceMonitorStore } from './space-monitor-store';

describe('SpaceMonitorStore', () => {
  const element = (
    id: string,
    state: SpaceElement['state'] = 'AVAILABLE',
    sectorId = 'sector-a',
  ): SpaceElement => ({
    id,
    sectorId,
    state,
    type: 'TABLE',
    x: 30,
    y: 40,
    width: 80,
    height: 80,
    rotation: 0,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  });
  const active = signal({ id: 'est-a', name: 'A' });
  const role = signal('ADMIN');
  const connection = signal<RealtimeConnectionState>('disconnected');
  const now = signal(Date.parse('2026-11-26T20:00:00Z'));
  const reservations = signal<ReturnType<OperationalMapData['reservations']>>([]);
  let events: Subject<RealtimeEventEnvelope>;
  let store: SpaceMonitorStore;
  const getElements = vi.fn(() => of([element('table-1')]));
  const getFloorLayout = vi.fn();
  const changeState = vi.fn(() => of({}));
  const getFloors = vi.fn(({ establishmentId }: { establishmentId: string }) =>
    of([{ id: establishmentId === 'est-a' ? 'floor-a' : 'floor-b', name: 'Piso' }]),
  );
  const getSectors = vi.fn(({ floorId }: { floorId: string }) =>
    of([
      {
        id: floorId === 'floor-a' ? 'sector-a' : 'sector-b',
        name: 'Comedor',
        width: 400,
        height: 300,
      },
    ]),
  );
  const event: RealtimeEventEnvelope = {
    eventId: 'event',
    eventType: 'space-element.state.changed.v1',
    schemaVersion: 1,
    occurredAt: '2026-10-01T00:00:00Z',
    establishmentId: 'est-a',
    sectorId: 'sector-a',
    aggregateVersion: 1,
    payload: { spaceElementId: 'table-1', state: 'OCCUPIED' },
  };

  beforeEach(() => {
    vi.useFakeTimers();
    now.set(Date.parse('2026-11-26T20:00:00Z'));
    reservations.set([]);
    changeState.mockClear();
    getElements.mockReset().mockReturnValue(of([element('table-1')]));
    getFloorLayout.mockReset().mockReturnValue(
      of({
        floor: { id: 'floor-a' },
        sectors: [{ id: 'sector-a', elements: [element('table-1')] }],
      }),
    );
    active.set({ id: 'est-a', name: 'A' });
    role.set('ADMIN');
    connection.set('disconnected');
    events = new Subject();
    TestBed.configureTestingModule({
      providers: [
        SpaceMonitorStore,
        {
          provide: OperationalMapData,
          useValue: {
            now,
            status: () => 'ready',
            incidents: () => [],
            reservations,
            refresh: vi.fn(),
          },
        },
        { provide: OperationsService, useValue: { updateSpaceElementState: changeState } },
        { provide: AuthSession, useValue: { user: () => ({ role: role() }) } },
        { provide: EstablishmentContext, useValue: { active, status: () => 'ready' } },
        {
          provide: RealtimeClient,
          useValue: {
            connectionState: connection,
            connect: vi.fn(),
            subscribeEstablishment: () => events,
          },
        },
        {
          provide: SpacesService,
          useValue: {
            listFloorsByEstablishment: getFloors,
            listSectorsByFloor: getSectors,
            listSpaceElementsBySector: getElements,
            getFloorLayout,
          },
        },
      ],
    });
    store = TestBed.inject(SpaceMonitorStore);
    TestBed.tick();
  });

  afterEach(() => vi.useRealTimers());

  function reserve() {
    reservations.set([
      {
        id: 'booking',
        status: 'CONFIRMED',
        startsAt: '2026-11-26T20:00:00Z',
        endsAt: '2026-11-26T21:00:00Z',
        spaceElementIds: ['table-1'],
        customerName: 'Cliente',
        partySize: 2,
      },
    ]);
  }

  it('projects a current reservation into the map, selection and counts without changing the physical snapshot', () => {
    reserve();
    store.selectedId.set('table-1');
    expect(store.selected()?.state).toBe('RESERVED');
    expect(store.counts()).toMatchObject({ AVAILABLE: 0, RESERVED: 1 });
    expect(changeState).not.toHaveBeenCalled();
    store.updateSelectedState('OCCUPIED');
    expect(changeState).toHaveBeenLastCalledWith({
      sectorId: 'sector-a',
      elementId: 'table-1',
      spaceElementStateUpdateRequest: { state: 'OCCUPIED', expectedState: 'AVAILABLE' },
    });
  });

  it('updates at the start and end boundaries and when a reservation is cancelled', () => {
    reserve();
    now.set(Date.parse('2026-11-26T19:59:59Z'));
    expect(store.counts().AVAILABLE).toBe(1);
    now.set(Date.parse('2026-11-26T20:00:00Z'));
    expect(store.counts().RESERVED).toBe(1);
    now.set(Date.parse('2026-11-26T21:00:00Z'));
    expect(store.counts().AVAILABLE).toBe(1);
    now.set(Date.parse('2026-11-26T20:30:00Z'));
    reservations.update((items) => items.map((item) => ({ ...item, status: 'CANCELLED' })));
    expect(store.counts().AVAILABLE).toBe(1);
  });

  it.each(['OCCUPIED', 'CLEANING', 'OUT_OF_SERVICE', 'RESERVED'] as const)(
    'preserves physical state %s despite an ongoing reservation',
    (state) => {
      reserve();
      getElements.mockReturnValue(of([element('table-1', state)]));
      connection.set('connected');
      TestBed.tick();
      expect(store.layout().elements[0]?.state).toBe(state);
      expect(store.counts()[state]).toBe(1);
    },
  );

  it('refreshes counts once for duplicate events and again on reconnection', () => {
    expect(store.counts().AVAILABLE).toBe(1);
    getElements.mockReturnValue(of([element('table-1', 'OCCUPIED')]));
    getElements.mockClear();
    events.next(event);
    events.next(event);
    vi.advanceTimersByTime(80);
    expect(getElements).toHaveBeenCalledOnce();
    expect(store.counts()).toMatchObject({ AVAILABLE: 0, OCCUPIED: 1 });
    getElements.mockReturnValue(of([element('table-1', 'CLEANING')]));
    connection.set('connected');
    TestBed.tick();
    expect(store.counts()).toMatchObject({ OCCUPIED: 0, CLEANING: 1 });
  });

  it('drops late data and events from a previous establishment', () => {
    const prior = new Subject<SpaceElement[]>();
    getElements.mockReturnValueOnce(prior);
    connection.set('connected');
    TestBed.tick();
    active.set({ id: 'est-b', name: 'B' });
    expect(store.layout().elements).toEqual([]);
    getElements.mockReturnValue(of([element('new', 'RESERVED', 'sector-b'), element('old')]));
    TestBed.tick();
    prior.next([element('late')]);
    events.next(event);
    vi.advanceTimersByTime(80);
    expect(store.layout().elements.map(({ id }) => id)).toEqual(['new']);
    expect(store.counts().RESERVED).toBe(1);
  });

  it('uses the read-only layout for staff', () => {
    role.set('STAFF');
    getElements.mockClear();
    TestBed.tick();
    expect(store.canEdit()).toBe(false);
    expect(getFloorLayout).toHaveBeenCalledWith({ floorId: 'floor-a' });
    expect(getElements).not.toHaveBeenCalled();
    expect(store.layout().elements[0]?.id).toBe('table-1');
  });

  it('retains the selected table after an authorized state update', () => {
    store.selectedId.set('table-1');
    getElements.mockReturnValue(of([element('table-1', 'OUT_OF_SERVICE')]));
    store.updateSelectedState('OUT_OF_SERVICE');
    TestBed.tick();

    expect(changeState).toHaveBeenCalledWith({
      sectorId: 'sector-a',
      elementId: 'table-1',
      spaceElementStateUpdateRequest: { state: 'OUT_OF_SERVICE', expectedState: 'AVAILABLE' },
    });
    expect(store.selected()?.state).toBe('OUT_OF_SERVICE');
  });
});
