import { Injectable, computed, inject, signal } from '@angular/core';
import type { Establishment, EstablishmentType } from '@mapit/api-client';
import { finalize } from 'rxjs';
import { EstablishmentsApi } from '../data/establishments-api';

export interface EstablishmentDraft {
  name: string;
  type: EstablishmentType;
  slug: string;
  timezone: string;
}

/** Las cuatro verticales, para poblar el selector sin repetirlas en la plantilla. */
export const ESTABLISHMENT_TYPES: readonly EstablishmentType[] = [
  'RESTAURANT',
  'NIGHTCLUB',
  'EVENT_HALL',
  'HOTEL',
];

const ZONA_HORARIA_POR_DEFECTO = 'America/La_Paz';

const EMPTY_DRAFT: EstablishmentDraft = {
  name: '',
  type: 'RESTAURANT',
  slug: '',
  timezone: ZONA_HORARIA_POR_DEFECTO,
};

const SLUG_FORMATO = /^[a-z0-9][a-z0-9-]{1,62}$/;

/** ViewModel con el estado y los comandos de la pantalla de establecimientos (CU-04). */
@Injectable()
export class EstablishmentsStore {
  private readonly api = inject(EstablishmentsApi);

  private readonly itemsState = signal<Establishment[]>([]);
  private readonly draftState = signal<EstablishmentDraft>({ ...EMPTY_DRAFT });
  private readonly editingIdState = signal<string | null>(null);
  private readonly loadingState = signal(false);
  private readonly savingState = signal(false);
  private readonly errorState = signal<string | null>(null);

  readonly items = this.itemsState.asReadonly();
  readonly draft = this.draftState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly saving = this.savingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly isEditing = computed(() => this.editingIdState() !== null);
  readonly types = ESTABLISHMENT_TYPES;

  constructor() {
    this.load();
  }

  load(): void {
    this.loadingState.set(true);
    this.errorState.set(null);
    this.api
      .list()
      .pipe(finalize(() => this.loadingState.set(false)))
      .subscribe({
        next: (items) => this.itemsState.set(items),
        error: () => this.errorState.set('No se pudieron cargar los establecimientos.'),
      });
  }

  startNew(): void {
    this.editingIdState.set(null);
    this.draftState.set({ ...EMPTY_DRAFT });
    this.errorState.set(null);
  }

  edit(establishment: Establishment): void {
    this.editingIdState.set(establishment.id);
    this.draftState.set({
      name: establishment.name,
      type: establishment.type,
      slug: establishment.slug,
      timezone: establishment.timezone,
    });
    this.errorState.set(null);
  }

  setName(name: string): void {
    this.draftState.update((draft) => ({ ...draft, name }));
  }

  setType(type: EstablishmentType): void {
    this.draftState.update((draft) => ({ ...draft, type }));
  }

  setSlug(slug: string): void {
    this.draftState.update((draft) => ({ ...draft, slug }));
  }

  setTimezone(timezone: string): void {
    this.draftState.update((draft) => ({ ...draft, timezone }));
  }

  save(): void {
    const draft = this.draft();
    const name = draft.name.trim();
    const slug = draft.slug.trim();

    if (!name) {
      this.errorState.set('El nombre es obligatorio.');
      return;
    }
    if (!SLUG_FORMATO.test(slug)) {
      this.errorState.set(
        'El slug debe tener entre 2 y 63 caracteres: minúsculas, dígitos y guiones.',
      );
      return;
    }

    const timezone = draft.timezone.trim() || ZONA_HORARIA_POR_DEFECTO;
    const editingId = this.editingIdState();

    // El tipo solo viaja al crear: es inmutable tras la creación (RN-3) y por eso
    // `EstablishmentUpdateRequest` ni siquiera lo declara.
    const request$ =
      editingId === null
        ? this.api.create({ name, type: draft.type, slug, timezone })
        : this.api.update(editingId, { name, slug, timezone });

    this.savingState.set(true);
    this.errorState.set(null);
    request$.pipe(finalize(() => this.savingState.set(false))).subscribe({
      next: (saved) => {
        this.itemsState.update((items) =>
          editingId === null
            ? [saved, ...items]
            : items.map((item) => (item.id === saved.id ? saved : item)),
        );
        this.startNew();
      },
      error: (response: { status?: number }) =>
        this.errorState.set(
          response?.status === 409
            ? 'Ya existe un establecimiento con ese slug.'
            : 'No se pudo guardar el establecimiento.',
        ),
    });
  }

  /** Da de baja. Es lógica en el backend: la fila se conserva y el slug queda libre. */
  remove(id: string): void {
    this.savingState.set(true);
    this.errorState.set(null);
    this.api
      .delete(id)
      .pipe(finalize(() => this.savingState.set(false)))
      .subscribe({
        next: () => {
          this.itemsState.update((items) => items.filter((item) => item.id !== id));
          if (this.editingIdState() === id) {
            this.startNew();
          }
        },
        error: () => this.errorState.set('No se pudo dar de baja el establecimiento.'),
      });
  }
}
