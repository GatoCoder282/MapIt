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
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { MapEditorApiService } from '../data/map-editor-api';
import type { SpaceElement, SpaceElementUpdateRequest, Sector, Floor } from '@mapit/api-client';
import {
  type MapLayout,
  type SpaceElement as MapSpaceElement,
  type SpaceElementId,
  type SpaceElementType,
  type Point,
  type Size,
  LAYOUT_VACIO,
} from '@mapit/map-engine';

import { STRINGS } from '../../../core/strings';

const DEFAULT_SECTOR_SIZE: Size = { width: 1200, height: 800 };

const TYPE_DEFAULTS: Record<
  SpaceElementType,
  { size: Size; capacity: number | null; reservable: boolean }
> = {
  TABLE: { size: { width: 80, height: 80 }, capacity: 4, reservable: true },
  BAR: { size: { width: 200, height: 60 }, capacity: null, reservable: false },
  SECTOR_ZONE: { size: { width: 300, height: 200 }, capacity: null, reservable: false },
  STAGE: { size: { width: 400, height: 200 }, capacity: null, reservable: false },
  SEAT: { size: { width: 40, height: 40 }, capacity: 1, reservable: true },
  ROOM: { size: { width: 100, height: 100 }, capacity: 2, reservable: true },
  DECOR: { size: { width: 60, height: 60 }, capacity: null, reservable: false },
};

function mapApiElementToLayoutElement(el: SpaceElement): MapSpaceElement {
  const defaults = TYPE_DEFAULTS[el.type] ?? TYPE_DEFAULTS.TABLE;
  return {
    id: el.id,
    type: el.type,
    label: `${el.type} ${el.id.slice(0, 6)}`,
    position: { x: el.x, y: el.y },
    size: defaults.size,
    rotation: 0,
    state: el.state,
    capacity: defaults.capacity,
    reservable: defaults.reservable,
    attributes: {},
  };
}

function clampPosition(
  x: number,
  y: number,
  elementWidth: number,
  elementHeight: number,
  sectorWidth: number,
  sectorHeight: number,
): Point {
  const clampedX = Math.max(0, Math.min(x, sectorWidth - elementWidth));
  const clampedY = Math.max(0, Math.min(y, sectorHeight - elementHeight));
  return { x: clampedX, y: clampedY };
}

interface PendingSave {
  elementId: SpaceElementId;
  previousPosition: Point;
}

interface ActiveDragCoords {
  id: SpaceElementId;
  x: number;
  y: number;
}

@Injectable({ providedIn: 'root' })
export class MapEditorStore {
  private readonly api = inject(MapEditorApiService);
  private readonly strings = STRINGS.spaces.editor;
  private readonly destroyRef = inject(DestroyRef);

  private readonly _sectorId = signal<string | null>(null);
  readonly sectorId = this._sectorId.asReadonly();

  private readonly _selectedFloorId = signal<string | null>(null);
  readonly selectedFloorId = this._selectedFloorId.asReadonly();

  private readonly _layout: WritableSignal<MapLayout> = signal(LAYOUT_VACIO);
  readonly layout: Signal<MapLayout> = this._layout.asReadonly();

  readonly elements = computed(() => this._layout().elements);
  readonly sectorSize = computed(() => this._layout().size);
  readonly sectorName = computed(() => this._layout().name);

  // Floor selection
  private readonly _floors = signal<Floor[]>([]);
  readonly floors = this._floors.asReadonly();

  // Sector selection
  private readonly _sectors = signal<Sector[]>([]);
  readonly sectors = this._sectors.asReadonly();

  // Computed: sectors for the currently selected floor
  // Sectors are already filtered by floor when loaded via loadSectorsByFloor
  readonly sectorsForSelectedFloor = computed(() => this._sectors());

  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();
  private readonly _saving = signal(false);
  readonly saving = this._saving.asReadonly();
  private readonly _error = signal<string | null>(null);
  readonly error = this._error.asReadonly();

