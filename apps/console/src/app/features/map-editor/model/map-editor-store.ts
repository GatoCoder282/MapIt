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
import { of, Subject, throwError } from 'rxjs';
import { catchError, finalize, map, switchMap, take, takeUntil } from 'rxjs/operators';
import { MapEditorApiService } from '../data/map-editor-api';
import type {
  SpaceElement,
  Sector,
  SectorLayoutResponse,
  SectorLayoutUpdateRequest,
  Floor,
  FloorLayoutResponse,
  ElementTemplate,
  ElementTemplateCreateRequest,
} from '@mapit/api-client';
import { AuthSession } from '@mapit/auth';
import {
  type MapLayout,
  type SpaceElement as MapSpaceElement,
  type SpaceElementId,
  type SpaceElementType,
  constrainPlacement,
  type Size,
  LAYOUT_VACIO,
  TYPE_DEFAULTS,
} from '@mapit/map-engine';

import { STRINGS } from '../../../core/strings';
import {
  mapApiElementToLayoutElement,
  normalizeLayoutStyle,
  type LayoutStyle,
  type ElementFinish,
} from '../../../core/spatial-layout';
import { EstablishmentContext } from '../../../core/establishment-context';

/** Catálogo de defaults por tipo (fuente única: `libs/map-engine`). */
export { TYPE_DEFAULTS };

const DEFAULT_SECTOR_SIZE: Size = { width: 1200, height: 800 };
const FLOOR_CANVAS_SLUG = 'mapit-plano';

type Geometry = Pick<MapSpaceElement, 'id' | 'position' | 'size' | 'rotation'>;
export interface ElementInsertion {
  size?: Size;
  rotation?: number;
  capacity?: number | null;
  label?: string | null;
  finish?: ElementFinish | undefined;
}

type ElementMetadata = { label: string | null; capacity: number | null };
type DraftSnapshot = {
  layout: MapLayout;
  metadata: Record<string, ElementMetadata>;
  appearance: LayoutStyle;
};

interface ActiveDragCoords {
  id: SpaceElementId;
  x: number;
  y: number;
}

function confirmsLayoutSave(
  sectorId: string,
  request: SectorLayoutUpdateRequest,
  response: SectorLayoutResponse,
  expectedIds: readonly string[],
): boolean {
  const sector = response?.sector;
  if (
    sector?.id !== sectorId ||
    !sector.updatedAt ||
    sector.width !== request.sector.width ||
    sector.height !== request.sector.height ||
    !Array.isArray(response.elements) ||
    response.elements.some((element) => element?.sectorId !== sectorId)
  )
    return false;

  const elements = new Map(response.elements.map((element) => [element.id, element]));
  const matchesGeometry = (
    change: Pick<SpaceElement, 'id' | 'x' | 'y' | 'width' | 'height' | 'rotation'>,
  ) => {
    const saved = elements.get(change.id);
    return (
      saved !== undefined &&
      saved.x === change.x &&
      saved.y === change.y &&
      saved.width === change.width &&
      saved.height === change.height &&
      saved.rotation === change.rotation
    );
  };
  return (
    expectedIds.every((id) => Boolean(elements.get(id)?.updatedAt)) &&
    request.elements.every(matchesGeometry) &&
    (request.createdElements ?? []).every((created) => {
      const saved = elements.get(created.id);
      return (
        saved?.type === created.type &&
        matchesGeometry(created) &&
        (saved.label ?? null) === (created.label ?? null) &&
        (saved.capacity ?? null) === (created.capacity ?? null)
      );
    }) &&
    (request.deletedElements ?? []).every(({ id }) => !elements.has(id)) &&
    (request.metadataUpdates ?? []).every(({ id, label, capacity }) => {
      const saved = elements.get(id);
      return (
        Boolean(saved) && (saved?.label ?? null) === label && (saved?.capacity ?? null) === capacity
      );
    }) &&
    (!request.appearance ||
      (sector.appearance != null &&
        JSON.stringify(normalizeLayoutStyle(sector.appearance)) ===
          JSON.stringify(normalizeLayoutStyle(request.appearance))))
  );
}

@Injectable({ providedIn: 'root' })
export class MapEditorStore {
  private readonly clipboard = signal<{
    sectorId: string;
    element: MapSpaceElement;
    metadata: ElementMetadata;
    finish?: ElementFinish | undefined;
  } | null>(null);
  readonly canPaste = computed(
    () => this.clipboard()?.sectorId === this.sectorId() && this.canEdit(),
  );

  copySelectedElement(): boolean {
    const element = this.selectedElement();
    const sectorId = this.sectorId();
    if (!element || !sectorId || !this.canEdit() || this.busy()) return false;
    this.clipboard.set({
      sectorId,
      element,
      metadata: this.metadataFor(element.id),
      finish: this.appearance().elements[element.id],
    });
    return true;
  }

  pasteElement(): void {
    const copied = this.clipboard();
    if (!copied || !this.canPaste() || this.busy()) return;
    const { element, metadata, finish } = copied;
    this.createElementFromDrop(
      'base:' + element.type,
      element.position.x + 24,
      element.position.y + 24,
      {
        size: element.size,
        rotation: element.rotation,
        ...metadata,
        finish,
      },
    );
    const inserted = this.selectedElement();
    if (inserted && inserted.id !== element.id) {
      this.clipboard.set({ ...copied, element: { ...element, position: inserted.position } });
    }
  }

  private readonly api = inject(MapEditorApiService);
  private readonly session = inject(AuthSession);
  private readonly strings = STRINGS.spaces.editor;
  private readonly destroyRef = inject(DestroyRef);
  private readonly context = inject(EstablishmentContext);
  private scopeEpoch = 0;
  private scopeCancel = new Subject<void>();
  private writeCount = 0;
  private resourceEpoch = 0;
  private validatedSectorId: string | null = null;
  private activeEstablishmentId: string | null = null;
  private requestedSectorId: string | null = null;
  private requestedFloorId: string | null = null;

