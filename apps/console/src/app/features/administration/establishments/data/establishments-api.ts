import { Injectable, inject } from '@angular/core';
import { EstablishmentsService } from '@mapit/api-client';
import type {
  Establishment,
  EstablishmentCreateRequest,
  EstablishmentUpdateRequest,
} from '@mapit/api-client';
import type { Observable } from 'rxjs';

/** Adaptador de datos de establecimientos: la feature solo conoce este API tipado. */
@Injectable({ providedIn: 'root' })
export class EstablishmentsApi {
  private readonly client = inject(EstablishmentsService);

  list(): Observable<Establishment[]> {
    return this.client.listEstablishments();
  }

  create(request: EstablishmentCreateRequest): Observable<Establishment> {
    return this.client.createEstablishment({ establishmentCreateRequest: request });
  }

  update(id: string, request: EstablishmentUpdateRequest): Observable<Establishment> {
    return this.client.updateEstablishment({ id, establishmentUpdateRequest: request });
  }

  delete(id: string): Observable<unknown> {
    return this.client.deleteEstablishment({ id });
  }
}
