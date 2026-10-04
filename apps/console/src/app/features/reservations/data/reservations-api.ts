import { inject, Injectable } from '@angular/core';
import type { Person, PersonCreateRequest } from '@mapit/api-client';
import { PeopleService } from '@mapit/api-client';
import type { Observable } from 'rxjs';

/** Adaptador tipado para las operaciones de cliente usadas por la reserva interna. */
@Injectable({ providedIn: 'root' })
export class ReservationsApi {
  private readonly people = inject(PeopleService);

  searchPeople(query?: string): Observable<Person[]> {
    return this.people.searchPeople(query === undefined ? {} : { query });
  }

  createPerson(request: PersonCreateRequest): Observable<Person> {
    return this.people.createPerson({ personCreateRequest: request });
  }
}
