import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';

import { MapEditorApiService } from '../data/map-editor-api';
import type { FloorLayoutResponse, SectorLayoutSector, Sector } from '@mapit/api-client';
import {
  type MapLayout,
  type SectorPlacement,
  type SpaceElementId,
  LAYOUT_VACIO,
} from '@mapit/map-engine';

import { STRINGS } from '../../../core/strings';
import { mapApiElementToLayoutElement } from './map-editor-store';

interface SectorVersion {
  updatedAt: string;
}

/**
 * ViewModel de la vista de planta (HU-4.01): composición de sectores sobre el
 * lienzo del piso. Estado y comandos; la UI solo hace binding.
 *
 * <p>Reglas del spec:
 * <ul>
 *   <li>RN-2: mover/rotar un sector jamás toca las coordenadas internas de sus
 *       elementos (aqui solo cambian {@code position}/{@code rotation} del
 *       {@link SectorPlacement}).</li>
 *   <li>RN-6: la vista de planta NO edita dimensiones ni elementos internos.</li>
 *   <li>RN-7: el guardado es por lotes y con concurrencia optimista; 409 muestra
 *       los ids en conflicto y ofrece recargar.</li>
 * </ul>
 */
@Injectable({ providedIn: 'root' })
export class FloorEditorStore {
  private readonly api = inject(MapEditorApiService);
  private readonly strings = STRINGS.spaces.floorEditor;
  private readonly editorStrings = STRINGS.spaces.editor;
  private readonly destroyRef = inject(DestroyRef);

  private readonly _floorId = signal<string | null>(null);
  readonly floorId = this._floorId.asReadonly();

  private readonly _layout: WritableSignal<MapLayout> = signal({
    ...LAYOUT_VACIO,
    kind: 'floor',
    sectors: [],
  });
  readonly layout: Signal<MapLayout> = this._layout.asReadonly();

  readonly sectors = computed(() => this._layout().sectors ?? []);
  readonly canvasSize = computed(() => this._layout().size);
  readonly floorName = computed(() => this._layout().name);

  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();
  private readonly _saving = signal(false);
  readonly saving = this._saving.asReadonly();
  private readonly _error = signal<string | null>(null);
  readonly error = this._error.asReadonly();

  /** Ids en conflicto tras un 409 de concurrencia optimista (RN-7). */
  private readonly _conflictingIds = signal<string[]>([]);
  readonly conflictingIds = this._conflictingIds.asReadonly();

  private readonly _selectedSectorId = signal<string | null>(null);
  readonly selectedSectorId = this._selectedSectorId.asReadonly();
  readonly selectedSector = computed(() => {
    const id = this._selectedSectorId();
    return id ? (this.sectors().find((s) => s.id === id) ?? null) : null;
  });

  // Versiones observadas de la lectura agregada (para la concurrencia optimista).
  private floorUpdatedAt: string | null = null;
  private readonly sectorVersions = new Map<string, SectorVersion>();

  /** Colocaciones pendientes: el contador es signal para que `dirty` sea reactivo (I-3). */
  private readonly pendingPlacements = new Map<
    string,
    { x: number; y: number; rotation: number }
  >();
  private readonly _pendingCount = signal(0);

  private readonly _canvasDirty = signal(false);
  readonly dirty = computed(() => this._pendingCount() > 0 || this._canvasDirty());

  /** I-8: sectores del establecimiento (todas las plantas) disponibles para duplicar. */
  private readonly _librarySectors = signal<Sector[]>([]);
  readonly librarySectors = computed(() => {
    const placed = new Set(this.sectors().map((s) => s.id));
    return this._librarySectors().filter((s) => !placed.has(s.id));
  });

  /** Edita el lienzo de la planta (F1: forma/límites; D-2: rectángulo). */
  resizeCanvas(width: number, height: number): void {
    if (width <= 0 || height <= 0 || !Number.isFinite(width) || !Number.isFinite(height)) {
      this._error.set(this.editorStrings.errors.saveInvalid);
      return;
    }
    this._layout.update((layout) => ({ ...layout, size: { width, height } }));
    this._canvasDirty.set(true);
  }

