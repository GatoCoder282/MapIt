import { Injectable, computed, inject, signal } from '@angular/core';
import type { DemoItem, DemoItemRequest } from '@mapit/api-client';
import { finalize } from 'rxjs';
import { DemoItemsApi } from '../data/demo-items-api';

export interface DemoItemDraft {
  name: string;
  description: string;
  active: boolean;
}

const EMPTY_DRAFT: DemoItemDraft = {
  name: '',
  description: '',
  active: true,
};

/** ViewModel con estado y comandos de la pantalla CRUD. */
@Injectable()
export class DemoItemsStore {
  private readonly api = inject(DemoItemsApi);
  private readonly itemsState = signal<DemoItem[]>([]);
  private readonly draftState = signal<DemoItemDraft>({ ...EMPTY_DRAFT });
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
        error: () => this.errorState.set('No se pudieron cargar los elementos.'),
      });
  }

  startNew(): void {
    this.editingIdState.set(null);
    this.draftState.set({ ...EMPTY_DRAFT });
    this.errorState.set(null);
  }

  edit(item: DemoItem): void {
    this.editingIdState.set(item.id);
    this.draftState.set({
      name: item.name,
      description: item.description,
      active: item.active,
    });
    this.errorState.set(null);
  }

  setName(name: string): void {
    this.draftState.update((draft) => ({ ...draft, name }));
  }

  setDescription(description: string): void {
    this.draftState.update((draft) => ({ ...draft, description }));
  }

  setActive(active: boolean): void {
    this.draftState.update((draft) => ({ ...draft, active }));
  }

  save(): void {
    const draft = this.draft();
    const name = draft.name.trim();
    if (!name) {
      this.errorState.set('El nombre es obligatorio.');
      return;
    }

    const request: DemoItemRequest = {
      name,
      description: draft.description.trim(),
      active: draft.active,
    };
    const editingId = this.editingIdState();
    const request$ =
      editingId === null ? this.api.create(request) : this.api.update(editingId, request);

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
      error: () => this.errorState.set('No se pudo guardar el elemento.'),
    });
  }

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
        error: () => this.errorState.set('No se pudo eliminar el elemento.'),
      });
  }
}
