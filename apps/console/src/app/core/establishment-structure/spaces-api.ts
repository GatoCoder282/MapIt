import { inject, Injectable } from '@angular/core';
import type {
  Establishment,
  EstablishmentCreateRequest,
  EstablishmentUpdateRequest,
  Floor,
  Sector,
  FloorCreateRequest,
  SectorCreateRequest,
  SpaceElement,
} from '@mapit/api-client';
import { EstablishmentsService, SpacesService } from '@mapit/api-client';
import type { Observable } from 'rxjs';
import { map } from 'rxjs';

export interface FloorDraft {
  name: string;
}

export interface SectorDraft {
  name: string;
  capacity: number | undefined;
}

export interface EstablishmentDraft {
  name: string;
  type: string;
  address: string;
  timezone: string;
}

@Injectable({ providedIn: 'root' })
export class SpacesApiService {
  private readonly api = inject(SpacesService);
  private readonly establishmentsApi = inject(EstablishmentsService);

  /** GET /api/v1/establishments/{establishmentId}/floors */
  listFloors(establishmentId: string): Observable<Floor[]> {
    return this.api.listFloorsByEstablishment({ establishmentId });
  }

  reorderFloors(
    establishmentId: string,
    previousIds: string[],
    floorIds: string[],
  ): Observable<Floor[]> {
    return this.api.reorderFloors({
      establishmentId,
      floorOrderRequest: { previousIds, floorIds },
    });
  }

  /** POST /api/v1/establishments — paso 1 del asistente de configuración. */
  createEstablishment(request: EstablishmentCreateRequest): Observable<Establishment> {
    return this.establishmentsApi.createEstablishment({ establishmentCreateRequest: request });
  }

  /** GET /api/v1/establishments/{id} — paso 3 del asistente (resumen). */
  getEstablishment(id: string): Observable<Establishment> {
    return this.establishmentsApi.getEstablishment({ id });
  }

  /** GET /api/v1/establishments — selector de «Mi negocio» (vivos del tenant). */
  listEstablishments(): Observable<Establishment[]> {
    return this.establishmentsApi.listEstablishments();
  }

  /** PUT /api/v1/establishments/{id} — edición rápida desde «Mi negocio». */
  updateEstablishment(id: string, request: EstablishmentUpdateRequest): Observable<Establishment> {
    return this.establishmentsApi.updateEstablishment({ id, establishmentUpdateRequest: request });
  }

  /** DELETE /api/v1/establishments/{id} — baja desde el modal de edición. */
  deleteEstablishment(id: string): Observable<unknown> {
    return this.establishmentsApi.deleteEstablishment({ id });
  }

  /** GET /api/v1/floors/{id} */
  getFloor(id: string): Observable<Floor> {
    return this.api.getFloor({ id });
  }

  /** POST /api/v1/establishments/{establishmentId}/floors */
  createFloor(request: FloorCreateRequest, establishmentId: string): Observable<Floor> {
    return this.api.createFloor({ establishmentId, floorCreateRequest: request });
  }

  /** PUT /api/v1/floors/{id} */
  updateFloor(id: string, request: FloorCreateRequest): Observable<Floor> {
    return this.api.updateFloor({ id, floorCreateRequest: request });
  }

  /** DELETE /api/v1/floors/{id} */
  deleteFloor(id: string): Observable<unknown> {
    return this.api.deleteFloor({ id });
  }

  // ===== SECTORS =====

  /** GET /api/v1/floors/{floorId}/sectors */
  listSectorsByFloor(floorId: string): Observable<Sector[]> {
    return this.api.listSectorsByFloor({ floorId });
  }

  /** POST /api/v1/floors/{floorId}/sectors */
  createSector(floorId: string, name: string, maxCapacity?: number): Observable<Sector> {
    const request: SectorCreateRequest =
      maxCapacity === undefined ? { name } : { name, maxCapacity };
    return this.api.createSector({ floorId, sectorCreateRequest: request });
  }

  /** PUT /api/v1/sectors/{id} */
  updateSector(id: string, name: string, maxCapacity?: number): Observable<Sector> {
    const request: SectorCreateRequest =
      maxCapacity === undefined ? { name } : { name, maxCapacity };
    return this.api.updateSector({ id, sectorCreateRequest: request });
  }

  /** DELETE /api/v1/sectors/{id} */
  deleteSector(id: string): Observable<void> {
    return this.api.deleteSector({ id }).pipe(map(() => undefined));
  }

  // ===== SPACE ELEMENTS (HU-2.03 / MAP-117)

  /** GET /api/v1/sectors/{sectorId}/elements */
  listSpaceElementsBySector(sectorId: string): Observable<SpaceElement[]> {
    return this.api.listSpaceElementsBySector({ sectorId });
  }

  // El alta/edición/baja de elementos vive en el editor visual (MapEditorApiService).
}
