import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  InjectionToken,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { MapEditorApiService } from '../data/map-editor-api';
import type {
  SpaceElement,
  SpaceElementUpdateRequest,
  Sector,
  Floor,
  ElementTemplate,
  ElementTemplateCreateRequest,
} from '@mapit/api-client';
import { AuthSession } from '@mapit/auth';
import {
  type MapLayout,
  type SpaceElement as MapSpaceElement,
  type SpaceElementId,
  type SpaceElementType,
  type Point,
  type Size,
  LAYOUT_VACIO,
  TYPE_DEFAULTS,
} from '@mapit/map-engine';

import { STRINGS } from '../../../core/strings';

/** Catálogo de defaults por tipo (fuente única: `libs/map-engine`). */
export { TYPE_DEFAULTS };

export const MAP_EDITOR_DEBOUNCE_MS = new InjectionToken<number>('MAP_EDITOR_DEBOUNCE_MS', {
  providedIn: 'root',
  factory: () => 300,
});

const DEFAULT_SECTOR_SIZE: Size = { width: 1200, height: 800 };

export function mapApiElementToLayoutElement(el: SpaceElement): MapSpaceElement {
  const defaults = TYPE_DEFAULTS[el.type] ?? TYPE_DEFAULTS.TABLE;
  return {
    id: el.id,
    type: el.type,
    label: el.name ?? el.label ?? STRINGS.spaces.elements.types[el.type] + ' sin nombre',
    position: { x: el.x, y: el.y },
    size: { width: el.width ?? defaults.size.width, height: el.height ?? defaults.size.height },
    rotation: el.rotation ?? 0,
    state: el.state,
    capacity: el.capacity ?? null,
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
  previousRotation: number;
  previousSize: Size;
}

interface ActiveDragCoords {
  id: SpaceElementId;
  x: number;
  y: number;
}

@Injectable({ providedIn: 'root' })
export class MapEditorStore {
  private readonly api = inject(MapEditorApiService);
  private readonly session = inject(AuthSession);
  private readonly strings = STRINGS.spaces.editor;
  private readonly destroyRef = inject(DestroyRef);
  private readonly debounceMs = inject(MAP_EDITOR_DEBOUNCE_MS);

  private readonly _sectorId = signal<string | null>(null);
  readonly sectorId = this._sectorId.asReadonly();

  private readonly _selectedFloorId = signal<string | null>(null);
  readonly selectedFloorId = this._selectedFloorId.asReadonly();

  private readonly _layout: WritableSignal<MapLayout> = signal(LAYOUT_VACIO);
  readonly layout: Signal<MapLayout> = this._layout.asReadonly();

  readonly elements = computed(() => this._layout().elements);
  private readonly _metadata = signal<Record<string, SpaceElement>>({});
  readonly selectedMetadata = computed(() => this._metadata()[this._selectedId() ?? ''] ?? null);
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

  /** HU-4.01: versión observada del sector (para guardados por lotes, RN-7). */
  private readonly _sectorUpdatedAt = signal<string | null>(null);
  readonly sectorUpdatedAt = this._sectorUpdatedAt.asReadonly();

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
        debounceTime(this.debounceMs),
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
    this._metadata.set({});
    this._selectedId.set(null);
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
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (elements: SpaceElement[]) => {
          if (this._sectorId() !== sectorId) return;
          this._metadata.set(Object.fromEntries(elements.map((el) => [el.id, el])));
          const layoutElements = elements.map(mapApiElementToLayoutElement);
          this._layout.set({
            floorId: '',
            name: sectorName || 'Sector',
            size: sectorSize,
            elements: layoutElements,
            schemaVersion: 1,
            kind: 'sector',
            sectors: [],
          });
          this._loading.set(false);
        },
        error: () => {
          this._error.set(this.strings.errors.loadFailed);
          this._loading.set(false);
        },
      });
  }

  saveElementMetadata(id: string, labelInput: string, capacityInput: string): void {
    const raw = this._metadata()[id];
    const element = this._layout().elements.find((item) => item.id === id);
    const sectorId = this._sectorId();
    if (!this.canEditMetadata() || !raw || !element || !sectorId || this._saving()) return;
    const label = labelInput.trim() || null;
    const capacity = capacityInput.trim() ? Number(capacityInput.trim()) : null;
    if (
      (label && label.length > 120) ||
      (capacity !== null && (!Number.isSafeInteger(capacity) || capacity < 1))
    ) {
      this._metadataError.set(this.strings.metadataInvalid);
      return;
    }
    this._metadataError.set(null);
    this._saving.set(true);
    this.api
      .updateSpaceElement(sectorId, id, {
        type: element.type,
        x: element.position.x,
        y: element.position.y,
        width: element.size.width,
        height: element.size.height,
        rotation: element.rotation,
        label,
        capacity,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          if (this._sectorId() !== sectorId) {
            this._saving.set(false);
            return;
          }
          this.pendingSave = null;
          this._metadata.update((items) => ({ ...items, [id]: saved }));
          this._layout.update((layout) => ({
            ...layout,
            elements: layout.elements.map((el) =>
              el.id === id
                ? {
                    ...el,
                    label: mapApiElementToLayoutElement(saved).label,
                    capacity: saved.capacity ?? null,
                  }
                : el,
            ),
          }));
          this._saving.set(false);
        },
        error: () => {
          this._saving.set(false);
          if (this._sectorId() === sectorId) {
            this._metadataError.set(this.strings.errors.saveFailed);
          }
        },
      });
  }

  clearElementMetadata(id: string): void {
    this.saveElementMetadata(id, '', '');
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

    // Track previous state for persistence (only if no pending save for this element)
    if (!this.pendingSave || this.pendingSave.elementId !== id) {
      this.pendingSave = {
        elementId: id,
        previousPosition: element.position,
        previousRotation: element.rotation,
        previousSize: element.size,
      };
    }

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
    const element = this._layout().elements.find((el) => el.id === id);
    if (!element) return;

    // Track previous state for persistence (only if no pending save for this element)
    if (!this.pendingSave || this.pendingSave.elementId !== id) {
      this.pendingSave = {
        elementId: id,
        previousPosition: element.position,
        previousRotation: element.rotation,
        previousSize: element.size,
      };
    }

    this._layout.update((current) => ({
      ...current,
      elements: current.elements.map((el) =>
        el.id === id ? { ...el, rotation: normalizedRotation } : el,
      ),
    }));

    this.debouncedPersist();
  }

  resizeElement(id: SpaceElementId, x: number, y: number, width: number, height: number): void {
    const clampedWidth = Math.max(20, width);
    const clampedHeight = Math.max(20, height);
    const element = this._layout().elements.find((el) => el.id === id);
    if (!element) return;

    // Track previous state for persistence (only if no pending save for this element)
    if (!this.pendingSave || this.pendingSave.elementId !== id) {
      this.pendingSave = {
        elementId: id,
        previousPosition: element.position,
        previousRotation: element.rotation,
        previousSize: element.size,
      };
    }

    this._layout.update((current) => ({
      ...current,
      elements: current.elements.map((el) =>
        el.id === id
          ? { ...el, position: { x, y }, size: { width: clampedWidth, height: clampedHeight } }
          : el,
      ),
    }));

    this.debouncedPersist();
  }

  private debouncedPersist(): void {
    const layout = this._layout();
    const changedElements = layout.elements.filter((el) => {
      if (!this.pendingSave || this.pendingSave.elementId !== el.id) return false;
      return (
        el.position.x !== this.pendingSave.previousPosition.x ||
        el.position.y !== this.pendingSave.previousPosition.y ||
        el.rotation !== this.pendingSave.previousRotation ||
        el.size.width !== this.pendingSave.previousSize.width ||
        el.size.height !== this.pendingSave.previousSize.height
      );
    });

    if (changedElements.length === 0) return;

    const element = changedElements[0];
    if (element) {
      this.persistElementPosition(element);
    }
  }

  /** Método público solo para tests: dispara la persistencia inmediata sin debounce */
  flushDebouncedPersist(): void {
    this.debouncedPersist();
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
      width: element.size.width,
      height: element.size.height,
      rotation: element.rotation,
    };

    this.api
      .updateSpaceElement(sectorId, element.id, request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          this._metadata.update((items) =>
            items[element.id] ? { ...items, [element.id]: saved } : items,
          );
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
        el.id === elementId
          ? {
              ...el,
              position: this.pendingSave!.previousPosition,
              rotation: this.pendingSave!.previousRotation,
              size: this.pendingSave!.previousSize,
            }
          : el,
      ),
    }));
    this.pendingSave = null;
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

    this._saving.set(true);
    this._error.set(null);

    const request: ElementTemplateCreateRequest = {
      name: templateName,
      type: selected.type,
    };

    this.api
      .createTemplate(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this._saving.set(false);
          this._error.set(null);
          this.loadTemplates();
        },
        error: (response: { status?: number }) => {
          this._saving.set(false);
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
  createElementFromDrop(key: string, x: number, y: number): void {
    const sectorId = this._sectorId();
    if (!sectorId) {
      this._error.set(this.strings.errors.noSectorLoaded);
      return;
    }

    let type: SpaceElementType | null = null;
    if (key.startsWith('tpl:')) {
      const template = this._templates().find((t) => t.id === key.slice(4));
      type = template?.type ?? null;
    } else if (key.startsWith('base:')) {
      type = key.slice(5) as SpaceElementType;
    }
    if (!type || !TYPE_DEFAULTS[type]) {
      this._error.set(this.strings.errors.templateNotFound);
      return;
    }

    this._saving.set(true);
    this._error.set(null);
    const size = TYPE_DEFAULTS[type].size;
    this.api
      .createSpaceElement(sectorId, {
        type,
        x: Math.max(0, x),
        y: Math.max(0, y),
        width: size.width,
        height: size.height,
        rotation: 0,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => {
          this._saving.set(false);
          this._metadata.update((items) => ({ ...items, [created.id]: created }));
          this._layout.update((current) => ({
            ...current,
            elements: [...current.elements, mapApiElementToLayoutElement(created)],
          }));
          this.selectElement(created.id);
        },
        error: (response: { status?: number }) => {
          this._saving.set(false);
          this._error.set(
            response?.status === 400
              ? this.strings.errors.createInvalid
              : this.strings.errors.createFailed,
          );
        },
      });
  }

  /** HU-4.01: baja lógica del elemento (409 si tiene reservas activas, RN-1). */
  deleteElement(elementId: string): void {
    const sectorId = this._sectorId();
    if (!sectorId) {
      this._error.set(this.strings.errors.noSectorLoaded);
      return;
    }
    this._saving.set(true);
    this._error.set(null);
    this.api
      .deleteSpaceElement(sectorId, elementId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this._saving.set(false);
          this._metadata.update((items) => {
            const updated = { ...items };
            delete updated[elementId];
            return updated;
          });
          this._layout.update((current) => ({
            ...current,
            elements: current.elements.filter((el) => el.id !== elementId),
          }));
          if (this._selectedId() === elementId) this._selectedId.set(null);
        },
        error: (response: { status?: number }) => {
          this._saving.set(false);
          this._error.set(
            response?.status === 409
              ? this.strings.errors.conflict
              : response?.status === 404
                ? this.strings.errors.notFound
                : this.strings.errors.saveFailed,
          );
        },
      });
  }

  /** HU-4.01: cambia las dimensiones intrínsecas del sector (vista sector, RN-6).
   * Va por el guardado por lotes del sector; 409 si alguien editó debajo. */
  saveSectorDimensions(width: number, height: number): void {
    const sectorId = this._sectorId();
    const version = this._sectorUpdatedAt();
    if (!sectorId || !version) return;
    if (width < 20 || height < 20) {
      this._error.set(this.strings.errors.saveInvalid);
      return;
    }

    this._saving.set(true);
    this._error.set(null);
    this.api
      .saveSectorLayout(sectorId, {
        sector: { width, height, updatedAt: version },
        elements: [],
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this._saving.set(false);
          this._sectorUpdatedAt.set(response.sector.updatedAt);
          this._layout.update((l) => ({ ...l, size: { width, height } }));
        },
        error: (response: { status?: number }) => {
          this._saving.set(false);
          this._error.set(
            response?.status === 409
              ? this.strings.errors.conflict
              : response?.status === 400
                ? this.strings.errors.saveInvalid
                : this.strings.errors.saveFailed,
          );
        },
      });
  }
}