  openRoute(sectorId: string | null, floorId: string | null): void {
    this.requestedFloorId = floorId;
    this.requestedSectorId = sectorId;
    if (floorId && !this.floors().some((floor) => floor.id === floorId)) {
      const establishmentId = this.context.active()?.id;
      if (establishmentId) this.loadFloorsByEstablishment(establishmentId);
      return;
    }
    if (
      floorId &&
      sectorId &&
      floorId === this.selectedFloorId() &&
      !this.sectors().some((sector) => sector.id === sectorId)
    ) {
      this._selectedFloorId.set(null);
      this.selectFloor(floorId);
      return;
    }
    if (
      floorId &&
      this.floors().some((floor) => floor.id === floorId) &&
      floorId !== this.selectedFloorId()
    ) {
      this.selectFloor(floorId);
    } else if (sectorId && this.sectors().some((sector) => sector.id === sectorId)) {
      this.loadSector(sectorId);
    } else if (floorId === this.selectedFloorId() && !sectorId) {
      const canvas = this.floorCanvas() ?? this.sectors()[0];
      if (canvas) this.loadSector(canvas.id);
    }
  }

  private readonly _sectorId = signal<string | null>(null);
  readonly sectorId = this._sectorId.asReadonly();

  private readonly _selectedFloorId = signal<string | null>(null);
  readonly selectedFloorId = this._selectedFloorId.asReadonly();

  private readonly _layout: WritableSignal<MapLayout> = signal(LAYOUT_VACIO);
  readonly layout: Signal<MapLayout> = this._layout.asReadonly();

  readonly elements = computed(() => this._layout().elements);
  private readonly _metadata = signal<Record<string, SpaceElement>>({});
  private readonly _draftMetadata = signal<Record<string, ElementMetadata>>({});
  readonly selectedMetadata = computed(() => {
    const id = this._selectedId();
    return id ? this.metadataFor(id) : null;
  });
  readonly canEditMetadata = computed(() =>
    ['ADMIN', 'MANAGER'].includes(this.session.user()?.role ?? ''),
  );
  private readonly _metadataError = signal<string | null>(null);
  readonly metadataError = this._metadataError.asReadonly();
  readonly sectorSize = computed(() => this._layout().size);
  readonly sectorName = computed(() => this._layout().name);

  // Floor selection
  private readonly _floors = signal<Floor[]>([]);
  readonly floors = this._floors.asReadonly();

  // Sector selection
  private readonly _sectors = signal<Sector[]>([]);
  private readonly _floorLayouts = signal<Record<string, FloorLayoutResponse>>({});
  readonly floorLayouts = this._floorLayouts.asReadonly();
  readonly floorCanvas = computed(() =>
    this._sectors().find(({ slug }) => slug === FLOOR_CANVAS_SLUG),
  );
  readonly sectors = this._sectors.asReadonly();

  // Computed: sectors for the currently selected floor
  // Sectors are already filtered by floor when loaded via loadSectorsByFloor
  readonly sectorsForSelectedFloor = computed(() => this._sectors());

  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();
  private readonly _saving = signal(false);
  readonly saving = this._saving.asReadonly();
  readonly busy = this._saving.asReadonly();
  private readonly _error = signal<string | null>(null);
  readonly error = this._error.asReadonly();

  /** HU-4.01: versión observada del sector (para guardados por lotes, RN-7). */
  private readonly _sectorUpdatedAt = signal<string | null>(null);
  readonly sectorUpdatedAt = this._sectorUpdatedAt.asReadonly();

  private readonly baselineSize = signal<Size>(DEFAULT_SECTOR_SIZE);
  private readonly baselineAppearance = signal<LayoutStyle>({ elements: {} });
  private readonly _appearance = signal<LayoutStyle>({ elements: {} });
  readonly appearance = this._appearance.asReadonly();
  private readonly appearanceChanged = computed(
    () => JSON.stringify(this.appearance()) !== JSON.stringify(this.baselineAppearance()),
  );
  private arranging = false;
  private readonly undoStack = signal<readonly DraftSnapshot[]>([]);
  private readonly redoStack = signal<readonly DraftSnapshot[]>([]);
  readonly canUndo = computed(() => this.undoStack().length > 0);
  readonly canRedo = computed(() => this.redoStack().length > 0);
  private readonly changes = computed(() =>
    this.elements().filter((el) => {
      const original = this._metadata()[el.id];
      if (!original) return false;
      const saved = mapApiElementToLayoutElement(original);
      return (
        el.position.x !== saved.position.x ||
        el.position.y !== saved.position.y ||
        el.size.width !== saved.size.width ||
        el.size.height !== saved.size.height ||
        el.rotation !== saved.rotation
      );
    }),
  );
  private readonly addedElements = computed(() =>
    this.elements().filter((el) => !this._metadata()[el.id]),
  );
  private readonly deletedElements = computed(() =>
    Object.values(this._metadata()).filter(
      (saved) => !this.elements().some(({ id }) => id === saved.id),
    ),
  );
  private readonly metadataChanges = computed(() =>
    this.elements().filter(({ id }) => {
      const saved = this._metadata()[id];
      if (!saved) return false;
      const draft = this.metadataFor(id);
      return draft.label !== (saved.label ?? null) || draft.capacity !== (saved.capacity ?? null);
    }),
  );
  readonly dirty = computed(() => {
    if (!this._sectorId() || !this._layout().floorId) return false;
    return (
      this.changes().length > 0 ||
      this.addedElements().length > 0 ||
      this.deletedElements().length > 0 ||
      this.metadataChanges().length > 0 ||
      this.appearanceChanged() ||
      this.sectorSize().width !== this.baselineSize().width ||
      this.sectorSize().height !== this.baselineSize().height
    );
  });
  private readonly _saved = signal(false);
  readonly saved = this._saved.asReadonly();
  private readonly _conflict = signal(false);
  readonly conflict = this._conflict.asReadonly();
  readonly canEdit = computed(
    () =>
      this.canEditMetadata() &&
      this.isCurrentScope() &&
      this._sectorId() !== null &&
      !this.loading(),
  );

