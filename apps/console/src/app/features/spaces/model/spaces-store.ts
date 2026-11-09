import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type {
  Establishment,
  EstablishmentCreateRequest,
  Floor,
  Sector,
  SpaceElement,
} from '@mapit/api-client';
import { Subject, type Observable, throwError } from 'rxjs';
import { catchError, finalize, tap } from 'rxjs/operators';
import { takeUntil } from 'rxjs/operators';
import {
  SpacesApiService,
  type EstablishmentDraft,
  type FloorDraft,
  type SectorDraft,
} from '../data/spaces-api';
import { STRINGS } from '../../../core/strings';
import { EstablishmentContext } from '../../../core/establishment-context';

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
};

const EMPTY_SECTOR_DRAFT: SectorDraft = {
  name: '',
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
  private readonly context = inject(EstablishmentContext);
  private readonly destroyRef = inject(DestroyRef);
  private epoch = 0;
  private scopeCancel = new Subject<void>();
  private writeCount = 0;
  private readonly floorStrings = STRINGS.spaces.floors;
  private readonly sectorStrings = STRINGS.spaces.sectors;

  // Contexto del wizard (CU-05): el paso 2 siempre opera sobre UN establecimiento,
  // el creado/seleccionado en el paso 1. Sin él no se carga ni crea nada.
  private readonly establishmentIdState = signal<string | null>(null);
  private readonly establishmentTypeState = signal<string | null>(null);

  // Floor state
  private readonly floorsState = signal<Floor[]>([]);
  private readonly floorDraftState = signal<FloorDraft>({ ...EMPTY_FLOOR_DRAFT });
  private readonly editingFloorIdState = signal<string | null>(null);
  private readonly editingFloorBaseline = signal<string | null>(null);
  private floorDraftRevision = 0;

  // Sector state (keyed by floorId)
  private readonly sectorsByFloorState = signal<Record<string, Sector[]>>({});
  private readonly sectorsLoadingState = signal<Record<string, boolean>>({});
  private readonly sectorDraftState = signal<SectorDraft>({ ...EMPTY_SECTOR_DRAFT });
  private readonly editingSectorIdState = signal<string | null>(null);
  private readonly editingSectorBaseline = signal<string | null>(null);
  private sectorDraftRevision = 0;

  // SpaceElement state (keyed by sectorId): lectura para el resumen del wizard.
  // El alta/edición/baja vive en el editor visual (MapEditorStore).
  private readonly elementsBySectorState = signal<Record<string, SpaceElement[]>>({});
  private readonly elementsLoadingState = signal<Record<string, boolean>>({});

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

  // Shared selectors
  readonly loading = this.loadingState.asReadonly();
  readonly saving = this.savingState.asReadonly();
  readonly busy = this.savingState.asReadonly();
  readonly dirty = computed(() => {
    const floorName = this.floorDraftState().name;
    const sectorName = this.sectorDraftState().name;
    return (
      (this.editingFloorIdState() !== null
        ? floorName !== this.editingFloorBaseline()
        : floorName.trim() !== '') ||
      (this.editingSectorIdState() !== null
        ? sectorName !== this.editingSectorBaseline()
        : sectorName.trim() !== '')
    );
  });
  readonly error = this.errorState.asReadonly();
  readonly establishmentId = this.establishmentIdState.asReadonly();
  readonly establishmentType = this.establishmentTypeState.asReadonly();

  constructor() {
    effect(() => {
      const active = this.context.active();
      const id = this.context.status() === 'ready' ? (active?.id ?? null) : null;
      if (id === this.establishmentIdState()) return;
      this.epoch++;
      this.scopeCancel.next();
      this.scopeCancel = new Subject<void>();
      this.establishmentIdState.set(id);
      this.establishmentTypeState.set(null);
      this.floorsState.set([]);
      this.sectorsByFloorState.set({});
      this.sectorsLoadingState.set({});
      this.elementsBySectorState.set({});
      this.elementsLoadingState.set({});
      this.floorDraftState.set({ ...EMPTY_FLOOR_DRAFT });
      this.floorDraftRevision++;
      this.sectorDraftState.set({ ...EMPTY_SECTOR_DRAFT });
      this.sectorDraftRevision++;
      this.editingFloorIdState.set(null);
      this.editingFloorBaseline.set(null);
      this.editingSectorIdState.set(null);
      this.editingSectorBaseline.set(null);
      this.errorState.set(null);
      this.loadingState.set(false);
      if (id) this.loadFloors();
    });
    this.destroyRef.onDestroy(() => {
      this.epoch++;
    });
  }

  /** Establece un mensaje de error manualmente (para errores de UI). */
  setError(message: string): void {
    this.errorState.set(message);
  }

  // Expose strings for template
  readonly strings_ = STRINGS.spaces;

  /** Paso 1: crea el establecimiento y lo fija como contexto del paso 2. */
  createEstablishment(draft: EstablishmentDraft): Observable<Establishment> {
    const address = draft.address.trim();
    const timezone = draft.timezone;
    const finishWrite = this.beginWrite();
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
        takeUntilDestroyed(this.destroyRef),
        catchError((err: unknown) => {
          this.errorState.set(this.strings_.wizard.createFailed);
          return throwError(() => err);
        }),
        finalize(finishWrite),
      );
  }

  // ===== FLOOR OPERATIONS =====

  loadFloors(): void {
    const establishmentId = this.establishmentIdState();
    if (
      !establishmentId ||
      this.context.status() !== 'ready' ||
      this.context.active()?.id !== establishmentId
    ) {
      this.floorsState.set([]);
      this.errorState.set(null);
      return;
    }
    this.loadingState.set(true);
    this.errorState.set(null);
    const epoch = this.epoch;
    this.api
      .listFloors(establishmentId)
      .pipe(
        takeUntil(this.scopeCancel),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (epoch === this.epoch) this.loadingState.set(false);
        }),
      )
      .subscribe({
        next: (floors) => {
          if (epoch === this.epoch && this.context.active()?.id === establishmentId)
            this.floorsState.set(floors);
        },
        error: () => {
          if (epoch === this.epoch) this.errorState.set(this.floorStrings.errors.loadFailed);
        },
      });
  }

  startNewFloor(): void {
    this.floorDraftRevision++;
    this.editingFloorIdState.set(null);
    this.editingFloorBaseline.set(null);
    this.floorDraftState.set({ ...EMPTY_FLOOR_DRAFT });
    this.errorState.set(null);
  }

  editFloor(floor: Floor): void {
    if (!this.floorsState().some((item) => item.id === floor.id)) return;
    this.editingFloorIdState.set(floor.id);
    this.editingFloorBaseline.set(floor.name);
    this.floorDraftState.set({
      name: floor.name,
    });
    this.errorState.set(null);
  }

  setFloorName(name: string): void {
    this.floorDraftRevision++;
    this.floorDraftState.update((draft) => ({ ...draft, name }));
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

    const editingId = this.editingFloorIdState();
    const establishmentId = this.establishmentIdState();
    if (
      this.context.status() !== 'ready' ||
      this.context.active()?.id !== establishmentId ||
      (editingId !== null && !this.floorsState().some((floor) => floor.id === editingId))
    )
      return;

    if (editingId === null && !establishmentId) {
      // Sin contexto de establecimiento no existe a qué colgar la planta.
      this.errorState.set(this.floorStrings.errors.saveFailed);
      return;
    }

    // El nivel lo asigna el servidor: siguiente escalón (0, 1, 2, …). No se envía.
    const request$ =
      editingId === null
        ? this.api.createFloor({ name }, establishmentId)
        : this.api.updateFloor(editingId, { name });

    const finishWrite = this.beginWrite();
    this.errorState.set(null);
    const epoch = this.epoch;
    const draftRevision = this.floorDraftRevision;
    request$.pipe(takeUntilDestroyed(this.destroyRef), finalize(finishWrite)).subscribe({
      next: (saved) => {
        if (epoch !== this.epoch || this.context.active()?.id !== establishmentId) return;
        // Tras crear, reordenar por nivel: el nuevo piso siempre queda al final.
        this.floorsState.update((floors) =>
          (editingId === null
            ? [...floors, saved]
            : floors.map((floor) => (floor.id === saved.id ? saved : floor))
          ).sort((a, b) => a.level - b.level),
        );
        if (this.floorDraftRevision === draftRevision) this.startNewFloor();
      },
      error: (response: { status?: number }) => {
        if (epoch !== this.epoch || this.context.active()?.id !== establishmentId) return;
        this.errorState.set(
          response?.status === 409
            ? this.floorStrings.errors.slugConflict
            : this.floorStrings.errors.saveFailed,
        );
      },
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
    if (
      this.context.status() !== 'ready' ||
      this.context.active()?.id !== this.establishmentIdState()
    )
      return;
    const floor = this.floorsState().find((f) => f.id === id);
    if (!floor) return;

    if (!confirm(this.floorStrings.list.deleteConfirm.replace('{name}', floor.name))) {
      return;
    }

    const finishWrite = this.beginWrite();
    this.errorState.set(null);
    const epoch = this.epoch;
    this.api
      .deleteFloor(id)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(finishWrite))
      .subscribe({
        next: () => {
          if (epoch !== this.epoch || this.context.active()?.id !== this.establishmentIdState())
            return;
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
        error: () => {
          if (epoch === this.epoch) this.errorState.set(this.floorStrings.errors.deleteFailed);
        },
      });
  }

  // ===== SECTOR OPERATIONS =====

  sectorsByFloorId(floorId: string): Sector[] {
    return this.sectorsByFloorState()[floorId] ?? [];
  }

  floorIdForSector(sectorId: string): string | null {
    for (const [floorId, sectors] of Object.entries(this.sectorsByFloorState())) {
      if (sectors.some((s) => s.id === sectorId)) {
        return floorId;
      }
    }
    return null;
  }

  allSectors(): Sector[] {
    return Object.values(this.sectorsByFloorState()).flat();
  }

  sectorsLoading(floorId: string): boolean {
    return this.sectorsLoadingState()[floorId] ?? false;
  }

  loadSectorsByFloor(floorId: string): void {
    if (
      this.context.status() !== 'ready' ||
      this.context.active()?.id !== this.establishmentIdState() ||
      !this.floorsState().some((floor) => floor.id === floorId)
    )
      return;
    const epoch = this.epoch;
    this.sectorsLoadingState.update((state) => ({ ...state, [floorId]: true }));
    this.errorState.set(null);
    this.api
      .listSectorsByFloor(floorId)
      .pipe(
        takeUntil(this.scopeCancel),
        takeUntilDestroyed(this.destroyRef),
        finalize(() =>
          this.sectorsLoadingState.update((state) => ({ ...state, [floorId]: false })),
        ),
      )
      .subscribe({
        next: (sectors) => {
          if (epoch === this.epoch && this.floorsState().some((floor) => floor.id === floorId))
            this.sectorsByFloorState.update((state) => ({ ...state, [floorId]: sectors }));
        },
        error: () => {
          if (epoch === this.epoch) this.errorState.set(this.sectorStrings.errors.loadFailed);
        },
      });
  }

  startNewSector(): void {
    this.sectorDraftRevision++;
    this.editingSectorIdState.set(null);
    this.editingSectorBaseline.set(null);
    this.sectorDraftState.set({ ...EMPTY_SECTOR_DRAFT });
    this.errorState.set(null);
  }

  editSector(sector: Sector): void {
    if (!this.allSectors().some((item) => item.id === sector.id)) return;
    this.editingSectorIdState.set(sector.id);
    this.editingSectorBaseline.set(sector.name);
    this.sectorDraftState.set({
      name: sector.name,
    });
    this.errorState.set(null);
  }

  setSectorName(name: string): void {
    this.sectorDraftRevision++;
    this.sectorDraftState.update((draft) => ({ ...draft, name }));
  }

  saveSector(floorId: string, name: string): Observable<Sector> {
    if (
      this.context.status() !== 'ready' ||
      this.context.active()?.id !== this.establishmentIdState() ||
      !this.floorsState().some((floor) => floor.id === floorId)
    )
      return throwError(() => new Error('Invalid establishment context'));
    const trimmedName = name.trim();

    if (!trimmedName) {
      this.errorState.set(this.sectorStrings.form.nameRequired);
      return throwError(() => new Error('Name required'));
    }
    if (trimmedName.length > this.sectorStrings.form.nameMaxLength) {
      this.errorState.set(this.sectorStrings.form.nameTooLong);
      return throwError(() => new Error('Name too long'));
    }

    const editingId = this.editingSectorIdState();
    if (
      editingId !== null &&
      !this.sectorsByFloorState()[floorId]?.some((sector) => sector.id === editingId)
    )
      return throwError(() => new Error('Sector does not belong to floor'));
    const epoch = this.epoch;
    const draftRevision = this.sectorDraftRevision;
    const finishWrite = this.beginWrite();
    this.errorState.set(null);
    const request$ =
      editingId === null
        ? this.api.createSector(floorId, trimmedName)
        : this.api.updateSector(editingId, trimmedName);

    return request$.pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(finishWrite),
      tap({
        next: (saved) => {
          if (
            epoch !== this.epoch ||
            this.context.active()?.id !== this.establishmentIdState() ||
            !this.floorsState().some((floor) => floor.id === floorId)
          )
            return;
          this.sectorsByFloorState.update((state) => ({
            ...state,
            [floorId]:
              editingId === null
                ? [saved, ...(state[floorId] ?? [])]
                : (state[floorId] ?? []).map((s) => (s.id === saved.id ? saved : s)),
          }));
          if (this.sectorDraftRevision === draftRevision) this.startNewSector();
        },
        error: (response: { status?: number }) => {
          if (epoch !== this.epoch || this.context.active()?.id !== this.establishmentIdState())
            return;
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

  // ===== SPACE ELEMENT OPERATIONS (HU-2.03 / MAP-117) =====

  elementsBySectorId(sectorId: string): SpaceElement[] {
    return this.elementsBySectorState()[sectorId] ?? [];
  }

  elementsLoading(sectorId: string): boolean {
    return this.elementsLoadingState()[sectorId] ?? false;
  }

  loadSpaceElementsBySector(sectorId: string): void {
    const floorId = this.floorIdForSector(sectorId);
    if (
      !floorId ||
      this.context.status() !== 'ready' ||
      this.context.active()?.id !== this.establishmentIdState()
    )
      return;
    const epoch = this.epoch;
    this.elementsLoadingState.update((state) => ({ ...state, [sectorId]: true }));
    this.errorState.set(null);
    this.api
      .listSpaceElementsBySector(sectorId)
      .pipe(
        takeUntil(this.scopeCancel),
        takeUntilDestroyed(this.destroyRef),
        finalize(() =>
          this.elementsLoadingState.update((state) => ({ ...state, [sectorId]: false })),
        ),
      )
      .subscribe({
        next: (elements) => {
          if (epoch === this.epoch && this.floorIdForSector(sectorId) === floorId)
            this.elementsBySectorState.update((state) => ({ ...state, [sectorId]: elements }));
        },
        error: () => {
          if (epoch === this.epoch) this.errorState.set(this.strings_.elements.loadFailed);
        },
      });
  }

  // Baja de elementos: no hay DELETE de elementos en el contrato todavía. Cuando se sume,
  // aquí irá `deleteSpaceElement(sectorId, elementId)` — hoy declarativamente excluido
  // para no esconder un endpoint disfrazado de borrado (ver tasks.md §16).

  // ===== SECTOR DELETE =====

  removeSector(id: string): void {
    if (
      this.context.status() !== 'ready' ||
      this.context.active()?.id !== this.establishmentIdState()
    )
      return;
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

    const finishWrite = this.beginWrite();
    this.errorState.set(null);
    const epoch = this.epoch;
    this.api
      .deleteSector(id)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(finishWrite))
      .subscribe({
        next: () => {
          if (epoch !== this.epoch || this.context.active()?.id !== this.establishmentIdState())
            return;
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
        error: () => {
          if (epoch === this.epoch) this.errorState.set(this.sectorStrings.errors.deleteFailed);
        },
      });
  }

  private beginWrite(): () => void {
    this.writeCount++;
    this.savingState.set(true);
    let finished = false;
    return () => {
      if (finished) return;
      finished = true;
      this.writeCount--;
      this.savingState.set(this.writeCount > 0);
    };
  }
}