  loadFloor(floorId: string): void {
    this._floorId.set(floorId);
    this._loading.set(true);
    this._error.set(null);
    this.pendingPlacements.clear();
    this._pendingCount.set(0);
    this._canvasDirty.set(false);

    this.api
      .getFloorLayout(floorId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => this.applyLayout(response),
        error: () => {
          this._error.set(this.strings.errors.loadFailed);
          this._loading.set(false);
        },
      });
  }

  selectSector(id: string | null): void {
    this._selectedSectorId.set(id);
  }

  moveSector(id: SpaceElementId, x: number, y: number): void {
    this.updatePlacement(id, { x, y });
  }

  rotateSector(id: SpaceElementId, rotation: number): void {
    const normalized = ((rotation % 360) + 360) % 360;
    this.updatePlacement(id, { rotation: normalized });
  }

  private updatePlacement(
    id: SpaceElementId,
    patch: Partial<{ x: number; y: number; rotation: number }>,
  ): void {
    const current = this.sectors().find((s) => s.id === id);
    if (!current) return;
    const next = {
      x: patch.x ?? current.position.x,
      y: patch.y ?? current.position.y,
      rotation: patch.rotation ?? current.rotation,
    };
    // Clamping defensivo al lienzo (RN-10; el backend vuelve a validar).
    const size = current.size;
    const canvas = this.canvasSize();
    next.x = Math.max(0, Math.min(next.x, Math.max(0, canvas.width - size.width)));
    next.y = Math.max(0, Math.min(next.y, Math.max(0, canvas.height - size.height)));

    this._layout.update((layout) => ({
      ...layout,
      sectors: (layout.sectors ?? []).map((s) =>
        s.id === id ? { ...s, position: { x: next.x, y: next.y }, rotation: next.rotation } : s,
      ),
    }));
    this.pendingPlacements.set(id, next);
    this._pendingCount.update((n) => n + 1);
  }

  /** Carga los sectores de todo el establecimiento para la biblioteca (I-8). */
  loadLibrary(establishmentId: string): void {
    this.api
      .listFloorsByEstablishment(establishmentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((floors) => {
        const requests = floors.map((f) => this.api.listSectorsByFloor(f.id));
        forkJoin(requests).subscribe((perFloor) => this._librarySectors.set(perFloor.flat()));
      });
  }

  /** Coloca una copia de un sector del establecimiento (RN-5: duplicado explícito). */
  duplicateSector(sourceSectorId: string, x = 40, y = 40): void {
    const floorId = this._floorId();
    if (!floorId) return;
    this._saving.set(true);
    this._error.set(null);

    this.api
      .duplicateSector(floorId, { sourceSectorId })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (duplicated) => {
          // La copia nace en el origen (0,0): se recarga el layout y se coloca.
          this.api
            .getFloorLayout(floorId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (fresh) => {
                this.applyLayout(fresh);
                this.moveSector(duplicated.sector.id, x, y);
                this.saveLayout();
              },
              error: () => this._saving.set(false),
            });
        },
        error: (response: { status?: number }) => {
          this._saving.set(false);
          this._error.set(
            response?.status === 404
              ? this.editorStrings.errors.notFound
              : this.strings.errors.saveFailed,
          );
        },
      });
  }

  /** Guardado por lotes de la vista de planta (RN-7). */
  saveLayout(): void {
    const floorId = this._floorId();
    if (!floorId || !this.floorUpdatedAt) return;

    const canvas = this.canvasSize();
    const sectors = Array.from(this.pendingPlacements.entries()).map(([id, p]) => ({
      id,
      x: p.x,
      y: p.y,
      rotation: p.rotation,
      updatedAt: this.sectorVersions.get(id)?.updatedAt ?? '',
    }));

    this._saving.set(true);
    this._error.set(null);
    this._conflictingIds.set([]);

    this.api
      .saveFloorLayout(floorId, {
        floor: {
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          updatedAt: this.floorUpdatedAt,
        },
        sectors,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.applyLayout(response);
          this.pendingPlacements.clear();
          this._pendingCount.set(0);
          this._canvasDirty.set(false);
          this._saving.set(false);
        },
        error: (response: { status?: number; error?: { conflictingIds?: string[] } }) => {
          this._saving.set(false);
          if (response?.status === 409) {
            this._conflictingIds.set(response.error?.conflictingIds ?? []);
            this._error.set(this.strings.errors.conflict);
            return;
          }
          this._error.set(
            response?.status === 400
              ? this.editorStrings.errors.saveInvalid
              : this.strings.errors.saveFailed,
          );
        },
      });
  }

  /** Descarta el borrador local y recarga la planta (respuesta a un 409). */
  discardAndReload(): void {
    const floorId = this._floorId();
    if (!floorId) return;
    this._conflictingIds.set([]);
    this.loadFloor(floorId);
  }

  clearError(): void {
    this._error.set(null);
  }

  private applyLayout(response: FloorLayoutResponse): void {
    const floor = response.floor;
    this.floorUpdatedAt = floor.updatedAt;
    this.sectorVersions.clear();
    const sectors: SectorPlacement[] = response.sectors.map((s: SectorLayoutSector) => {
      this.sectorVersions.set(s.id, { updatedAt: s.updatedAt });
      return {
        id: s.id,
        label: s.name,
        position: { x: s.x, y: s.y },
        size: { width: s.width, height: s.height },
        rotation: s.rotation,
        children: s.elements.map(mapApiElementToLayoutElement),
      };
    });
    this._layout.set({
      floorId: floor.id,
      name: floor.name,
      size: { width: floor.canvasWidth, height: floor.canvasHeight },
      elements: [],
      schemaVersion: 1,
      kind: 'floor',
      sectors,
    });
    this._loading.set(false);
  }
}
