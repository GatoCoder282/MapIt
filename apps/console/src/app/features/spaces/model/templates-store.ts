import { Injectable, computed, inject, signal } from '@angular/core';
import type {
  ElementTemplate,
  ElementTemplateCreateRequest,
  ElementTemplateUpdateRequest,
} from '@mapit/api-client';
import { TemplatesService } from '@mapit/api-client';
import type { Observable } from 'rxjs';
import { finalize, tap } from 'rxjs';

import { STRINGS } from '../../../core/strings';

export interface ElementTemplateDraft {
  name: string;
  type: string;
}

const EMPTY_TEMPLATE_DRAFT: ElementTemplateDraft = {
  name: '',
  type: 'TABLE',
};

/**
 * Store de plantillas de elemento (HU-4.02 / MAP-205-206).
 *
 * Proporciona:
 * - CRUD de plantillas (listar, crear, actualizar, eliminar)
 * - Un signal `selectedTemplateId` para la UI de "reutilizar plantilla"
 *   que el componente de alta de elemento puede observar para pre-rellenar el tipo.
 *
 * Siguiendo el patrón de SpacesStore: signals privados, selectores readonly,
 * comandos con efectos secundarios HTTP y manejo uniforme de errores.
 */
@Injectable({ providedIn: 'root' })
export class TemplatesStore {
  private readonly api = inject(TemplatesService);
  private readonly strings = STRINGS.spaces.templates;

  // State
  private readonly templatesState = signal<ElementTemplate[]>([]);
  private readonly loadingState = signal(false);
  private readonly savingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly draftState = signal<ElementTemplateDraft>({ ...EMPTY_TEMPLATE_DRAFT });
  private readonly editingIdState = signal<string | null>(null);
  private readonly selectedTemplateIdState = signal<string | null>(null);

  // Selectors
  readonly templates = this.templatesState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly saving = this.savingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly draft = this.draftState.asReadonly();
  readonly isEditing = computed(() => this.editingIdState() !== null);
  readonly selectedTemplateId = this.selectedTemplateIdState.asReadonly();

  /** Plantilla seleccionada actualmente (para el flujo de reutilización). */
  readonly selectedTemplate = computed(() => {
    const id = this.selectedTemplateIdState();
    if (!id) return null;
    return this.templatesState().find((t) => t.id === id) ?? null;
  });

  // ===== LISTAR =====

  loadTemplates(): void {
    this.loadingState.set(true);
    this.errorState.set(null);
    this.api
      .listElementTemplates()
      .pipe(finalize(() => this.loadingState.set(false)))
      .subscribe({
        next: (templates) => this.templatesState.set(templates),
        error: () => this.errorState.set(this.strings.errors.loadFailed),
      });
  }

  // ===== CREAR =====

  startNew(): void {
    this.editingIdState.set(null);
    this.draftState.set({ ...EMPTY_TEMPLATE_DRAFT });
    this.errorState.set(null);
  }

  /** Guarda la plantilla actual como "Guardar como plantilla" desde un elemento existente. */
  saveFromElement(type: string, name: string): Observable<ElementTemplate> {
    this.draftState.set({ name, type });
    return this.doSave(null);
  }

  saveTemplate(): Observable<ElementTemplate> | null {
    const draft = this.draftState();
    const str = this.strings.form;

    const name = draft.name.trim();
    if (!name) {
      this.errorState.set(str.nameRequired);
      return null;
    }
    if (name.length > str.nameMaxLength) {
      this.errorState.set(str.nameTooLong);
      return null;
    }
    if (!draft.type) {
      return null;
    }

    return this.doSave(this.editingIdState());
  }

  private doSave(editingId: string | null): Observable<ElementTemplate> {
    const draft = this.draftState();
    const name = draft.name.trim();

    this.savingState.set(true);
    this.errorState.set(null);

    const request$: Observable<ElementTemplate> =
      editingId === null
        ? this.api.createElementTemplate({
            elementTemplateCreateRequest: {
              name,
              type: draft.type as ElementTemplateCreateRequest.TypeEnum,
            },
          })
        : this.api.updateElementTemplate({
            templateId: editingId,
            elementTemplateUpdateRequest: {
              name,
              type: draft.type as ElementTemplateUpdateRequest.TypeEnum,
            },
          });

    return request$.pipe(
      finalize(() => this.savingState.set(false)),
      tap({
        next: (saved) => {
          this.templatesState.update((templates) =>
            editingId === null
              ? [saved, ...templates].sort((a, b) => a.name.localeCompare(b.name))
              : templates.map((t) => (t.id === saved.id ? saved : t)),
          );
          this.startNew();
        },
        error: (response: { status?: number }) => {
          this.errorState.set(
            response?.status === 409
              ? this.strings.errors.nameConflict
              : this.strings.errors.saveFailed,
          );
        },
      }),
    );
  }

  // ===== EDITAR =====

  editTemplate(template: ElementTemplate): void {
    this.editingIdState.set(template.id);
    this.draftState.set({ name: template.name, type: template.type });
    this.errorState.set(null);
  }

  setDraftName(name: string): void {
    this.draftState.update((d) => ({ ...d, name }));
  }

  setDraftType(type: string): void {
    this.draftState.update((d) => ({ ...d, type }));
  }

  // ===== ELIMINAR =====

  deleteTemplate(id: string): Observable<void> {
    this.savingState.set(true);
    this.errorState.set(null);
    return this.api.deleteElementTemplate({ templateId: id }).pipe(
      finalize(() => this.savingState.set(false)),
      tap({
        next: () => {
          this.templatesState.update((templates) => templates.filter((t) => t.id !== id));
          if (this.editingIdState() === id) {
            this.startNew();
          }
        },
        error: () => this.errorState.set(this.strings.errors.deleteFailed),
      }),
    );
  }

  // ===== SELECCIÓN (flujo reutilizar) =====

  selectTemplate(id: string | null): void {
    this.selectedTemplateIdState.set(id);
  }

  clearSelection(): void {
    this.selectedTemplateIdState.set(null);
  }
}