  private pendingSave: PendingSave | null = null;

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
      const sectorId = this._sectorId();
      if (sectorId) {
        this.loadSector(sectorId);
      } else {
        this._layout.set(LAYOUT_VACIO);
      }
    });

    toObservable(this.layout)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        debounceTime(300),
        distinctUntilChanged((prev: MapLayout, curr: MapLayout) => prev.elements === curr.elements),
      )
      .subscribe(() => {
        this.debouncedPersist();
      });
  }

  /** Selecciona un elemento por ID (actualiza selectedId, selectedElement es computed reactivo) */
  selectElement(id: string | null): void {
    this._selectedId.set(id);
  }

  // Floor methods
  loadFloorsByEstablishment(establishmentId: string): void {
    this._loading.set(true);
    this._error.set(null);

    this.api
      .listFloorsByEstablishment(establishmentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (floors: Floor[]) => {
          this._floors.set(floors);
          const firstFloor = floors[0];
          if (firstFloor && !this._selectedFloorId()) {
            this.selectFloor(firstFloor.id);
          }
          this._loading.set(false);
        },
        error: () => {
          this._error.set(this.strings.errors.loadFailed);
          this._loading.set(false);
        },
      });
  }

  selectFloor(floorId: string): void {
    if (this._selectedFloorId() === floorId) return;

    this._selectedFloorId.set(floorId);
    this._sectors.set([]);
    this.loadSectorsByFloor(floorId);
  }

  loadSectorsByFloor(floorId: string): void {
    this.api
      .listSectorsByFloor(floorId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sectors: Sector[]) => {
          this._sectors.set(sectors);
          const firstSector = sectors[0];
          if (firstSector) {
            this.loadSector(firstSector.id, firstSector.name);
          } else {
            this._layout.set(LAYOUT_VACIO);
            this._sectorId.set(null);
          }
        },
        error: () => {
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
    if (this._sectorId() === sectorId) return;

    this._sectorId.set(sectorId);
    this._loading.set(true);
    this._error.set(null);

    this.api
      .listSpaceElementsBySector(sectorId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (elements: SpaceElement[]) => {
          const layoutElements = elements.map(mapApiElementToLayoutElement);
          this._layout.set({
            floorId: '',
            name: sectorName || 'Sector',
            size: DEFAULT_SECTOR_SIZE,
            elements: layoutElements,
            schemaVersion: 1,
          });
          this._loading.set(false);
        },
        error: () => {
          this._error.set(this.strings.errors.loadFailed);
          this._loading.set(false);
        },
      });
  }

  dragElement(id: SpaceElementId, x: number, y: number): void {
    const element = this._layout().elements.find((el) => el.id === id);
    if (!element) return;

    const { width, height } = element.size;
    const { width: sectorWidth, height: sectorHeight } = this.sectorSize();
    const clamped = clampPosition(x, y, width, height, sectorWidth, sectorHeight);

    // Only update if position actually changed (prevents spurious updates from clicks)
    if (clamped.x === element.position.x && clamped.y === element.position.y) {
      return;
    }

    this.pendingSave = { elementId: id, previousPosition: element.position };

    this._layout.update((current) => ({
      ...current,
      elements: current.elements.map((el) => (el.id === id ? { ...el, position: clamped } : el)),
    }));

    // Limpiar coords de arrastre activo
    this._activeDragCoords.set(null);
  }

  /** Actualiza posición localmente (dragmove) SIN disparar persistencia ni efectos secundarios */
  updateElementPositionLocal(id: SpaceElementId, x: number, y: number): void {
    const element = this._layout().elements.find((el) => el.id === id);
    if (!element) return;

    const { width, height } = element.size;
    const { width: sectorWidth, height: sectorHeight } = this.sectorSize();
    const clamped = clampPosition(x, y, width, height, sectorWidth, sectorHeight);

    // Guard: ignore if position unchanged
    if (clamped.x === element.position.x && clamped.y === element.position.y) {
      return;
    }

    // Solo actualizar coords de arrastre activo (NO _layout)
    this._activeDragCoords.set({ id, x: clamped.x, y: clamped.y });
  }

  rotateElement(id: SpaceElementId, rotation: number): void {
    const normalizedRotation = ((rotation % 360) + 360) % 360;
    this._layout.update((current) => ({
      ...current,
      elements: current.elements.map((el) =>
        el.id === id ? { ...el, rotation: normalizedRotation } : el,
      ),
    }));
  }

  resizeElement(id: SpaceElementId, width: number, height: number): void {
    const clampedWidth = Math.max(20, width);
    const clampedHeight = Math.max(20, height);
    this._layout.update((current) => ({
      ...current,
      elements: current.elements.map((el) =>
        el.id === id ? { ...el, size: { width: clampedWidth, height: clampedHeight } } : el,
      ),
    }));
  }

  private debouncedPersist(): void {
    const layout = this._layout();
    const changedElements = layout.elements.filter((el) => {
      if (!this.pendingSave || this.pendingSave.elementId !== el.id) return false;
      return (
        el.position.x !== this.pendingSave.previousPosition.x ||
        el.position.y !== this.pendingSave.previousPosition.y
      );
    });

    if (changedElements.length === 0) return;

    const element = changedElements[0];
    if (element) {
      this.persistElementPosition(element);
    }
  }

  private persistElementPosition(element: MapSpaceElement): void {
    const sectorId = this._sectorId();
    if (!sectorId) return;

    this._saving.set(true);
    this._error.set(null);

    const request: SpaceElementUpdateRequest = {
      type: element.type,
      x: element.position.x,
      y: element.position.y,
    };

    this.api
      .updateSpaceElement(sectorId, element.id, request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this._saving.set(false);
          this.pendingSave = null;
        },
        error: (response: { status?: number }) => {
          this._saving.set(false);
          const status = response?.status;
          let message: string = this.strings.errors.saveFailed;
          if (status === 400) message = this.strings.errors.saveInvalid;
          else if (status === 404) message = this.strings.errors.notFound;
          else if (status === 409) message = this.strings.errors.conflict;

          this._error.set(message);
          this.rollbackElementPosition(element.id);
        },
      });
  }

  private rollbackElementPosition(elementId: SpaceElementId): void {
    if (!this.pendingSave || this.pendingSave.elementId !== elementId) return;
    this._layout.update((current) => ({
      ...current,
      elements: current.elements.map((el) =>
        el.id === elementId ? { ...el, position: this.pendingSave!.previousPosition } : el,
      ),
    }));
    this.pendingSave = null;
  }

  clearError(): void {
    this._error.set(null);
  }
}
