import { Injectable, computed, inject, signal } from '@angular/core';
import type {
  Establishment,
  EstablishmentCreateRequest,
  Floor,
  Sector,
  SpaceElement,
  SpaceElementCreateRequest,
} from '@mapit/api-client';
import { type Observable, throwError } from 'rxjs';
import { catchError, finalize, tap } from 'rxjs/operators';
import {
  SpacesApiService,
  type EstablishmentDraft,
  type FloorDraft,
  type SectorDraft,
} from '../data/spaces-api';
import { STRINGS } from '../../../core/strings';

/** Deriva un slug válido desde el nombre (misma regla que `Slug.fromName` del backend). */
function slugify(name: string): string {
  const base = name
    .normalize('NFD')
    .replaceAll(/\p{M}/gu, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '');
  const candidato = base.length >= 2 ? base : `${base}-${base}`;
  return candidato.slice(0, 63) || 'local';
}

const EMPTY_FLOOR_DRAFT: FloorDraft = {
  name: '',
  level: 0,
};

const EMPTY_SECTOR_DRAFT: SectorDraft = {
  name: '',
};

export interface SpaceElementDraft {
  type: string;
  x: string;
  y: string;
  initialState: string;
}

const EMPTY_ELEMENT_DRAFT: SpaceElementDraft = {
  type: 'TABLE',
  x: '',
  y: '',
  initialState: 'AVAILABLE',
};

/**
 * ViewModel con estado y comandos para la gestión de Pisos y Sectores (CU-05 · MAP-69/70).
 *
 * providedIn 'root': lo comparten el paso 1 del asistente (datos del negocio),
 * el paso 2 (estructura) y las páginas hijas de sectores/elementos. El contexto
 * de establecimiento viaja además en la URL, así que sobrevive a refrescos.
 */
@Injectable({ providedIn: 'root' })
export class SpacesStore {
  private readonly api = inject(SpacesApiService);
  private readonly floorStrings = STRINGS.spaces.floors;
  private readonly sectorStrings = STRINGS.spaces.sectors;

  // Contexto del wizard (CU-05): el paso 2 siempre opera sobre UN establecimiento,
  // el creado/seleccionado en el paso 1. Sin él no se carga ni crea nada.
  private readonly establishmentIdState = signal<string | null>(null);

  // Floor state
  private readonly floorsState = signal<Floor[]>([]);
  private readonly floorDraftState = signal<FloorDraft>({ ...EMPTY_FLOOR_DRAFT });
  private readonly editingFloorIdState = signal<string | null>(null);

  // Sector state (keyed by floorId)
  private readonly sectorsByFloorState = signal<Record<string, Sector[]>>({});
  private readonly sectorsLoadingState = signal<Record<string, boolean>>({});
  private readonly sectorDraftState = signal<SectorDraft>({ ...EMPTY_SECTOR_DRAFT });
  private readonly editingSectorIdState = signal<string | null>(null);

  // SpaceElement state (keyed by sectorId)
  private readonly elementsBySectorState = signal<Record<string, SpaceElement[]>>({});
  private readonly elementsLoadingState = signal<Record<string, boolean>>({});
  private readonly elementDraftState = signal<SpaceElementDraft>({ ...EMPTY_ELEMENT_DRAFT });
  private readonly editingElementIdState = signal<string | null>(null);

  // Shared state
  private readonly loadingState = signal(false);
  private readonly savingState = signal(false);
  private readonly errorState = signal<string | null>(null);

  // Floor selectors
  readonly floors = this.floorsState.asReadonly();
  readonly floorDraft = this.floorDraftState.asReadonly();
  readonly isEditingFloor = computed(() => this.editingFloorIdState() !== null);

  // Sector selectors
  readonly sectorsByFloor = computed(() => this.sectorsByFloorState());
  readonly sectorDraft = this.sectorDraftState.asReadonly();
  readonly isEditingSector = computed(() => this.editingSectorIdState() !== null);

  // SpaceElement selectors
  readonly elementsBySector = computed(() => this.elementsBySectorState());
  readonly elementDraft = this.elementDraftState.asReadonly();
  readonly isEditingElement = computed(() => this.editingElementIdState() !== null);

  // Shared selectors
  readonly loading = this.loadingState.asReadonly();
  readonly saving = this.savingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly establishmentId = this.establishmentIdState.asReadonly();

  // Expose strings for template
  readonly strings_ = STRINGS.spaces;

