import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Person, Reservation } from '@mapit/api-client';
import { of, Subject } from 'rxjs';
import { EstablishmentContext } from '../../../core/establishment-context';
import { ReservationsApi, type ReservationElementOption } from '../data/reservations-api';
import { ReservationFormStore } from './reservation-form-store';

const A = { id: 'a', name: 'Centro', timezone: 'America/La_Paz', canCheckIn: true };
const B = { id: 'b', name: 'Norte', timezone: 'UTC', canCheckIn: true };
const PERSON: Person = { id: 'person', fullName: 'Ana', createdAt: '', updatedAt: '' };
const ELEMENT: ReservationElementOption = {
  id: 'element',
  type: 'TABLE',
  state: 'AVAILABLE',
  floorName: 'PB',
  sectorName: 'Salón',
};
const RESERVATION: Reservation = {
  id: 'reservation',
  establishmentId: 'a',
  personId: 'person',
  spaceElementIds: new Set(['element']),
  startsAt: '2026-10-04T16:00:00.000Z',
  endsAt: '2026-10-04T17:00:00.000Z',
  status: 'CREATED',
  createdAt: '',
  createdBy: 'user',
};

describe('ReservationFormStore', () => {
  const active = signal<typeof A | typeof B | null>(A);
  const status = signal<'idle' | 'loading' | 'ready' | 'error'>('ready');
  const listReservableElements = vi.fn(() => of([ELEMENT]));
  const createReservation = vi.fn(() => of(RESERVATION));
  let store: ReservationFormStore;
  beforeEach(() => {
    vi.clearAllMocks();
    active.set(A);
    status.set('ready');
    listReservableElements.mockReturnValue(of([ELEMENT]));
    createReservation.mockReturnValue(of(RESERVATION));
    TestBed.configureTestingModule({
      providers: [
        ReservationFormStore,
        { provide: EstablishmentContext, useValue: { active, status } },
        { provide: ReservationsApi, useValue: { listReservableElements, createReservation } },
      ],
    });
    store = TestBed.inject(ReservationFormStore);
    TestBed.flushEffects();
  });

  it('loads only the ready active establishment and derives its identity', () => {
    expect(store.establishmentId()).toBe('a');
    expect(store.establishmentName()).toBe('Centro');
    expect(listReservableElements).toHaveBeenCalledWith('a');
    expect(store.elements()).toEqual([ELEMENT]);
    expect(store).not.toHaveProperty('establishments');
  });

  it('waits for ready context, resets on scope change and rejects late data including A/B/A', () => {
    status.set('loading');
    TestBed.flushEffects();
    expect(store.elements()).toEqual([]);
    expect(listReservableElements).toHaveBeenCalledTimes(1);
    const stale = new Subject<ReservationElementOption[]>();
    listReservableElements.mockReturnValueOnce(stale);
    status.set('ready');
    TestBed.flushEffects();
    active.set(B);
    TestBed.flushEffects();
    active.set(A);
    TestBed.flushEffects();
    stale.next([{ ...ELEMENT, id: 'stale' }]);
    expect(store.elements()).toEqual([ELEMENT]);
    expect(listReservableElements).toHaveBeenLastCalledWith('a');
  });

  it('clears draft if context changes immediately and refuses elements outside loaded scope', () => {
    store.toggleElement('fake', true);
    expect(store.selectedElementIds().size).toBe(0);
    store.toggleElement(ELEMENT.id, true);
    active.set(B);
    store.submit();
    expect(createReservation).not.toHaveBeenCalled();
    expect(store.selectedElementIds().size).toBe(1); // effect owns reset at next turn
    TestBed.flushEffects();
    expect(store.selectedElementIds().size).toBe(0);
  });

  it('sends active timezone and only loaded elements; blocks duplicate submits', () => {
    store.setPerson(PERSON);
    store.setStartsAt('2026-10-04T12:00');
    store.setEndsAt('2026-10-04T13:00');
    store.toggleElement(ELEMENT.id, true);
    store.submit();
    expect(createReservation).toHaveBeenCalledWith('a', {
      personId: 'person',
      spaceElementIds: new Set(['element']),
      startsAt: '2026-10-04T16:00:00.000Z',
      endsAt: '2026-10-04T17:00:00.000Z',
    });
    expect(store.busy()).toBe(false);
    expect(store.created()).toEqual(RESERVATION);
    expect(store.dirty()).toBe(false);
    store.startAnother();
    expect(store.created()).toBeNull();
    expect(store.dirty()).toBe(false);
  });

  it('blocks submit until context is active/ready and exposes dirty/busy contract', () => {
    status.set('idle');
    TestBed.flushEffects();
    store.setPerson(PERSON);
    store.submit();
    expect(createReservation).not.toHaveBeenCalled();
    expect(store.busy()).toBe(false);
    expect(store.dirty()).toBe(true);
  });
});
