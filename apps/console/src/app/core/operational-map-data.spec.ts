import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ReservationsService, SpacesService, type Reservation } from '@mapit/api-client';
import { AuthSession } from '@mapit/auth';
import { FeatureFlagService } from '@mapit/feature-flags';
import { RealtimeClient } from '@mapit/realtime';
import { NEVER, of } from 'rxjs';
import { EstablishmentContext } from './establishment-context';
import {
  availableQuickElements,
  reservationIncidents,
  OperationalMapData,
  type LocatedElement,
} from './operational-map-data';

const NOW = Date.parse('2026-11-18T19:00:00Z');
const minute = 60_000;
const at = (offset: number) => new Date(NOW + offset * minute).toISOString();
const thresholds = { critical: 5, urgent: 20, preventive: 45 };

function table(
  id: string,
  state: LocatedElement['element']['state'],
  capacity = 4,
): LocatedElement {
  return {
    floorId: id,
    floorName: id,
    sectorId: id,
    sectorName: id,
    element: {
      id,
      type: 'TABLE',
      label: id,
      state,
      capacity,
      position: { x: 0, y: 0 },
      size: { width: 80, height: 80 },
      rotation: 0,
      reservable: true,
      attributes: {},
    },
  };
}

function reservation(elementId: string, starts: number, ends: number): Reservation {
  return {
    id: elementId,
    establishmentId: 'restaurant',
    personId: 'person',
    spaceElementIds: new Set([elementId]),
    status: 'CONFIRMED',
    startsAt: at(starts),
    endsAt: at(ends),
    createdAt: at(-180),
    createdBy: 'staff',
  };
}

describe('operational reservation data', () => {
  it('loads only scoped reservation pages when the signed-in role is STAFF', () => {
    const items = [
      {
        ...reservation('past', -120, -30),
        endsAt: new Date(Date.now() - 3_600_000).toISOString(),
        spaceElementIds: ['past'],
      },
      {
        ...reservation('next', 5, 90),
        endsAt: new Date(Date.now() + 3_600_000).toISOString(),
        spaceElementIds: ['next'],
      },
    ];
    const scoped = vi.fn(({ offset }: { offset: number }) =>
      of({ items: items.slice(offset, offset + 1), total: items.length, limit: 1, offset }),
    );
    const general = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: SpacesService, useValue: { listFloorsByEstablishment: () => of([]) } },
        {
          provide: ReservationsService,
          useValue: { listReservations: general, listEstablishmentReservations: scoped },
        },
        { provide: AuthSession, useValue: { user: () => ({ role: 'STAFF' }) } },
        { provide: FeatureFlagService, useValue: { isEnabled: () => signal(true) } },
        {
          provide: EstablishmentContext,
          useValue: { status: () => 'ready', active: () => ({ id: 'restaurant' }) },
        },
        {
          provide: RealtimeClient,
          useValue: {
            connect: vi.fn(),
            connectionState: signal('connected'),
            subscribeEstablishment: () => NEVER,
            subscribeEstablishmentPayments: () => NEVER,
            subscribeEstablishmentReservations: () => NEVER,
          },
        },
      ],
    });
    const data = TestBed.inject(OperationalMapData);
    TestBed.tick();

    expect(general).not.toHaveBeenCalled();
    expect(scoped.mock.calls.map(([request]) => request.offset)).toEqual([0, 1]);
    expect(data.status()).toBe('ready');
    expect(data.reservations().map(({ id }) => id)).toEqual(['next']);
  });

  it('reclassifies a conflict when time passes and resolves it when the table is ready', () => {
    const bookings = [reservation('one', 42, 132)];
    const occupied = [table('one', 'OCCUPIED'), table('two', 'CLEANING')];
    expect(reservationIncidents(occupied, bookings, NOW, thresholds)).toMatchObject([
      { priority: 'preventive', conflict: true, minutes: 42 },
    ]);
    expect(reservationIncidents(occupied, bookings, NOW + 22 * minute, thresholds)).toMatchObject([
      { priority: 'urgent', conflict: true, minutes: 20 },
    ]);
    expect(reservationIncidents(occupied, bookings, NOW + 38 * minute, thresholds)).toMatchObject([
      { priority: 'critical', conflict: true, minutes: 4 },
    ]);
    expect(
      reservationIncidents([table('one', 'AVAILABLE')], bookings, NOW + 38 * minute, thresholds),
    ).toMatchObject([{ priority: 'preventive', conflict: false, minutes: 4 }]);
    expect(reservationIncidents(occupied, bookings, NOW + 132 * minute, thresholds)).toEqual([]);
  });

  it('searches across floors and checks capacity, preparation and booking overlap', () => {
    const options = [
      table('previous', 'AVAILABLE'),
      table('next', 'AVAILABLE'),
      table('occupied', 'OCCUPIED'),
      table('unavailable', 'OUT_OF_SERVICE'),
      table('small', 'AVAILABLE', 2),
      table('first-floor', 'AVAILABLE', 6),
      table('second-floor', 'AVAILABLE', 4),
    ];
    const bookings = [reservation('previous', -80, 1), reservation('next', 116, 206)];
    expect(
      availableQuickElements(options, bookings, at(13), at(103), 4, NOW).map(
        (item) => item.floorId,
      ),
    ).toEqual(['second-floor', 'first-floor']);
  });
});
