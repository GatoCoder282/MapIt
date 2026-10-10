import { inject, Injectable } from '@angular/core';
import type {
  Establishment,
  Person,
  PersonCreateRequest,
  Reservation,
  ReservationCreateRequest,
  SpaceElement,
} from '@mapit/api-client';
import {
  EstablishmentsService,
  PeopleService,
  ReservationsService,
  SpacesService,
} from '@mapit/api-client';
import { forkJoin, map, of, switchMap, type Observable } from 'rxjs';

export interface ReservationElementOption {
  id: string;
  type: SpaceElement.TypeEnum;
  state: SpaceElement.StateEnum;
  floorName: string;
  sectorName: string;
}

/** Adaptador tipado para las operaciones de cliente usadas por la reserva interna. */
@Injectable({ providedIn: 'root' })
export class ReservationsApi {
  private readonly people = inject(PeopleService);
  private readonly establishments = inject(EstablishmentsService);
  private readonly spaces = inject(SpacesService);
  private readonly reservations = inject(ReservationsService);

  searchPeople(query?: string): Observable<Person[]> {
    return this.people.searchPeople(query === undefined ? {} : { query });
  }

  createPerson(request: PersonCreateRequest): Observable<Person> {
    return this.people.createPerson({ personCreateRequest: request });
  }

  listEstablishments(): Observable<Establishment[]> {
    return this.establishments.listEstablishments();
  }

  listReservableElements(establishmentId: string): Observable<ReservationElementOption[]> {
    return this.spaces.listFloorsByEstablishment({ establishmentId }).pipe(
      switchMap((floors) =>
        floors.length
          ? forkJoin(
              floors.map((floor) =>
                this.spaces.listSectorsByFloor({ floorId: floor.id }).pipe(
                  switchMap((sectors) =>
                    sectors.length
                      ? forkJoin(
                          sectors.map((sector) =>
                            this.spaces.listSpaceElementsBySector({ sectorId: sector.id }).pipe(
                              map((elements) =>
                                elements
                                  .filter(
                                    (element) =>
                                      element.type !== 'DECOR' &&
                                      element.state !== 'OUT_OF_SERVICE',
                                  )
                                  .map((element) => ({
                                    id: element.id,
                                    type: element.type,
                                    state: element.state,
                                    floorName: floor.name,
                                    sectorName: sector.name,
                                  })),
                              ),
                            ),
                          ),
                        ).pipe(map((groups) => groups.flat()))
                      : of([]),
                  ),
                ),
              ),
            ).pipe(map((groups) => groups.flat()))
          : of([]),
      ),
    );
  }

  createReservation(
    establishmentId: string,
    request: ReservationCreateRequest,
  ): Observable<Reservation> {
    // OpenAPI genera `Set` para uniqueItems, pero JSON necesita un arreglo real.
    const serializableRequest: ReservationCreateRequest = {
      ...request,
      spaceElementIds: [...request.spaceElementIds] as unknown as Set<string>,
    };
    return this.reservations.createReservation({
      establishmentId,
      reservationCreateRequest: serializableRequest,
    });
  }
}
