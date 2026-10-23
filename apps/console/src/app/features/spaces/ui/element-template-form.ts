import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TemplatesStore } from '../model/templates-store';
import { STRINGS } from '../../../core/strings';

/**
 * Formulario inline de creación/edición de plantillas de elemento (HU-4.02 / MAP-205).
 *
 * Sigue el patrón visual exacto de SpaceElementFormComponent: mismo grid, tokens,
 * animación de entrada y estructura de header. Se integra dentro de element-template-list.
 */
@Component({
  selector: 'mapit-element-template-form',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="template-form">
      <div class="form-header">
        <p class="form-eyebrow">
          {{ store.isEditing() ? strings.form.eyebrowEdit : strings.form.eyebrowNew }}
        </p>
        <h4 class="form-title">
          {{ store.isEditing() ? strings.form.editTitle : strings.form.createTitle }}
        </h4>
      </div>

      @if (store.error(); as error) {
        <p class="message error" role="alert">{{ error }}</p>
      }

      <form class="template-grid" (ngSubmit)="save()">
        <label class="field grid-span">
          <span class="field-label">{{ strings.form.nameLabel }}</span>
          <input
            type="text"
            name="name"
            id="template-name-input"
            [ngModel]="_draft().name"
            (ngModelChange)="store.setDraftName($event)"
            [disabled]="store.saving()"
            [placeholder]="strings.form.namePlaceholder"
            maxlength="100"
            autocomplete="off"
          />
        </label>

        <label class="field grid-span">
          <span class="field-label">{{ strings.form.typeLabel }}</span>
          <select
            name="type"
            id="template-type-select"
            [ngModel]="_draft().type"
            (ngModelChange)="store.setDraftType($event)"
            [disabled]="store.saving()"
          >
            @for (t of typeKeys; track t) {
              <option [value]="t">{{ elementStrings.types[t] }}</option>
            }
          </select>
        </label>

        <div class="form-actions grid-span">
          <button
            class="btn btn-secondary"
            type="button"
            [disabled]="store.saving()"
            (click)="cancel()"
          >
            {{ strings.form.cancelButton }}
          </button>
          <button
            class="btn btn-primary"
            type="submit"
            id="template-save-btn"
            [disabled]="store.saving() || !valid()"
          >
            {{
              store.saving()
                ? strings.form.saving
                : store.isEditing()
                  ? strings.form.updateButton
                  : strings.form.saveButton
            }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: `
    :host {
      display: block;
      animation: formSlideIn 0.15s ease-out;
    }

    @keyframes formSlideIn {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .template-form {
      margin-top: 0.5rem;
      padding: 1rem;
      background: var(--mapit-color-surface);
      border: 1px solid var(--mapit-color-border);
      border-radius: var(--mapit-radius);
    }

    .form-header {
      margin-bottom: 1rem;
    }

    .form-eyebrow {
      margin: 0 0 0.25rem;
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--mapit-color-primary);
    }

    .form-title {
      margin: 0;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--mapit-color-text);
    }

    .template-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.625rem 0.75rem;
    }

    .grid-span {
      grid-column: 1 / -1;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .field-label {
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--mapit-color-text);
    }

    input[type='text'],
    select {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--mapit-color-border-input);
      border-radius: var(--mapit-radius-input);
      color: var(--mapit-color-text);
      font: inherit;
      font-size: 0.875rem;
      background: var(--mapit-color-surface);
      transition:
        border-color 0.15s ease,
        box-shadow 0.15s ease;
    }

    input[type='text']:focus,
    select:focus {
      outline: none;
      border-color: var(--mapit-color-primary);
      box-shadow: 0 0 0 3px var(--mapit-color-focus-ring);
    }

    select:disabled,
    input:disabled {
      background: var(--mapit-color-surface-low);
      color: var(--mapit-color-text-muted);
      cursor: not-allowed;
    }

    .message {
      margin: 0 0 0.75rem;
      padding: 0.5rem 0.75rem;
      border-radius: var(--mapit-radius-input);
      font-size: 0.8125rem;
    }
    .error {
      color: var(--mapit-color-error);
      background: #fef2f2;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 0.5rem;
      padding-top: 0.75rem;
      border-top: 1px solid var(--mapit-color-border);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem 1rem;
      border-radius: var(--mapit-radius-input);
      font: inherit;
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-secondary {
      border: 1px solid var(--mapit-color-border);
      background: var(--mapit-color-surface);
      color: var(--mapit-color-text);
    }
    .btn-secondary:hover:not(:disabled) {
      border-color: var(--mapit-color-text-muted);
    }
    .btn-primary {
      border: none;
      background: var(--mapit-color-primary);
      color: var(--mapit-color-on-primary);
    }
    .btn-primary:hover:not(:disabled) {
      background: color-mix(in srgb, var(--mapit-color-primary) 85%, black);
    }
    .btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
  `,
})
export class ElementTemplateFormComponent {
  readonly saved = output<void>();
  readonly formClosed = output<void>();

  protected readonly store = inject(TemplatesStore);
  protected readonly strings = STRINGS.spaces.templates;
  protected readonly elementStrings = STRINGS.spaces.elements;

  protected readonly _draft = computed(() => this.store.draft());

  protected readonly typeKeys = [
    'TABLE',
    'BAR',
    'SECTOR_ZONE',
    'STAGE',
    'SEAT',
    'ROOM',
    'DECOR',
  ] as const;

  protected valid(): boolean {
    const d = this._draft();
    return d.name.trim().length > 0 && !!d.type;
  }

  protected save(): void {
    if (!this.valid()) return;
    const r = this.store.saveTemplate();
    if (r) {
      r.subscribe({
        next: () => this.saved.emit(),
        error: () => {}, // el store ya escribió el mensaje de error
      });
    }
  }

  protected cancel(): void {
    this.formClosed.emit();
  }
}