  /**
   * Fija el establecimiento del wizard y carga sus plantas. Sin id no hay
   * llamada: el paso 2 no tiene sentido sin saber de qué establecimiento se trata.
   */
  selectEstablishment(id: string | null): void {
    if (id === this.establishmentIdState()) return;
    this.establishmentIdState.set(id);
    if (id === null) {
      this.floorsState.set([]);
      this.errorState.set(null);
      return;
    }
    this.loadFloors();
  }

  /** Paso 1: crea el establecimiento y lo fija como contexto del paso 2. */
  createEstablishment(draft: EstablishmentDraft): Observable<Establishment> {
    const address = draft.address.trim();
    const timezone = draft.timezone;
    this.savingState.set(true);
    this.errorState.set(null);
    return this.api
      .createEstablishment({
        name: draft.name,
        type: draft.type as EstablishmentCreateRequest['type'],
        slug: slugify(draft.name),
        ...(address ? { address } : {}),
        ...(timezone ? { timezone } : {}),
      })
      .pipe(
        tap((est) => this.establishmentIdState.set(est.id)),
        catchError((err: unknown) => {
          this.errorState.set(this.strings_.wizard.createFailed);
          return throwError(() => err);
        }),
        finalize(() => this.savingState.set(false)),
      );
  }

  // ===== FLOOR OPERATIONS =====

  loadFloors(): void {
    const establishmentId = this.establishmentIdState();
    if (!establishmentId) {
      this.floorsState.set([]);
      this.errorState.set(null);
      return;
    }
    this.loadingState.set(true);
    this.errorState.set(null);
    this.api
      .listFloors(establishmentId)
      .pipe(finalize(() => this.loadingState.set(false)))
      .subscribe({
        next: (floors) => this.floorsState.set(floors),
        error: () => this.errorState.set(this.floorStrings.errors.loadFailed),
      });
  }

  startNewFloor(): void {
    this.editingFloorIdState.set(null);
    this.floorDraftState.set({ ...EMPTY_FLOOR_DRAFT });
    this.errorState.set(null);
  }

  editFloor(floor: Floor): void {
    this.editingFloorIdState.set(floor.id);
    this.floorDraftState.set({
      name: floor.name,
      level: floor.level,
    });
    this.errorState.set(null);
  }

  setFloorName(name: string): void {
    this.floorDraftState.update((draft) => ({ ...draft, name }));
  }

  setFloorLevel(level: string | number): void {
    const parsed = typeof level === 'string' ? parseInt(level, 10) : level;
    this.floorDraftState.update((draft) => ({ ...draft, level: isNaN(parsed) ? 0 : parsed }));
  }

  saveFloor(): void {
    const draft = this.floorDraft();
    const name = draft.name.trim();

    if (!name) {
      this.errorState.set(this.floorStrings.form.nameRequired);
      return;
    }
    if (name.length > this.floorStrings.form.nameMaxLength) {
      this.errorState.set(this.floorStrings.form.nameTooLong);
      return;
    }

    const level = draft.level;
    const editingId = this.editingFloorIdState();
    const establishmentId = this.establishmentIdState();

    if (editingId === null && !establishmentId) {
      // Sin contexto de establecimiento no existe a qué colgar la planta.
      this.errorState.set(this.floorStrings.errors.saveFailed);
      return;
    }

    const request$ =
      editingId === null
        ? this.api.createFloor({ name, level }, establishmentId as string)
        : this.api.updateFloor(editingId, { name, level });

    this.savingState.set(true);
    this.errorState.set(null);
    request$.pipe(finalize(() => this.savingState.set(false))).subscribe({
      next: (saved) => {
        this.floorsState.update((floors) =>
          editingId === null
            ? [saved, ...floors]
            : floors.map((floor) => (floor.id === saved.id ? saved : floor)),
        );
        this.startNewFloor();
      },
      error: (response: { status?: number }) =>
        this.errorState.set(
          response?.status === 409
            ? this.floorStrings.errors.slugConflict
            : this.floorStrings.errors.saveFailed,
        ),
    });
  }

  /**
   * Reordena pisos tras un drag & drop (optimista, solo local).
   * No existe endpoint de reorden en el contrato todavía: el orden persiste
   * solo en memoria hasta que CU-05 defina `PATCH /floors/reorder`.
   */
  reorderFloors(previousIndex: number, currentIndex: number): void {
    if (previousIndex === currentIndex) return;
    this.floorsState.update((floors) => {
      const next = [...floors];
      const [moved] = next.splice(previousIndex, 1);
      if (!moved) return floors;
      next.splice(currentIndex, 0, moved);
      return next;
    });
  }

