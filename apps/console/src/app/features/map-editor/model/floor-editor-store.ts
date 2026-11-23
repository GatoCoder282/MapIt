import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, forkJoin, Subject } from 'rxjs';
import { finalize, map, switchMap, takeUntil } from 'rxjs/operators';

import { MapEditorApiService } from '../data/map-editor-api';
import type {
  FloorLayoutResponse,
  FloorLayoutUpdateRequest,
  SectorLayoutSector,
  Sector,
} from '@mapit/api-client';
import {
  type MapLayout,
  type SectorPlacement,
  type SpaceElementId,
  constrainPlacement,
  placementFits,
  LAYOUT_VACIO,
} from '@mapit/map-engine';

import { STRINGS } from '../../../core/strings';
import { mapApiElementToLayoutElement } from '../../../core/spatial-layout';
import { EstablishmentContext } from '../../../core/establishment-context';
import { StructureEditorContext } from '../../../core/structure-editor-context';

interface SectorVersion {
  updatedAt: string;
}

type SectorGeometry = { x: number; y: number; rotation: number; width: number; height: number };
type FloorSnapshot = { layout: MapLayout; pending: Map<string, SectorGeometry> };

/**
 * ViewModel de la vista de planta (HU-4.01): composición de sectores sobre el
 * lienzo del piso. Estado y comandos; la UI solo hace binding.
 *
 * <p>Reglas del spec:
 * <ul>
 *   <li>RN-2: mover/rotar un sector jamás toca las coordenadas internas de sus
 *       elementos (aqui solo cambian {@code position}/{@code rotation} del
 *       {@link SectorPlacement}).</li>
 *   <li>La vista de planta edita las dimensiones del sector sin escalar sus elementos.</li>
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
  private readonly context = inject(EstablishmentContext);
  private readonly structure = inject(StructureEditorContext, { optional: true });
  private epoch = 0;
  private scopeCancel = new Subject<void>();
  private activeEstablishmentId: string | null = null;
  private validatedFloorId: string | null = null;
  private writeCount = 0;
  private readonly baselinePlacements = new Map<string, SectorGeometry>();
  private baselineCanvas: { width: number; height: number } | null = null;

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
  private readonly past = signal<readonly FloorSnapshot[]>([]);
  private readonly future = signal<readonly FloorSnapshot[]>([]);
  readonly canUndo = computed(() => this.past().length > 0);
  readonly canRedo = computed(() => this.future().length > 0);
  readonly snap = signal(true);

  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();
  private readonly _saving = signal(false);
  readonly saving = this._saving.asReadonly();
  readonly busy = this._saving.asReadonly();
  private readonly _error = signal<string | null>(null);
  readonly error = this._error.asReadonly();
  private readonly _saved = signal(false);
  readonly saved = this._saved.asReadonly();
  private readonly capacityBySector = signal(new Map<string, number>());
  readonly selectedCapacity = computed(() =>
    this.capacityBySector().get(this._selectedSectorId() ?? ''),
  );

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
  private readonly pendingPlacements = new Map<string, SectorGeometry>();
  private readonly _pendingCount = signal(0);

  readonly dirty = computed(() => {
    const hasPendingPlacements = this._pendingCount() > 0;
    const baseline = this.baselineCanvas;
    const size = this.canvasSize();
    const canvasChanged = Boolean(
      baseline && (size.width !== baseline.width || size.height !== baseline.height),
    );
    return canvasChanged || hasPendingPlacements;
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.epoch++);
    effect(() => {
      this.syncContext();
    });
  }

  /** I-8: sectores del establecimiento (todas las plantas) disponibles para duplicar. */
  private readonly _librarySectors = signal<Sector[]>([]);
  readonly librarySectors = computed(() => {
    const placed = new Set(this.sectors().map((s) => s.id));
    return this._librarySectors().filter((s) => !placed.has(s.id));
  });

  /** Edita el lienzo de la planta (F1: forma/límites; D-2: rectángulo). */
  resizeCanvas(width: number, height: number): void {
    if (this._saving() || !this.isActiveFloor(this._floorId() ?? '')) return;
    this._saved.set(false);
    const size = { width, height };
    if (
      width < 20 ||
      height < 20 ||
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      this.sectors().some(
        (sector) => !placementFits(sector.position, sector.size, size, sector.rotation),
      )
    ) {
      this._error.set(this.editorStrings.errors.saveInvalid);
      this._layout.update((layout) => ({ ...layout }));
      return;
    }
    if (width === this.canvasSize().width && height === this.canvasSize().height) return;
    this.captureHistory();
    this._error.set(null);
    this._layout.update((layout) => ({ ...layout, size }));
  }

  loadFloor(floorId: string): void {
    const establishmentId = this.syncContext();
    if (!establishmentId || this._saving()) return;
    const selection = floorId === this._floorId() ? this._selectedSectorId() : null;
    this.clearHistory();
    const epoch = ++this.epoch;
    this._loading.set(true);
    this._error.set(null);
    this._selectedSectorId.set(null);
    this._saved.set(false);
    this.pendingPlacements.clear();
    this.baselinePlacements.clear();
    this.baselineCanvas = null;
    this.floorUpdatedAt = null;
    this.sectorVersions.clear();
    this._pendingCount.set(0);
    this.validatedFloorId = null;
    this._floorId.set(null);
    this._layout.set({ ...LAYOUT_VACIO, kind: 'floor', sectors: [] });

    this.api
      .listFloorsByEstablishment(establishmentId)
      .pipe(takeUntil(this.scopeCancel), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (floors) => {
          if (
            epoch !== this.epoch ||
            this.context.status() !== 'ready' ||
            this.context.active()?.id !== establishmentId
          )
            return;
          if (!floors.some((floor) => floor.id === floorId)) {
            this._error.set(this.strings.errors.loadFailed);
            this._loading.set(false);
            return;
          }
          this.api
            .getFloorLayout(floorId)
            .pipe(takeUntil(this.scopeCancel), takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (response) => {
                if (
                  epoch !== this.epoch ||
                  this.context.status() !== 'ready' ||
                  this.context.active()?.id !== establishmentId
                )
                  return;
                if (response.floor.id !== floorId) {
                  this._error.set(this.strings.errors.loadFailed);
                  this._loading.set(false);
                  return;
                }
                this.validatedFloorId = floorId;
                this._floorId.set(floorId);
                this.applyLayout(response);
                this.selectSector(selection);
              },
              error: () => {
                if (epoch === this.epoch && this.context.active()?.id === establishmentId) {
                  this._error.set(this.strings.errors.loadFailed);
                  this._loading.set(false);
                }
              },
            });
        },
        error: () => {
          if (epoch === this.epoch && this.context.active()?.id === establishmentId) {
            this._error.set(this.strings.errors.loadFailed);
            this._loading.set(false);
          }
        },
      });
  }

  private reset(): void {
    this.clearHistory();
    this.epoch++;
    this._floorId.set(null);
    this.validatedFloorId = null;
    this._layout.set({ ...LAYOUT_VACIO, kind: 'floor', sectors: [] });
    this.pendingPlacements.clear();
    this.baselinePlacements.clear();
    this.baselineCanvas = null;
    this._pendingCount.set(0);
    this._selectedSectorId.set(null);
    this._librarySectors.set([]);
    this._loading.set(false);
    this._error.set(null);
    this._conflictingIds.set([]);
  }

  selectSector(id: string | null): void {
    this._selectedSectorId.set(
      id === null || this.sectors().some((sector) => sector.id === id) ? id : null,
    );
  }

  moveSector(id: SpaceElementId, x: number, y: number): void {
    this.updatePlacement(id, { x, y });
  }

  dropSector(id: SpaceElementId, x: number, y: number): void {
    const moving = this.sectors().find((sector) => sector.id === id);
    if (!this.snap() || !moving || moving.rotation !== 0) {
      this.moveSector(id, x, y);
      return;
    }

    const tolerance = 12;
    const { width, height } = moving.size;
    const candidates = this.sectors().filter((sector) => sector.id !== id && sector.rotation === 0);
    const offsets = candidates.flatMap(({ position, size }) => {
      const right = position.x + size.width;
      const bottom = position.y + size.height;
      if (
        x <= right + tolerance &&
        x + width >= position.x - tolerance &&
        y <= bottom + tolerance &&
        y + height >= position.y - tolerance
      ) {
        return [
          {
            x: [position.x - width - x, right - x, position.x - x, right - width - x],
            y: [position.y - height - y, bottom - y, position.y - y, bottom - height - y],
          },
        ];
      }
      return [];
    });
    const nearest = (axis: 'x' | 'y') =>
      offsets
        .flatMap((offset) => offset[axis])
        .reduce(
          (best, offset) =>
            Math.abs(offset) <= tolerance && (best === null || Math.abs(offset) < Math.abs(best))
              ? offset
              : best,
          null as number | null,
        ) ?? 0;
    this.moveSector(id, x + nearest('x'), y + nearest('y'));
  }

  rotateSector(id: SpaceElementId, rotation: number): void {
    const normalized = ((rotation % 360) + 360) % 360;
    this.updatePlacement(id, { rotation: normalized });
  }

  updatePlacement(id: SpaceElementId, patch: Partial<SectorGeometry>): void {
    if (this._saving() || !this.isActiveFloor(this._floorId() ?? '')) return;
    const current = this.sectors().find((s) => s.id === id);
    if (!current) return;
    this._saved.set(false);
    const next = {
      x: patch.x ?? current.position.x,
      y: patch.y ?? current.position.y,
      rotation: patch.rotation ?? current.rotation,
      width: patch.width ?? current.size.width,
      height: patch.height ?? current.size.height,
    };
    if (!Object.values(next).every(Number.isFinite) || next.width < 20 || next.height < 20) {
      this._error.set(this.editorStrings.errors.saveInvalid);
      this._layout.update((layout) => ({ ...layout }));
      return;
    }
    next.rotation = ((next.rotation % 360) + 360) % 360;
    const canvas = this.canvasSize();
    Object.assign(next, constrainPlacement(next, next, canvas, next.rotation));
    if (!placementFits(next, next, canvas, next.rotation)) {
      this._error.set(this.editorStrings.errors.saveInvalid);
      this._layout.update((layout) => ({ ...layout }));
      return;
    }

    if (
      next.x === current.position.x &&
      next.y === current.position.y &&
      next.width === current.size.width &&
      next.height === current.size.height &&
      next.rotation === current.rotation
    )
      return;
    this.captureHistory();
    this._error.set(null);
    this._layout.update((layout) => ({
      ...layout,
      sectors: (layout.sectors ?? []).map((s) =>
        s.id === id
          ? {
              ...s,
              position: { x: next.x, y: next.y },
              size: { width: next.width, height: next.height },
              rotation: next.rotation,
            }
          : s,
      ),
    }));
    const baseline = this.baselinePlacements.get(id);
    if (
      baseline &&
      next.x === baseline.x &&
      next.y === baseline.y &&
      next.rotation === baseline.rotation &&
      next.width === baseline.width &&
      next.height === baseline.height
    ) {
      this.pendingPlacements.delete(id);
    } else {
      this.pendingPlacements.set(id, next);
    }
    this._pendingCount.set(this.pendingPlacements.size);
  }

  /** Carga los sectores de todo el establecimiento para la biblioteca (I-8). */
  loadLibrary(establishmentId: string): void {
    const activeId = this.syncContext();
    if (!activeId || activeId !== establishmentId) return;
    const epoch = this.epoch;
    this.api
      .listFloorsByEstablishment(establishmentId)
      .pipe(takeUntil(this.scopeCancel), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (floors) => {
          if (epoch !== this.epoch || this.context.active()?.id !== establishmentId) return;
          const requests = floors.map((f) => this.api.listSectorsByFloor(f.id));
          forkJoin(requests)
            .pipe(takeUntil(this.scopeCancel), takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (perFloor) => {
                if (epoch === this.epoch && this.context.active()?.id === establishmentId)
                  this._librarySectors.set(perFloor.flat());
              },
              error: () => this._error.set(this.strings.errors.loadFailed),
            });
        },
        error: () => this._error.set(this.strings.errors.loadFailed),
      });
  }

  /** Coloca una copia de un sector del establecimiento (RN-5: duplicado explícito). */
  duplicateSector(sourceSectorId: string, x = 40, y = 40): void {
    const floorId = this._floorId();
    const placed = this.sectors().find((sector) => sector.id === sourceSectorId);
    const library = this.librarySectors().find((sector) => sector.id === sourceSectorId);
    if (
      !floorId ||
      this._saving() ||
      this.dirty() ||
      !this.isActiveFloor(floorId) ||
      (!placed && !library)
    )
      return;
    const size = placed?.size ?? { width: library?.width ?? 800, height: library?.height ?? 600 };
    const position = constrainPlacement({ x, y }, size, this.canvasSize(), 0);
    const epoch = this.epoch;
    const finishWrite = this.beginWrite();
    this._error.set(null);
    this._saved.set(false);

    this.api
      .duplicateSector(floorId, { sourceSectorId, ...position })
      .pipe(
        switchMap((duplicated) => {
          if (epoch !== this.epoch || !this.isActiveFloor(floorId)) return EMPTY;
          return this.api.getFloorLayout(floorId).pipe(map((fresh) => ({ duplicated, fresh })));
        }),
        takeUntilDestroyed(this.destroyRef),
        finalize(finishWrite),
      )
      .subscribe({
        next: ({ duplicated, fresh }) => {
          if (epoch !== this.epoch || !this.isActiveFloor(floorId)) return;
          this.applyLayout(fresh);
          this.selectSector(duplicated.sector.id);
          this.structure?.refreshTree.update((revision) => revision + 1);
          this._saved.set(true);
        },
        error: (response: { status?: number }) => {
          if (epoch !== this.epoch || !this.isActiveFloor(floorId)) return;
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
    if (!floorId || !this.floorUpdatedAt || !this.isActiveFloor(floorId) || this._saving()) return;
    const epoch = this.epoch;

    const finishWrite = this.beginWrite();
    this._error.set(null);
    this._conflictingIds.set([]);

    this.api
      .saveFloorLayout(floorId, this.createLayoutRequest())
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(finishWrite))
      .subscribe({
        next: (response) => {
          if (epoch !== this.epoch || !this.isActiveFloor(floorId)) return;
          this.applyLayout(response);
          this.pendingPlacements.clear();
          this._pendingCount.set(0);
          this._saved.set(true);
        },
        error: (response: { status?: number; error?: { conflictingIds?: string[] } }) => {
          if (epoch !== this.epoch || !this.isActiveFloor(floorId)) return;
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
    this.clearHistory();
    const floor = response.floor;
    this.floorUpdatedAt = floor.updatedAt;
    this.sectorVersions.clear();
    this.baselinePlacements.clear();
    this.baselineCanvas = { width: floor.canvasWidth, height: floor.canvasHeight };
    this.capacityBySector.set(
      new Map(
        response.sectors.flatMap((sector) =>
          sector.maxCapacity == null ? [] : [[sector.id, sector.maxCapacity]],
        ),
      ),
    );
    const sectors: SectorPlacement[] = response.sectors.map((s: SectorLayoutSector) => {
      this.sectorVersions.set(s.id, { updatedAt: s.updatedAt });
      const { x, y, rotation, width, height } = s;
      this.baselinePlacements.set(s.id, { x, y, rotation, width, height });
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

  undo(): void {
    if (this.busy() || this.loading() || !this.isActiveFloor(this.floorId() ?? '')) return;
    const previous = this.past().at(-1);
    if (!previous) return;
    this.future.update((items) => [...items, this.snapshot()]);
    this.past.update((items) => items.slice(0, -1));
    this.restoreSnapshot(previous);
  }

  redo(): void {
    if (this.busy() || this.loading() || !this.isActiveFloor(this.floorId() ?? '')) return;
    const next = this.future().at(-1);
    if (!next) return;
    this.past.update((items) => [...items, this.snapshot()]);
    this.future.update((items) => items.slice(0, -1));
    this.restoreSnapshot(next);
  }

  private snapshot(): FloorSnapshot {
    return { layout: this.layout(), pending: new Map(this.pendingPlacements) };
  }

  private captureHistory(): void {
    const snapshot = this.snapshot();
    this.past.update((items) => [...items.slice(-99), snapshot]);
    this.future.set([]);
  }

  private restoreSnapshot(snapshot: FloorSnapshot): void {
    this.pendingPlacements.clear();
    for (const [id, geometry] of snapshot.pending) this.pendingPlacements.set(id, geometry);
    this._pendingCount.set(this.pendingPlacements.size);
    this._layout.set(snapshot.layout);
    this._saved.set(false);
    this._error.set(null);
  }

  private clearHistory(): void {
    this.past.set([]);
    this.future.set([]);
  }

  private isActiveFloor(floorId: string): boolean {
    return (
      Boolean(floorId) &&
      this.validatedFloorId === floorId &&
      this.context.status() === 'ready' &&
      this.context.active()?.id === this.activeEstablishmentId &&
      this._floorId() === floorId &&
      this._layout().floorId === floorId
    );
  }

  private createLayoutRequest(): FloorLayoutUpdateRequest {
    const size = this.canvasSize();
    return {
      floor: {
        canvasWidth: size.width,
        canvasHeight: size.height,
        updatedAt: this.floorUpdatedAt ?? '',
      },
      sectors: Array.from(this.pendingPlacements.entries()).map(([id, placement]) => {
        const { x, y, rotation, width, height } = placement;
        const baseline = this.baselinePlacements.get(id);
        return {
          id,
          x,
          y,
          rotation,
          ...(width !== baseline?.width || height !== baseline?.height ? { width, height } : {}),
          updatedAt: this.sectorVersions.get(id)?.updatedAt ?? '',
        };
      }),
    };
  }

  private beginWrite(): () => void {
    this.writeCount++;
    this._saving.set(true);
    let finished = false;
    return () => {
      if (finished) return;
      finished = true;
      this.writeCount--;
      this._saving.set(this.writeCount > 0);
    };
  }

  private syncContext(): string | null {
    const active = this.context.active();
    const id = this.context.status() === 'ready' ? (active?.id ?? null) : null;
    if (id !== this.activeEstablishmentId) {
      this.scopeCancel.next();
      this.scopeCancel = new Subject<void>();
      this.reset();
      this.activeEstablishmentId = id;
    }
    return id;
  }
}