  private resetDraft(): void {
    this.undoStack.set([]);
    this.redoStack.set([]);
    this._saved.set(false);
    this._conflict.set(false);
    this._draftMetadata.set({});
  }

  // Coordenadas en tiempo real durante el arrastre (no actualizan _layout)
  private readonly _activeDragCoords = signal<ActiveDragCoords | null>(null);
  readonly activeDragCoords = this._activeDragCoords.asReadonly();

  // Selection state
  private readonly _selectedId = signal<string | null>(null);
  readonly selectedId = this._selectedId.asReadonly();

  readonly selectedElement = computed(() => {
    const id = this._selectedId();
    if (!id) return null;
    return this.elements().find((el) => el.id === id) ?? null;
  });

  // Posición del elemento seleccionado: usa coords de drag si coincide con el seleccionado
  readonly selectedElementPosition = computed(() => {
    const drag = this._activeDragCoords();
    const selected = this.selectedElement();
    if (!selected) return null;

    if (drag && drag.id === selected.id) {
      return { x: drag.x, y: drag.y };
    }
    return selected.position;
  });

  constructor() {
    effect(() => {
      const active = this.context.active();
      const status = this.context.status();
      const id = status === 'ready' ? (active?.id ?? null) : null;
      if (id === this.activeEstablishmentId) return;
      this.activeEstablishmentId = id;
      this.clipboard.set(null);
      this.scopeEpoch++;
      this._floorLayouts.set({});
      this.resourceEpoch++;
      this.scopeCancel.next();
      this.scopeCancel = new Subject<void>();
      this._loading.set(false);
      this._floors.set([]);
      this._sectors.set([]);
      this._selectedFloorId.set(null);
      this._sectorId.set(null);
      this._selectedId.set(null);
      this._metadata.set({});
      this._metadataError.set(null);
      this._sectorUpdatedAt.set(null);
      this.validatedSectorId = null;
      this.resetDraft();
      this._activeDragCoords.set(null);
      this._layout.set(LAYOUT_VACIO);
      this._error.set(null);
      if (id) this.loadFloorsByEstablishment(id);
    });
  }

  /** Selecciona un elemento por ID (actualiza selectedId, selectedElement es computed reactivo) */
  selectElement(id: string | null): void {
    this._selectedId.set(id);
  }