  removeFloor(id: string): void {
    const floor = this.floorsState().find((f) => f.id === id);
    if (!floor) return;

    if (!confirm(this.floorStrings.list.deleteConfirm.replace('{name}', floor.name))) {
      return;
    }

    this.savingState.set(true);
    this.errorState.set(null);
    this.api
      .deleteFloor(id)
      .pipe(finalize(() => this.savingState.set(false)))
      .subscribe({
        next: () => {
          this.floorsState.update((floors) => floors.filter((floor) => floor.id !== id));
          // Also remove sectors for this floor
          this.sectorsByFloorState.update((sectors) => {
            const next = { ...sectors };
            delete next[id];
            return next;
          });
          if (this.editingFloorIdState() === id) {
            this.startNewFloor();
          }
        },
        error: () => this.errorState.set(this.floorStrings.errors.deleteFailed),
      });
  }

  // ===== SECTOR OPERATIONS =====

  sectorsByFloorId(floorId: string): Sector[] {
    return this.sectorsByFloorState()[floorId] ?? [];
  }

  sectorsLoading(floorId: string): boolean {
    return this.sectorsLoadingState()[floorId] ?? false;
  }

  loadSectorsByFloor(floorId: string): void {
    this.sectorsLoadingState.update((state) => ({ ...state, [floorId]: true }));
    this.errorState.set(null);
    this.api
      .listSectorsByFloor(floorId)
      .pipe(
        finalize(() =>
          this.sectorsLoadingState.update((state) => ({ ...state, [floorId]: false })),
        ),
      )
      .subscribe({
        next: (sectors) =>
          this.sectorsByFloorState.update((state) => ({ ...state, [floorId]: sectors })),
        error: () => this.errorState.set(this.sectorStrings.errors.loadFailed),
      });
  }

  startNewSector(): void {
    this.editingSectorIdState.set(null);
    this.sectorDraftState.set({ ...EMPTY_SECTOR_DRAFT });
    this.errorState.set(null);
  }

  editSector(sector: Sector): void {
    this.editingSectorIdState.set(sector.id);
    this.sectorDraftState.set({
      name: sector.name,
    });
    this.errorState.set(null);
  }

  setSectorName(name: string): void {
    this.sectorDraftState.update((draft) => ({ ...draft, name }));
  }

  createSector(floorId: string, name: string): Observable<Sector> {
    const trimmedName = name.trim();

    if (!trimmedName) {
      this.errorState.set(this.sectorStrings.form.nameRequired);
      return throwError(() => new Error('Name required'));
    }
    if (trimmedName.length > this.sectorStrings.form.nameMaxLength) {
      this.errorState.set(this.sectorStrings.form.nameTooLong);
      return throwError(() => new Error('Name too long'));
    }

    this.savingState.set(true);
    this.errorState.set(null);

    return this.api.createSector(floorId, trimmedName).pipe(
      finalize(() => this.savingState.set(false)),
      tap({
        next: (saved) => {
          this.sectorsByFloorState.update((state) => ({
            ...state,
            [floorId]: [saved, ...(state[floorId] ?? [])],
          }));
          this.startNewSector();
        },
        error: (response: { status?: number }) => {
          this.errorState.set(
            response?.status === 409
              ? this.sectorStrings.errors.slugConflict
              : response?.status === 404
                ? this.sectorStrings.errors.floorNotFound
                : this.sectorStrings.errors.saveFailed,
          );
        },
      }),
    );
  }

  /**
   * Reordena sectores dentro de un piso tras un drag & drop (optimista, local).
   * Ver la nota de `reorderFloors`: sin endpoint de persistencia todavía.
   */
  reorderSectors(floorId: string, previousIndex: number, currentIndex: number): void {
    if (previousIndex === currentIndex) return;
    this.sectorsByFloorState.update((state) => {
      const sectors = [...(state[floorId] ?? [])];
      const [moved] = sectors.splice(previousIndex, 1);
      if (!moved) return state;
      sectors.splice(currentIndex, 0, moved);
      return { ...state, [floorId]: sectors };
    });
  }

  // ===== SPACE ELEMENT OPERATIONS (HU-2.03 / MAP-117-118) =====

  elementsBySectorId(sectorId: string): SpaceElement[] {
    return this.elementsBySectorState()[sectorId] ?? [];
  }

  elementsLoading(sectorId: string): boolean {
    return this.elementsLoadingState()[sectorId] ?? false;
  }

