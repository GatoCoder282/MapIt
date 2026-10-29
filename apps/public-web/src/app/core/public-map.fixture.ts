import type { PublicAvailabilityMap, PublicMapElement, VerticalProfile } from '@mapit/api-client';

/** Perfiles sintéticos con las reglas de `VerticalCatalog` (HU-7.01/7.02, spec D4). */
export function verticalProfileFixture(
  type: VerticalProfile['establishmentType'] = 'RESTAURANT',
): VerticalProfile {
  const hourly = {
    minNights: null,
    maxNights: null,
    defaultStartTime: null,
    defaultEndTime: null,
  };
  switch (type) {
    case 'HOTEL':
      return {
        establishmentType: 'HOTEL',
        bookingMode: 'STAY',
        enabled: true,
        allowedElementTypes: ['ROOM', 'DECOR'],
        reservableElementTypes: ['ROOM'],
        allowsOvernight: true,
        maxDurationMinutes: null,
        minNights: 1,
        maxNights: 30,
        defaultStartTime: '15:00',
        defaultEndTime: '12:00',
      };
    case 'NIGHTCLUB':
      return {
        establishmentType: 'NIGHTCLUB',
        bookingMode: 'NIGHT',
        enabled: true,
        allowedElementTypes: ['TABLE', 'BAR', 'SECTOR_ZONE', 'STAGE', 'DECOR'],
        reservableElementTypes: ['TABLE', 'BAR', 'SECTOR_ZONE'],
        allowsOvernight: true,
        maxDurationMinutes: 720,
        ...hourly,
      };
    case 'EVENT_HALL':
      return {
        establishmentType: 'EVENT_HALL',
        bookingMode: 'EVENT',
        enabled: true,
        allowedElementTypes: ['TABLE', 'BAR', 'SECTOR_ZONE', 'STAGE', 'SEAT', 'DECOR'],
        reservableElementTypes: ['TABLE', 'SECTOR_ZONE', 'SEAT'],
        allowsOvernight: true,
        maxDurationMinutes: 1440,
        ...hourly,
      };
    default:
      return {
        establishmentType: 'RESTAURANT',
        bookingMode: 'SHIFT',
        enabled: true,
        allowedElementTypes: ['TABLE', 'BAR', 'SECTOR_ZONE', 'STAGE', 'DECOR'],
        reservableElementTypes: ['TABLE', 'BAR', 'SECTOR_ZONE'],
        allowsOvernight: false,
        maxDurationMinutes: 360,
        ...hourly,
      };
  }
}

/** Synthetic data for public selection unit tests only. */
export function publicMapFixture(): PublicAvailabilityMap {
  const element: PublicMapElement = {
    id: 'space-a',
    type: 'ROOM',
    label: null,
    name: 'Habitación sin nombre',
    capacity: null,
    x: 120,
    y: 60,
    width: 100,
    height: 80,
    rotation: 15,
    selectable: true,
    availability: 'AVAILABLE',
  };
  return {
    establishmentId: 'venue-id',
    establishmentName: 'Local de prueba',
    tenantSlug: 'tenant-a',
    establishmentSlug: 'venue-a',
    timezone: 'America/La_Paz',
    date: '2030-12-24',
    startTime: '19:00',
    endDate: '2030-12-24',
    endTime: '21:00',
    startsAt: '2030-12-24T23:00:00Z',
    endsAt: '2030-12-25T01:00:00Z',
    mode: 'INTERVAL',
    vertical: verticalProfileFixture(),
    floors: [
      {
        id: 'floor-a',
        name: 'Planta baja',
        level: 0,
        canvasWidth: 1200,
        canvasHeight: 800,
        sectors: [
          {
            id: 'sector-a',
            name: 'Salón',
            width: 1000,
            height: 600,
            x: 100,
            y: 50,
            rotation: 30,
            elements: [
              element,
              {
                ...element,
                id: 'space-b',
                type: 'SEAT',
                name: 'Butaca',
                label: 'Butaca',
                capacity: 1,
                x: 300,
              },
              { ...element, id: 'reserved', availability: 'RESERVED', selectable: false },
              { ...element, id: 'unavailable', availability: 'UNAVAILABLE', selectable: false },
            ],
          },
          {
            id: 'sector-b',
            name: 'Terraza',
            width: 700,
            height: 400,
            x: 0,
            y: 0,
            rotation: 0,
            elements: [{ ...element, id: 'space-c' }],
          },
        ],
      },
      {
        id: 'floor-b',
        name: 'Primer piso',
        level: 1,
        canvasWidth: 900,
        canvasHeight: 700,
        sectors: [],
      },
    ],
  };
}
