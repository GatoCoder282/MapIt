import { TestBed } from '@angular/core/testing';
import type { Reservation } from '@mapit/api-client';
import {
  EstablishmentsService,
  PeopleService,
  ReservationsService,
  SpacesService,
} from '@mapit/api-client';
import { firstValueFrom, of } from 'rxjs';

import { ReservationsApi } from './reservations-api';

describe('ReservationsApi', () => {
  const listFloorsByEstablishment = vi.fn(() =>
    of([
      {
        id: 'floor-1',
        name: 'Planta baja',
        slug: 'planta-baja',
        level: 0,
        createdAt: '',
        updatedAt: '',
      },
    ]),
  );
  const listSectorsByFloor = vi.fn(() =>
    of([{ id: 'sector-1', name: 'Salón', slug: 'salon', createdAt: '', updatedAt: '' }]),
  );
  const listSpaceElementsBySector = vi.fn(() =>
    of([
      {
        id: 'table-1',
        sectorId: 'sector-1',
        type: 'TABLE' as const,
        state: 'AVAILABLE' as const,
        x: 0,
        y: 0,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'bar-1',
        sectorId: 'sector-1',
        type: 'BAR' as const,
        state: 'AVAILABLE' as const,
        x: 0,
        y: 0,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'zone-1',
        sectorId: 'sector-1',
        type: 'SECTOR_ZONE' as const,
        state: 'AVAILABLE' as const,
        x: 1,
        y: 1,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'stage-1',
        sectorId: 'sector-1',
        type: 'STAGE' as const,
        state: 'AVAILABLE' as const,
        x: 1,
        y: 1,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'decor-1',
        sectorId: 'sector-1',
        type: 'DECOR' as const,
        state: 'AVAILABLE' as const,
        x: 1,
        y: 1,
        createdAt: '',
        updatedAt: '',
      },
    ]),
  );
  const created: Reservation = {
    id: 'reservation-1',
    establishmentId: 'establishment-1',
    personId: 'person-1',
    spaceElementIds: new Set(['table-1']),
    startsAt: '2026-10-04T16:00:00Z',
    endsAt: '2026-10-04T17:00:00Z',
    status: 'CREATED',
    createdAt: '2026-10-04T13:00:00Z',
    createdBy: 'user-1',
  };
  const createReservation = vi.fn(() => of(created));
  let api: ReservationsApi;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        ReservationsApi,
        { provide: PeopleService, useValue: {} },
        { provide: EstablishmentsService, useValue: {} },
        {
          provide: SpacesService,
          useValue: {
            listFloorsByEstablishment,
            listSectorsByFloor,
            listSpaceElementsBySector,
          },
        },
        { provide: ReservationsService, useValue: { createReservation } },
      ],
    });
    api = TestBed.inject(ReservationsApi);
  });

  it('arma las opciones con sus nombres de ubicación y descarta la decoración', async () => {
    const result = await firstValueFrom(api.listReservableElements('establishment-1'));

    // HU-7.01/7.02: qué tipos se reservan lo decide el perfil de vertical en el ViewModel
    // (una zona es reservable en una discoteca); aquí solo se excluye la decoración.
    const option = (id: string, type: string) => ({
      id,
      type,
      label: null,
      state: 'AVAILABLE',
      floorName: 'Planta baja',
      sectorName: 'Salón',
    });
    expect(result).toEqual([
      option('table-1', 'TABLE'),
      option('bar-1', 'BAR'),
      option('zone-1', 'SECTOR_ZONE'),
      option('stage-1', 'STAGE'),
    ]);
  });

  it('convierte el Set generado por OpenAPI en un arreglo JSON serializable', async () => {
    await firstValueFrom(
      api.createReservation('establishment-1', {
        personId: 'person-1',
        spaceElementIds: new Set(['table-1']),
        startsAt: '2026-10-04T16:00:00Z',
        endsAt: '2026-10-04T17:00:00Z',
      }),
    );

    expect(createReservation).toHaveBeenCalledWith({
      establishmentId: 'establishment-1',
      reservationCreateRequest: {
        personId: 'person-1',
        spaceElementIds: ['table-1'],
        startsAt: '2026-10-04T16:00:00Z',
        endsAt: '2026-10-04T17:00:00Z',
      },
    });
  });
});