  loadSpaceElementsBySector(sectorId: string): void {
    this.elementsLoadingState.update((state) => ({ ...state, [sectorId]: true }));
    this.errorState.set(null);
    this.api
      .listSpaceElementsBySector(sectorId)
      .pipe(
        finalize(() =>
          this.elementsLoadingState.update((state) => ({ ...state, [sectorId]: false })),
        ),
      )
      .subscribe({
        next: (elements) =>
          this.elementsBySectorState.update((state) => ({ ...state, [sectorId]: elements })),
        error: () => this.errorState.set(this.strings_.elements.errors.loadFailed),
      });
  }

  startNewElement(): void {
    this.editingElementIdState.set(null);
    this.elementDraftState.set({ ...EMPTY_ELEMENT_DRAFT });
    this.errorState.set(null);
  }

  editElement(element: SpaceElement): void {
    this.editingElementIdState.set(element.id);
    this.elementDraftState.set({
      type: element.type,
      x: String(element.x),
      y: String(element.y),
      initialState: element.state,
    });
    this.errorState.set(null);
  }

  setElementType(type: string): void {
    this.elementDraftState.update((draft) => ({ ...draft, type }));
  }

  setElementX(x: string): void {
    this.elementDraftState.update((draft) => ({ ...draft, x }));
  }

  setElementY(y: string): void {
    this.elementDraftState.update((draft) => ({ ...draft, y }));
  }

  setElementInitialState(initialState: string): void {
    this.elementDraftState.update((draft) => ({ ...draft, initialState }));
  }

  saveElement(sectorId: string): Observable<SpaceElement> | null {
    const draft = this.elementDraft();
    const str = this.strings_.elements.form;

    const x = parseFloat(draft.x);
    const y = parseFloat(draft.y);
    if (isNaN(x) || x < 0 || isNaN(y) || y < 0) {
      this.errorState.set(str.coordsInvalid);
      return null;
    }

    const editingId = this.editingElementIdState();
    const request: SpaceElementCreateRequest = {
      type: draft.type as SpaceElementCreateRequest.TypeEnum,
      x,
      y,
      initialState:
        (draft.initialState as SpaceElementCreateRequest.InitialStateEnum) ?? 'AVAILABLE',
    };

    this.savingState.set(true);
    this.errorState.set(null);

    const request$ =
      editingId === null
        ? this.api.createSpaceElement(sectorId, request)
        : this.api.updateSpaceElement(sectorId, editingId, { type: request.type, x, y });

    return request$.pipe(
      finalize(() => this.savingState.set(false)),
      tap({
        next: (saved) => {
          this.elementsBySectorState.update((state) => ({
            ...state,
            [sectorId]:
              editingId === null
                ? [saved, ...(state[sectorId] ?? [])]
                : (state[sectorId] ?? []).map((e) => (e.id === saved.id ? saved : e)),
          }));
          this.startNewElement();
        },
        error: (response: { status?: number }) => {
          this.errorState.set(
            response?.status === 400
              ? this.strings_.elements.errors.saveInvalid
              : this.strings_.elements.errors.saveFailed,
          );
        },
      }),
    );
  }

  // Baja de elementos: no hay DELETE de elementos en el contrato todavía. Cuando se sume,
  // aquí irá `deleteSpaceElement(sectorId, elementId)` — hoy declarativamente excluido
  // para no esconder un endpoint disfrazado de borrado (ver tasks.md §16).

  /** ¿El sector inicial draft está completo y válido? */
  /** ¿El draft del elemento está completo y válido? */
  elementFormValido(): boolean {
    const draft = this.elementDraft();
    return !!draft.type && draft.x !== '' && draft.y !== '';
  }

  // ===== SECTOR DELETE =====

  removeSector(id: string): void {
    // Find which floor this sector belongs to
    let sectorFloorId: string | null = null;
    let sectorName = '';
    for (const [floorId, sectors] of Object.entries(this.sectorsByFloorState())) {
      const sector = sectors.find((s) => s.id === id);
      if (sector) {
        sectorFloorId = floorId;
        sectorName = sector.name;
        break;
      }
    }

    if (!sectorFloorId) return;

    if (!confirm(this.sectorStrings.list.deleteConfirm.replace('{name}', sectorName))) {
      return;
    }

    this.savingState.set(true);
    this.errorState.set(null);
    this.api
      .deleteSector(id)
      .pipe(finalize(() => this.savingState.set(false)))
      .subscribe({
        next: () => {
          this.sectorsByFloorState.update((state) => {
            const floorSectors = state[sectorFloorId] ?? [];
            return {
              ...state,
              [sectorFloorId]: floorSectors.filter((s) => s.id !== id),
            };
          });
          if (this.editingSectorIdState() === id) {
            this.startNewSector();
          }
        },
        error: () => this.errorState.set(this.sectorStrings.errors.deleteFailed),
      });
  }
}