  // Floor methods
  loadFloorZones(floorId: string): void {
    if (!this.isCurrentScope() || !this.floors().some(({ id }) => id === floorId)) return;
    const epoch = this.scopeEpoch;
    this.api
      .getFloorLayout(floorId)
      .pipe(take(1), takeUntil(this.scopeCancel), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (layout) => {
          if (epoch !== this.scopeEpoch || layout.floor.id !== floorId) return;
          this._floorLayouts.update((layouts) => ({ ...layouts, [floorId]: layout }));
        },
        error: () => {
          if (epoch === this.scopeEpoch && this.selectedFloorId() === floorId)
            this._error.set(this.strings.errors.loadFailed);
        },
      });
  }

  prepareFloorCanvas(): void {
    const floor = this.floors().find(({ id }) => id === this.selectedFloorId());
    if (
      !floor ||
      !this.canEditMetadata() ||
      this.loading() ||
      this.busy() ||
      !this.isCurrentScope()
    )
      return;
    if (this.sectorId()) return;
    const epoch = this.scopeEpoch;
    const finishWrite = this.beginWrite();
    this._error.set(null);
    this.api
      .createFloorCanvas(floor.id, floor.name, FLOOR_CANVAS_SLUG)
      .pipe(
        catchError((error: { status?: number }) =>
          error.status === 409
            ? this.api.listSectorsByFloor(floor.id).pipe(
                map((items) => {
                  const canvas = items.find(({ slug }) => slug === FLOOR_CANVAS_SLUG);
                  if (!canvas)
                    throw new Error('Floor canvas could not be recovered', { cause: error });
                  return canvas;
                }),
              )
            : throwError(() => error),
        ),
        switchMap((canvas) => {
          if (canvas.width === floor.canvasWidth && canvas.height === floor.canvasHeight)
            return of(canvas);
          return this.api
            .saveSectorLayout(canvas.id, {
              sector: {
                width: floor.canvasWidth,
                height: floor.canvasHeight,
                updatedAt: canvas.updatedAt,
              },
              elements: [],
            })
            .pipe(map(({ sector }) => sector));
        }),
        takeUntil(this.scopeCancel),
        takeUntilDestroyed(this.destroyRef),
        finalize(finishWrite),
      )
      .subscribe({
        next: (canvas) => {
          if (epoch !== this.scopeEpoch || this.selectedFloorId() !== floor.id) return;
          finishWrite();
          this._sectors.update((items) => [...items.filter(({ id }) => id !== canvas.id), canvas]);
          this.loadSector(canvas.id);
        },
        error: () => this._error.set(this.strings.errors.createFailed),
      });
  }

  saveFloorDimensions(width: number, height: number): void {
    const floorId = this.selectedFloorId();
    const floor = this.floors().find(({ id }) => id === floorId);
    if (
      !floor ||
      !this.canEditMetadata() ||
      !this.isCurrentScope() ||
      this.busy() ||
      this.loading() ||
      this.conflict()
    )
      return;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 20 || height < 20) {
      this._error.set(this.strings.errors.saveInvalid);
      return;
    }
    if (width === floor.canvasWidth && height === floor.canvasHeight) return;
    const canvas = this.floorCanvas();
    if (canvas && this.dirty()) return;

    const epoch = this.scopeEpoch;
    const finishWrite = this.beginWrite();
    this._error.set(null);
    this.api
      .saveFloorLayout(floor.id, {
        floor: { canvasWidth: width, canvasHeight: height, updatedAt: floor.updatedAt },
        sectors: canvas
          ? [
              {
                id: canvas.id,
                x: canvas.x,
                y: canvas.y,
                rotation: canvas.rotation,
                width,
                height,
                updatedAt: canvas.updatedAt,
              },
            ]
          : [],
      })
      .pipe(take(1), takeUntilDestroyed(this.destroyRef), finalize(finishWrite))
      .subscribe({
        next: ({ floor: saved, sectors }) => {
          if (epoch !== this.scopeEpoch || !this.isCurrentScope()) return;
          if (
            saved.id !== floor.id ||
            saved.canvasWidth !== width ||
            saved.canvasHeight !== height
          ) {
            this._error.set(this.strings.errors.saveIncomplete);
            return;
          }
          this._floors.update((items) =>
            items.map((item) => (item.id === saved.id ? saved : item)),
          );
          const resized = sectors.find(({ id }) => id === canvas?.id);
          if (resized) {
            this._sectors.update((items) =>
              items.map((item) => (item.id === resized.id ? { ...item, ...resized } : item)),
            );
            if (this.sectorId() === resized.id) {
              const size = { width: resized.width, height: resized.height };
              this._sectorUpdatedAt.set(resized.updatedAt);
              this.baselineSize.set(size);
              this._layout.update((layout) => ({ ...layout, size }));
            }
          }
        },
        error: (response: { status?: number }) => {
          if (epoch !== this.scopeEpoch || !this.isCurrentScope()) return;
          if (response?.status === 409) {
            this._error.set(STRINGS.spaces.floorEditor.errors.conflict);
          } else {
            this._error.set(
              response?.status === 400
                ? this.strings.errors.saveInvalid
                : STRINGS.spaces.floorEditor.errors.saveFailed,
            );
          }
        },
      });
  }

  loadFloorsByEstablishment(establishmentId: string): void {
    const activeId = this.activeEstablishmentId;
    if (!activeId || establishmentId !== activeId) return;
    const epoch = this.scopeEpoch;
    this._loading.set(true);
    this._error.set(null);

    this.api
      .listFloorsByEstablishment(establishmentId)
      .pipe(takeUntil(this.scopeCancel), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (floors: Floor[]) => {
          if (epoch !== this.scopeEpoch || this.activeEstablishmentId !== activeId) return;
          this._floors.set(floors);
          const firstFloor =
            floors.find((floor) => floor.id === this.requestedFloorId) ?? floors[0];
          if (
            firstFloor &&
            (!this._selectedFloorId() ||
              (this.requestedFloorId !== null && firstFloor.id !== this._selectedFloorId()))
          ) {
            this.selectFloor(firstFloor.id, !this.requestedFloorId && !this.requestedSectorId);
          }
          if (!firstFloor) this._loading.set(false);
        },
        error: () => {
          this._error.set(this.strings.errors.loadFailed);
          this._loading.set(false);
        },
      });
  }

  selectFloor(floorId: string, findPopulatedFloor = false): void {
    if (this._saving()) return;
    if (!this._floors().some((floor) => floor.id === floorId)) return;
    if (this._selectedFloorId() === floorId) return;

    this._selectedFloorId.set(floorId);
    this.resourceEpoch++;
    this.validatedSectorId = null;
    this._sectorId.set(null);
    this._metadata.set({});
    this._selectedId.set(null);
    this._metadataError.set(null);
    this._sectorUpdatedAt.set(null);
    this._activeDragCoords.set(null);
    this.resetDraft();
    this._layout.set(LAYOUT_VACIO);
    this._sectors.set([]);
    this._loading.set(true);
    this.loadSectorsByFloor(floorId, findPopulatedFloor);
  }

  private loadSectorsByFloor(floorId: string, findPopulatedFloor: boolean): void {
    if (!this.activeEstablishmentId || !this._floors().some((floor) => floor.id === floorId))
      return;
    const epoch = this.scopeEpoch;
    const resourceEpoch = this.resourceEpoch;
    this.api
      .listSectorsByFloor(floorId)
      .pipe(takeUntil(this.scopeCancel), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sectors: Sector[]) => {
          if (
            epoch !== this.scopeEpoch ||
            resourceEpoch !== this.resourceEpoch ||
            this._selectedFloorId() !== floorId ||
            !this._floors().some((floor) => floor.id === floorId)
          )
            return;
          this._sectors.set(sectors);
          const firstSector =
            sectors.find((sector) => sector.id === this.requestedSectorId) ??
            sectors.find(({ slug }) => slug === FLOOR_CANVAS_SLUG) ??
            sectors[0];
          const currentId = this._sectorId();
          if (currentId) {
            // HU-4.01 (I-7): si el sector se cargó antes que la lista del piso,
            // aplica ahora sus dimensiones reales en vez del fallback 1200x800.
            const meta = sectors.find((s) => s.id === currentId);
            if (meta && meta.width != null && meta.height != null) {
              this._sectorUpdatedAt.set(meta.updatedAt ?? null);
              this._layout.update((l) => ({
                ...l,
                size: { width: meta.width, height: meta.height },
              }));
            }
            return;
          }
          if (firstSector) {
            this.loadSector(firstSector.id, firstSector.name);
          } else if (findPopulatedFloor) {
            const floors = this._floors();
            const nextFloor = floors[floors.findIndex((floor) => floor.id === floorId) + 1];
            if (nextFloor) {
              this.selectFloor(nextFloor.id, true);
              return;
            }
            this._layout.set(LAYOUT_VACIO);
            this._loading.set(false);
          } else {
            this._layout.set(LAYOUT_VACIO);
            this._sectorId.set(null);
            this._loading.set(false);
          }
        },
        error: () => {
          if (epoch !== this.scopeEpoch || resourceEpoch !== this.resourceEpoch) return;
          this._loading.set(false);
          this._error.set(this.strings.errors.loadFailed);
        },
      });
  }

  switchSector(sectorId: string, sectorName?: string): void {
    this.loadSector(sectorId, sectorName);
  }

  loadSector(sectorId: string, sectorName?: string): void {
    // Si el sector ya está cargado o está en proceso de carga, abortar.
    // No validamos length > 0 porque hay sectores que legítimamente están vacíos.
    if (
      this._saving() ||
      !this.activeEstablishmentId ||
      !this._sectors().some((sector) => sector.id === sectorId)
    )
      return;
    if (this._sectorId() === sectorId) return;
    const epoch = this.scopeEpoch;
    const resourceEpoch = ++this.resourceEpoch;

    this._sectorId.set(sectorId);
    this.validatedSectorId = null;
    this.resetDraft();
    this._metadata.set({});
    this._selectedId.set(null);
    this._metadataError.set(null);
    this._activeDragCoords.set(null);
    this._layout.set(LAYOUT_VACIO);
    this._loading.set(true);
    this._error.set(null);

    // HU-4.01: dimensiones reales del sector (el layout usa el lienzo persistido,
    // no la constante DEFAULT_SECTOR_SIZE).
    const sectorMeta = this._sectors().find((s) => s.id === sectorId);
    const sectorSize: Size = {
      width: sectorMeta?.width ?? DEFAULT_SECTOR_SIZE.width,
      height: sectorMeta?.height ?? DEFAULT_SECTOR_SIZE.height,
    };
    this._sectorUpdatedAt.set(sectorMeta?.updatedAt ?? null);

    this.api
      .listSpaceElementsBySector(sectorId)
      .pipe(takeUntil(this.scopeCancel), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (elements: SpaceElement[]) => {
          if (
            epoch !== this.scopeEpoch ||
            !this.isCurrentScope() ||
            resourceEpoch !== this.resourceEpoch ||
            this._sectorId() !== sectorId ||
            !this._sectors().some((sector) => sector.id === sectorId)
          )
            return;
          const scopedElements = elements.filter((element) => element.sectorId === sectorId);
          this._metadata.set(Object.fromEntries(scopedElements.map((el) => [el.id, el])));
          this.validatedSectorId = sectorId;
          const layoutElements = scopedElements.map(mapApiElementToLayoutElement);
          this.baselineSize.set(sectorSize);
          const appearance = this.loadAppearance(sectorMeta, sectorId, scopedElements);
          this.baselineAppearance.set(appearance);
          this._appearance.set(appearance);
          this._layout.set({
            floorId: this._selectedFloorId() ?? '',
            name: sectorMeta?.name ?? sectorName ?? '',
            size: sectorSize,
            elements: layoutElements,
            schemaVersion: 1,
            kind: 'sector',
            sectors: [],
          });
          this._loading.set(false);
        },
        error: () => {
          if (epoch !== this.scopeEpoch || resourceEpoch !== this.resourceEpoch) return;
          this._error.set(this.strings.errors.loadFailed);
          this._loading.set(false);
        },
      });
  }

  saveElementMetadata(id: string, labelInput: string, capacityInput: string): void {
    const element = this.elements().find((item) => item.id === id);
    if (!this.canEdit() || this.busy() || !this.isCurrentSector() || !element) return;
    const label = labelInput.trim() || null;
    const capacity =
      element.reservable && capacityInput.trim() ? Number(capacityInput.trim()) : null;
    if (
      (label && label.length > 120) ||
      (capacity !== null && (!Number.isSafeInteger(capacity) || capacity < 1))
    ) {
      this._metadataError.set(this.strings.metadataInvalid);
      return;
    }
    const current = this.metadataFor(id);
    if (current.label === label && current.capacity === capacity) return;
    this.captureDraft();
    this._metadataError.set(null);
    this._draftMetadata.update((items) => ({ ...items, [id]: { label, capacity } }));
    this._layout.update((layout) => ({
      ...layout,
      elements: layout.elements.map((item) =>
        item.id === id
          ? { ...item, label: label ?? STRINGS.spaces.elements.types[item.type], capacity }
          : item,
      ),
    }));
  }

  clearElementMetadata(id: string): void {
    this.saveElementMetadata(id, '', '');
  }

  dragElement(id: SpaceElementId, x: number, y: number): void {
    const element = this.elements().find((el) => el.id === id);
    this._activeDragCoords.set(null);
    if (!element || !Number.isFinite(x) || !Number.isFinite(y)) return;
    this.updateGeometry({
      ...element,
      position: constrainPlacement({ x, y }, element.size, this.sectorSize(), element.rotation),
    });
  }

  updateElementPositionLocal(id: SpaceElementId, x: number, y: number): void {
    if (!this.canEdit() || this.busy() || !this.isCurrentSector()) return;
    this._activeDragCoords.set({ id, x, y });
  }

  rotateElement(id: SpaceElementId, rotation: number): void {
    const element = this.elements().find((el) => el.id === id);
    if (element) this.updateGeometry({ ...element, rotation: ((rotation % 360) + 360) % 360 });
  }

  resizeElement(
    id: SpaceElementId,
    x: number,
    y: number,
    width: number,
    height: number,
    rotation?: number,
  ): void {
    const element = this.elements().find((el) => el.id === id);
    if (element) {
      const size = { width: Math.max(20, width), height: Math.max(20, height) };
      const angle = rotation ?? element.rotation;
      this.updateGeometry({
        ...element,
        position: constrainPlacement({ x, y }, size, this.sectorSize(), angle),
        size,
        rotation: angle,
      });
    }
  }

  private updateGeometry(next: Geometry): void {
    if (!this.canEdit() || this.busy() || !this.isCurrentSector()) return;
    const current = this.elements().find((el) => el.id === next.id);
    if (!current) return;
    const { x, y } = next.position;
    const { width, height } = next.size;
    if (![x, y, width, height, next.rotation].every(Number.isFinite)) return;
    if (
      x === current.position.x &&
      y === current.position.y &&
      width === current.size.width &&
      height === current.size.height &&
      next.rotation === current.rotation
    )
      return;
    this.captureDraft();
    this.applyGeometry(next);
  }

  undo(): void {
    this.restoreGeometry(this.undoStack, this.redoStack);
  }

  redo(): void {
    this.restoreGeometry(this.redoStack, this.undoStack);
  }

  private restoreGeometry(
    from: WritableSignal<readonly DraftSnapshot[]>,
    to: WritableSignal<readonly DraftSnapshot[]>,
  ): void {
    if (!this.canEdit() || this.busy() || !this.isCurrentSector()) return;
    const change = from().at(-1);
    if (!change) return;
    from.update((items) => items.slice(0, -1));
    to.update((items) => [...items, this.snapshotDraft()]);
    this._layout.set(change.layout);
    this._draftMetadata.set(change.metadata);
    this._appearance.set(change.appearance);
    this._saved.set(false);
    if (!this.elements().some(({ id }) => id === this.selectedId())) this.selectElement(null);
  }

  private metadataFor(id: string): ElementMetadata {
    const draft = this._draftMetadata()[id];
    const saved = this._metadata()[id];
    return draft ?? { label: saved?.label ?? null, capacity: saved?.capacity ?? null };
  }

  private snapshotDraft(): DraftSnapshot {
    return {
      layout: this.layout(),
      metadata: this._draftMetadata(),
      appearance: this.appearance(),
    };
  }

  private loadAppearance(
    sector: Sector | undefined,
    sectorId: string,
    elements: SpaceElement[],
  ): LayoutStyle {
    if (sector?.appearance) return normalizeLayoutStyle(sector.appearance);
    try {
      // Los sectores personalizados antes del guardado compartido se importan al guardar.
      const legacy = localStorage.getItem(
        `mapit.editor.style.${this.activeEstablishmentId}.${sectorId}`,
      );
      if (legacy) {
        const original = normalizeLayoutStyle(JSON.parse(legacy) as LayoutStyle);
        const ids = new Set(elements.map(({ id }) => id));
        return {
          ...original,
          elements: Object.fromEntries(
            Object.entries(original.elements).filter(([id]) => ids.has(id)),
          ),
        };
      }
    } catch {
      // Las preferencias locales son opcionales.
    }
    return { elements: {} };
  }

  updateAppearance(update: (current: LayoutStyle) => LayoutStyle): void {
    if (!this.canEdit() || this.busy() || !this.isCurrentSector()) return;
    const current = this.appearance();
    const next = normalizeLayoutStyle(update(current));
    if (JSON.stringify(current) === JSON.stringify(next)) return;
    this.captureDraft();
    this._appearance.set(next);
  }

  private captureDraft(): void {
    if (this.arranging) return;
    this.undoStack.update((items) => [...items.slice(-99), this.snapshotDraft()]);
    this.redoStack.set([]);
    this._saved.set(false);
  }

  private applyGeometry(next: Geometry): void {
    const { id, position, size, rotation } = next;
    this._saved.set(false);
    this._layout.update((layout) => ({
      ...layout,
      elements: layout.elements.map((el) =>
        el.id === id ? { ...el, position, size, rotation } : el,
      ),
    }));
  }

  reloadSector(): void {
    const id = this.sectorId();
    const floor = this.selectedFloorId();
    if (!id || !floor || this.busy() || !this.isCurrentScope()) return;
    this.requestedSectorId = id;
    this._selectedFloorId.set(null);
    this.selectFloor(floor);
  }

  saveChanges(): Promise<boolean> {
    if (this.busy() || !this.canEdit() || !this.isCurrentSector()) return Promise.resolve(false);
    const size = this.sectorSize();
    return this.dirty()
      ? this.saveSectorDimensions(size.width, size.height)
      : Promise.resolve(true);
  }

  discardChanges(): boolean {
    if (this.busy() || !this.isCurrentSector()) return false;
    this._layout.update((layout) => ({
      ...layout,
      size: this.baselineSize(),
      elements: Object.values(this._metadata()).map(mapApiElementToLayoutElement),
    }));
    this._appearance.set(this.baselineAppearance());
    if (!this.elements().some(({ id }) => id === this.selectedId())) this.selectElement(null);
    this._activeDragCoords.set(null);
    this._metadataError.set(null);
    this._error.set(null);
    this.resetDraft();
    return true;
  }

  clearError(): void {
    this._error.set(null);
  }

  // ===== PLANTILLAS (HU-4.02) =====

  private readonly _templates = signal<ElementTemplate[]>([]);
  readonly templates = this._templates.asReadonly();
  private readonly _templatesLoading = signal(false);
  readonly templatesLoading = this._templatesLoading.asReadonly();

  loadTemplates(): void {
    this._templatesLoading.set(true);
    this._error.set(null);
    this.api
      .listTemplates()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (templates) => {
          this._templates.set(templates);
          this._templatesLoading.set(false);
        },
        error: () => {
          this._error.set(this.strings.errors.loadFailed);
          this._templatesLoading.set(false);
        },
      });
  }

  saveAsTemplate(name: string): void {
    if (!this.canEdit() || this.busy()) return;
    const selected = this.selectedElement();
    if (!selected) {
      this._error.set(this.strings.errors.selectElementToSave);
      return;
    }

    const templateName = name.trim();
    if (!templateName) {
      this._error.set(this.strings.errors.templateNameRequired);
      return;
    }

    const finishWrite = this.beginWrite();
    this._error.set(null);

    const request: ElementTemplateCreateRequest = {
      name: templateName,
      type: selected.type,
    };

    this.api
      .createTemplate(request)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(finishWrite))
      .subscribe({
        next: () => {
          this._error.set(null);
          this.loadTemplates();
        },
        error: (response: { status?: number }) => {
          this._error.set(
            response?.status === 409
              ? this.strings.errors.templateNameConflict
              : this.strings.errors.saveFailed,
          );
        },
      });
  }

  // ===== HU-4.01: alta desde la biblioteca (drag & drop) =====

  /**
   * Crea un elemento soltando una plantilla o estructura base sobre el canvas.
   * {@code key} es `tpl:<id>` (plantilla guardada) o `base:<TYPE>` (estructura).
   * El alta es la de siempre (POST /elements) en las coordenadas del drop (CA-11).
   */
  createArrangement(
    type: SpaceElementType,
    x: number,
    y: number,
    rows: number,
    columns: number,
    gap: number,
    options: ElementInsertion,
  ): void {
    if (
      !Object.hasOwn(TYPE_DEFAULTS, type) ||
      !this.canEdit() ||
      this.busy() ||
      !this.isCurrentSector()
    )
      return;
    const size = options.size ?? TYPE_DEFAULTS[type].size;
    const width = columns * size.width + (columns - 1) * gap;
    const height = rows * size.height + (rows - 1) * gap;
    if (
      !Number.isInteger(rows) ||
      !Number.isInteger(columns) ||
      rows < 1 ||
      columns < 1 ||
      rows > 10 ||
      columns > 10 ||
      !Number.isFinite(gap) ||
      gap < 0 ||
      gap > 200 ||
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      width > this.sectorSize().width ||
      height > this.sectorSize().height ||
      (options.label?.length ?? 0) > 110
    ) {
      this._error.set(this.strings.errors.createInvalid);
      return;
    }
    const before = this.snapshotDraft();
    const history = this.undoStack(),
      redo = this.redoStack(),
      selected = this.selectedId();
    const origin = constrainPlacement({ x, y }, { width, height }, this.sectorSize(), 0);
    this.captureDraft();
    this.arranging = true;
    try {
      for (let row = 0; row < rows; row++)
        for (let column = 0; column < columns; column++) {
          const count = this.elements().length;
          this.createElementFromDrop(
            'base:' + type,
            origin.x + column * (size.width + gap),
            origin.y + row * (size.height + gap),
            {
              ...options,
              rotation: 0,
              label:
                (options.label?.trim() || STRINGS.spaces.elements.types[type]) +
                ' ' +
                (row * columns + column + 1),
            },
          );
          if (this.elements().length !== count + 1) {
            this._layout.set(before.layout);
            this._draftMetadata.set(before.metadata);
            this._appearance.set(before.appearance);
            this.undoStack.set(history);
            this.redoStack.set(redo);
            this.selectElement(selected);
            return;
          }
        }
    } finally {
      this.arranging = false;
    }
  }

  createElementFromDrop(key: string, x: number, y: number, options: ElementInsertion = {}): void {
    const sectorId = this._sectorId();
    if (!sectorId || !this.canEdit() || !this.isCurrentSector() || this._saving()) {
      this._error.set(this.strings.errors.noSectorLoaded);
      return;
    }

    const duplicate = key.startsWith('copy:')
      ? this.elements().find((el) => el.id === key.slice(5))
      : undefined;
    let type: SpaceElementType | null = duplicate?.type ?? null;
    if (key.startsWith('tpl:')) {
      const template = this._templates().find((t) => t.id === key.slice(4));
      type = template?.type ?? null;
    } else if (key.startsWith('base:')) {
      type = key.slice(5) as SpaceElementType;
    }
    if (
      !type ||
      !Object.hasOwn(TYPE_DEFAULTS, type) ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      this._error.set(this.strings.errors.templateNotFound);
      return;
    }

    const size = options.size ?? duplicate?.size ?? TYPE_DEFAULTS[type].size;
    const rotation = options.rotation ?? duplicate?.rotation ?? 0;
    const sourceMetadata = duplicate ? this.metadataFor(duplicate.id) : undefined;
    const capacity =
      options.capacity !== undefined
        ? options.capacity
        : (sourceMetadata?.capacity ?? TYPE_DEFAULTS[type].capacity);
    const label = (options.label ?? sourceMetadata?.label)?.trim() || null;
    if (
      !Number.isFinite(size.width) ||
      !Number.isFinite(size.height) ||
      size.width < 20 ||
      size.height < 20 ||
      !Number.isFinite(rotation) ||
      (label !== null && label.length > 120) ||
      (capacity !== null &&
        (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 2147483647))
    ) {
      this._error.set(this.strings.errors.createInvalid);
      return;
    }
    const position = constrainPlacement({ x, y }, size, this.sectorSize(), rotation);
    const id = globalThis.crypto.randomUUID();
    this.captureDraft();
    const finish = options.finish ?? (duplicate && this.appearance().elements[duplicate.id]);
    if (finish) {
      this._appearance.update((appearance) =>
        normalizeLayoutStyle({ ...appearance, elements: { ...appearance.elements, [id]: finish } }),
      );
    }
    this._error.set(null);
    this._draftMetadata.update((items) => ({
      ...items,
      [id]: { label, capacity: TYPE_DEFAULTS[type].reservable ? capacity : null },
    }));
    this._layout.update((layout) => ({
      ...layout,
      elements: [
        ...layout.elements,
        {
          id,
          type,
          label: label ?? STRINGS.spaces.elements.types[type],
          position,
          size,
          rotation,
          state: 'AVAILABLE',
          capacity,
          reservable: TYPE_DEFAULTS[type].reservable,
          attributes: {},
        },
      ],
    }));
    this.selectElement(id);
  }

  /** HU-4.01: baja lógica del elemento (409 si tiene reservas activas, RN-1). */
  confirmDeleteElement(elementId: string): void {
    if (!this.canEdit() || this.busy() || !this.isCurrentSector()) return;
    const element = this.elements().find(({ id }) => id === elementId);
    if (element && window.confirm(this.strings.deleteConfirm.replace('{label}', element.label))) {
      this.deleteElement(elementId);
    }
  }

  deleteElement(elementId: string): void {
    if (!this.canEdit() || this.busy() || !this.isCurrentSector()) return;
    if (!this.elements().some(({ id }) => id === elementId)) return;
    this.captureDraft();
    const styles = { ...this.appearance().elements };
    delete styles[elementId];
    this._appearance.update((appearance) => ({ ...appearance, elements: styles }));
    this._layout.update((layout) => ({
      ...layout,
      elements: layout.elements.filter(({ id }) => id !== elementId),
    }));
    if (this.selectedId() === elementId) this.selectElement(null);
  }

  setSectorDimensions(width: number, height: number): boolean {
    if (!this.canEdit() || this.busy() || !this.isCurrentSector()) return false;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 20 || height < 20) {
      this._error.set(this.strings.errors.saveInvalid);
      return false;
    }
    if (this.sectorSize().width === width && this.sectorSize().height === height) return true;
    this.captureDraft();
    this._layout.update((layout) => ({ ...layout, size: { width, height } }));
    return true;
  }

  /** HU-4.01: cambia las dimensiones intrínsecas del sector (vista sector, RN-6).
   * Va por el guardado por lotes del sector; 409 si alguien editó debajo. */
  saveSectorDimensions(width: number, height: number): Promise<boolean> {
    const sectorId = this._sectorId();
    const version = this._sectorUpdatedAt();
    if (!sectorId || !this.canEdit() || !this.isCurrentSector() || this.busy() || this.conflict())
      return Promise.resolve(false);
    if (!version) {
      this._conflict.set(true);
      this._error.set(this.strings.errors.conflict);
      return Promise.resolve(false);
    }
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 20 || height < 20) {
      this._error.set(this.strings.errors.saveInvalid);
      return Promise.resolve(false);
    }

    const finishWrite = this.beginWrite();
    this._error.set(null);
    this._saved.set(false);
    const epoch = this.scopeEpoch;
    const appearance = this.appearance();
    const sector = this.sectors().find((item) => item.id === sectorId);
    const sendAppearance =
      this.appearanceChanged() ||
      (!sector?.appearance && (appearance.room || Object.keys(appearance.elements).length));
    const expectedIds = this.elements().map(({ id }) => id);
    const request: SectorLayoutUpdateRequest = {
      sector: { width, height, updatedAt: version },
      ...(sendAppearance ? { appearance } : {}),
      elements: this.changes().map((el) => ({
        id: el.id,
        x: el.position.x,
        y: el.position.y,
        width: el.size.width,
        height: el.size.height,
        rotation: el.rotation,
        updatedAt: this._metadata()[el.id]!.updatedAt,
      })),
      ...(this.addedElements().length
        ? {
            createdElements: this.addedElements().map((el) => ({
              id: el.id,
              type: el.type,
              x: el.position.x,
              y: el.position.y,
              width: el.size.width,
              height: el.size.height,
              rotation: el.rotation,
              ...this.metadataFor(el.id),
            })),
          }
        : {}),
      ...(this.deletedElements().length
        ? {
            deletedElements: this.deletedElements().map(({ id, updatedAt }) => ({
              id,
              updatedAt,
            })),
          }
        : {}),
      ...(this.metadataChanges().length
        ? {
            metadataUpdates: this.metadataChanges().map(({ id }) => ({
              id,
              updatedAt: this._metadata()[id]!.updatedAt,
              ...this.metadataFor(id),
            })),
          }
        : {}),
    };
    return new Promise<boolean>((resolve) => {
      let succeeded = false;
      this.api
        .saveSectorLayout(sectorId, request)
        .pipe(
          take(1),
          takeUntilDestroyed(this.destroyRef),
          finalize(() => {
            finishWrite();
            resolve(succeeded);
          }),
        )
        .subscribe({
          next: (response) => {
            if (
              epoch !== this.scopeEpoch ||
              !this.isCurrentScope() ||
              this._sectorId() !== sectorId
            )
              return;
            if (!confirmsLayoutSave(sectorId, request, response, expectedIds)) {
              this._error.set(this.strings.errors.saveIncomplete);
              return;
            }
            this._sectorUpdatedAt.set(response.sector.updatedAt);
            this.baselineSize.set({ width: response.sector.width, height: response.sector.height });
            const savedAppearance = normalizeLayoutStyle(response.sector.appearance);
            this.baselineAppearance.set(savedAppearance);
            this._appearance.set(savedAppearance);
            this._sectors.update((sectors) =>
              sectors.map((sector) =>
                sector.id === sectorId ? { ...sector, ...response.sector } : sector,
              ),
            );
            const elements = response.elements.filter((el) => el.sectorId === sectorId);
            this._metadata.set(Object.fromEntries(elements.map((el) => [el.id, el])));
            this._draftMetadata.set({});
            this.undoStack.set([]);
            this.redoStack.set([]);
            this._layout.update((l) => ({
              ...l,
              size: { width: response.sector.width, height: response.sector.height },
              elements: elements.map(mapApiElementToLayoutElement),
            }));
            this._saved.set(true);
            succeeded = true;
          },
          error: (response: { status?: number; error?: { type?: string } }) => {
            if (epoch !== this.scopeEpoch || !this.isCurrentScope()) return;
            const hasReservations =
              response?.error?.type ===
              'https://mapit.local/problems/element-has-active-reservations';
            this._conflict.set(response?.status === 409 && !hasReservations);
            this._error.set(
              hasReservations
                ? this.strings.errors.deleteReserved
                : response?.status === 409
                  ? this.strings.errors.conflict
                  : response?.status === 400
                    ? this.strings.errors.saveInvalid
                    : this.strings.errors.saveFailed,
            );
          },
        });
    });
  }

  private isCurrentScope(): boolean {
    return (
      this.activeEstablishmentId !== null &&
      this.context.status() === 'ready' &&
      this.context.active()?.id === this.activeEstablishmentId
    );
  }

  private isCurrentSector(): boolean {
    const sectorId = this._sectorId();
    return Boolean(
      sectorId &&
      this.validatedSectorId === sectorId &&
      this.isCurrentScope() &&
      this._sectors().some((sector) => sector.id === sectorId),
    );
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
}
