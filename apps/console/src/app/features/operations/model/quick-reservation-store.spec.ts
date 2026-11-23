import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PeopleService, ReservationsService, type Reservation } from '@mapit/api-client';
import { of, Subject, throwError } from 'rxjs';
import { OperationalMapData, type LocatedElement } from '../../../core/operational-map-data';
import { QuickReservationStore } from './quick-reservation-store';
import { SpaceMonitorStore } from './space-monitor-store';

const mesa: LocatedElement = {
  floorId: 'floor',
  floorName: 'Planta baja',
  sectorId: 'sector',
  sectorName: 'Salón',
  element: {
    id: 'table',
    type: 'TABLE',
    label: 'Mesa 1',
    state: 'AVAILABLE',
    capacity: 4,
    position: { x: 0, y: 0 },
    size: { width: 80, height: 80 },
    rotation: 0,
    reservable: true,
    attributes: {},
  },
};

describe('QuickReservationStore', () => {
  const selection = signal<LocatedElement['element'] | null>(mesa.element);
  const reservations = signal<Reservation[]>([]);
  const snapshot = signal({});
  const refresh = vi.fn();
  const searchPeople = vi.fn();
  const createPerson = vi.fn();
  const createReservation = vi.fn();
  let store: QuickReservationStore;

  beforeEach(() => {
    vi.resetAllMocks();
    selection.set(mesa.element);
    reservations.set([]);
    snapshot.set({});
    searchPeople.mockReturnValue(
      of([{ id: 'customer', phone: '+591 70012345', fullName: 'Ana Pérez' }]),
    );
    TestBed.configureTestingModule({
      providers: [
        QuickReservationStore,
        { provide: PeopleService, useValue: { searchPeople, createPerson } },
        { provide: ReservationsService, useValue: { createReservation } },
        {
          provide: SpaceMonitorStore,
          useValue: {
            selected: selection,
            establishment: () => ({ id: 'local', timezone: 'America/La_Paz' }),
            floors: () => [{ id: mesa.floorId, name: mesa.floorName }],
            floorId: () => mesa.floorId,
            sector: () => ({ name: mesa.sectorName }),
          },
        },
        {
          provide: OperationalMapData,
          useValue: {
            snapshot,
            reservations,
            refresh,
            status: () => 'ready',
            now: () => Date.parse('2026-11-22T16:00:00Z'),
            elements: () => [mesa],
          },
        },
      ],
    });
    store = TestBed.inject(QuickReservationStore);
    TestBed.tick();
  });

  function draft(): void {
    store.update('name', ' Ana Pérez ');
    store.update('phone', '700-12345');
    store.update('date', '2026-11-22');
    store.update('time', '18:00');
    store.update('notes', ' Ventana ');
    TestBed.tick();
  }

  it('requires a fresh availability snapshot and validates phone, email, capacity and time', () => {
    draft();
    expect(refresh).toHaveBeenCalledOnce();
    expect(store.availability()).toBe('checking');
    expect(store.canSubmit()).toBe(false);
    snapshot.set({});
    expect(store.canSubmit()).toBe(true);
    store.update('phone', '123');
    expect(store.canSubmit()).toBe(false);
    store.update('phone', '70012345');
    store.update('email', 'ana');
    expect(store.canSubmit()).toBe(false);
    store.update('email', '');
    store.update('people', 5);
    expect(store.canSubmit()).toBe(false);
    store.update('people', 2);
    store.update('time', '11:00');
    expect(store.availability()).toBe('unavailable');
  });

  it('submits once while pending, keeps the selected table and refreshes after success', () => {
    const response = new Subject<object>();
    createReservation.mockReturnValue(response);
    draft();
    snapshot.set({});
    store.submit();
    store.submit();
    expect(store.busy()).toBe(true);
    expect(searchPeople).toHaveBeenCalledExactlyOnceWith({ query: 'Ana Pérez' });
    expect(createPerson).not.toHaveBeenCalled();
    expect(createReservation).toHaveBeenCalledExactlyOnceWith({
      establishmentId: 'local',
      reservationCreateRequest: {
        personId: 'customer',
        spaceElementIds: ['table'],
        startsAt: '2026-11-22T22:00:00.000Z',
        endsAt: '2026-11-22T23:30:00.000Z',
        partySize: 2,
        notes: 'Ventana',
      },
    });
    response.next({ id: 'booking' });
    response.complete();
    expect(store.busy()).toBe(false);
    expect(store.succeeded()).toBe(true);
    expect(store.draft().name).toBe('');
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('preserves the draft and blocks retries for the same interval after a server conflict', () => {
    createReservation.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    draft();
    snapshot.set({});
    store.submit();
    expect(store.availability()).toBe('unavailable');
    expect(store.draft().notes).toBe(' Ventana ');
    store.submit();
    expect(createReservation).toHaveBeenCalledOnce();
    store.update('time', '20:00');
    TestBed.tick();
    snapshot.set({});
    expect(store.canSubmit()).toBe(true);
  });

  it('does not create a reservation after losing selection during contact lookup', () => {
    const lookup = new Subject<object[]>();
    searchPeople.mockReturnValue(lookup);
    draft();
    snapshot.set({});
    store.submit();
    selection.set(null);
    lookup.next([]);
    lookup.complete();
    expect(createPerson).not.toHaveBeenCalled();
    expect(createReservation).not.toHaveBeenCalled();
    expect(store.busy()).toBe(false);
  });
});
