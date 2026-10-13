import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { SpacesService, TemplatesService } from '@mapit/api-client';
import type {
  SpaceElement,
  SpaceElementCreateRequest,
  SpaceElementUpdateRequest,
  Sector,
  Floor,
  ElementTemplate,
  ElementTemplateCreateRequest,
  FloorLayoutResponse,
  FloorLayoutUpdateRequest,
  SectorLayoutResponse,
  SectorLayoutUpdateRequest,
  SectorDuplicateRequest,
} from '@mapit/api-client';

@Injectable({ providedIn: 'root' })
export class MapEditorApiService {
  private readonly api = inject(SpacesService);
  private readonly templatesApi = inject(TemplatesService);

  listSpaceElementsBySector(sectorId: string): Observable<SpaceElement[]> {
    return this.api.listSpaceElementsBySector({ sectorId });
  }

  listSectorsByFloor(floorId: string): Observable<Sector[]> {
    return this.api.listSectorsByFloor({ floorId });
  }

  listFloorsByEstablishment(establishmentId: string): Observable<Floor[]> {
    return this.api.listFloorsByEstablishment({ establishmentId });
  }

  createSpaceElement(
    sectorId: string,
    request: SpaceElementCreateRequest,
  ): Observable<SpaceElement> {
    return this.api.createSpaceElement({ sectorId, spaceElementCreateRequest: request });
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

  // ===== HU-4.01: layout de planta y sector =====

  getFloorLayout(floorId: string): Observable<FloorLayoutResponse> {
    return this.api.getFloorLayout({ floorId });
  }

  saveFloorLayout(
    floorId: string,
    request: FloorLayoutUpdateRequest,
  ): Observable<FloorLayoutResponse> {
    return this.api.saveFloorLayout({ floorId, floorLayoutUpdateRequest: request });
  }

  saveSectorLayout(
    sectorId: string,
    request: SectorLayoutUpdateRequest,
  ): Observable<SectorLayoutResponse> {
    return this.api.saveSectorLayout({ sectorId, sectorLayoutUpdateRequest: request });
  }

  duplicateSector(
    floorId: string,
    request: SectorDuplicateRequest,
  ): Observable<SectorLayoutResponse> {
    return this.api.duplicateSector({ floorId, sectorDuplicateRequest: request });
  }

  deleteSpaceElement(sectorId: string, elementId: string): Observable<void> {
    return this.api.deleteSpaceElement({ sectorId, elementId }).pipe(map(() => undefined));
  }

  // ===== PLANTILLAS (HU-4.02) =====

  listTemplates(): Observable<ElementTemplate[]> {
    return this.templatesApi.listElementTemplates();
  }

  createTemplate(request: ElementTemplateCreateRequest): Observable<ElementTemplate> {
    return this.templatesApi.createElementTemplate({ elementTemplateCreateRequest: request });
  }
}
