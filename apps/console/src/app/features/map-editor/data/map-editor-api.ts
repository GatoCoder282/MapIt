import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { SpacesService } from '@mapit/api-client';
import type { SpaceElement, SpaceElementUpdateRequest, Sector, Floor } from '@mapit/api-client';

@Injectable({ providedIn: 'root' })
export class MapEditorApiService {
  private readonly api = inject(SpacesService);

  listSpaceElementsBySector(sectorId: string): Observable<SpaceElement[]> {
    return this.api.listSpaceElementsBySector({ sectorId });
  }

  listSectorsByFloor(floorId: string): Observable<Sector[]> {
    return this.api.listSectorsByFloor({ floorId });
  }

  listFloorsByEstablishment(establishmentId: string): Observable<Floor[]> {
    return this.api.listFloorsByEstablishment({ establishmentId });
  }

  updateSpaceElement(
    sectorId: string,
    elementId: string,
    request: SpaceElementUpdateRequest,
  ): Observable<SpaceElement> {
    return this.api.updateSpaceElement({
      sectorId,
      elementId,
      spaceElementUpdateRequest: request,
    });
  }
}
