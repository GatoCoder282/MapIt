import type { Reservation } from '@mapit/api-client';
import {
  availableQuickElements,
  reservationIncidents,
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
