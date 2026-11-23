import { Injectable, signal } from '@angular/core';

@Injectable()
export class StructureEditorContext {
  readonly floorId = signal<string | null>(null);
  readonly sectorId = signal<string | null>(null);
  readonly geometryLocked = signal(false);
  readonly metadataLocked = signal(false);
  readonly refresh = signal(0);
  readonly refreshTree = signal(0);
  readonly createSector = signal(false);
}
