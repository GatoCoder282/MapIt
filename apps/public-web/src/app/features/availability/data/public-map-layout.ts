import type { PublicMapFloor, PublicMapSector } from '@mapit/api-client';
import type { MapLayout } from '@mapit/map-engine';

export function publicMapLayout(floor: PublicMapFloor, sector: PublicMapSector): MapLayout {
  return {
    floorId: floor.id,
    name: sector.name,
    kind: 'sector',
    schemaVersion: 1,
    size: { width: sector.width, height: sector.height },
    elements: sector.elements.map((element) => ({
      id: element.id,
      type: element.type,
      label: element.name,
      position: { x: element.x, y: element.y },
      size: { width: element.width, height: element.height },
      rotation: element.rotation,
      capacity: element.capacity,
      reservable: element.selectable,
      state: 'AVAILABLE',
      availability: element.availability,
      attributes: {},
    })),
  };
}
