import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SpacesStore } from '../model/spaces-store';

/** Formulario inline de registro/edición de elemento espacial (HU-2.03 / MAP-117). */
@Component({
  selector: 'mapit-space-element-form',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="element-form">
      <div class="form-header">
        <p class="form-eyebrow">
          {{ store.isEditingElement() ? strings.form.editTitle : strings.form.createTitle }}
        </p>
        <h4 class="form-title">{{ strings.form.createTitle }}</h4>
      </div>

      @if (store.error(); as error) {
        <p class="message error" role="alert">{{ error }}</p>
      }

      <form class="element-grid" (ngSubmit)="save()">
        <label class="field">
          <span class="field-label">{{ strings.form.typeLabel }}</span>
          <select
            name="type"
            [ngModel]="_draft().type"
            (ngModelChange)="store.setElementType($event)"
            [disabled]="store.saving()"
            [attr.aria-label]="strings.form.typeLabel"
          >
            @for (t of typeKeys; track t) {
              <option [value]="t">{{ strings.types[t] }}</option>
            }
          </select>
        </label>

        <label class="field">
          <span class="field-label">{{ strings.form.xLabel }}</span>
          <input
            type="number"
            name="x"
            min="0"
            step="any"
            inputmode="decimal"
            [ngModel]="_draft().x"
            (ngModelChange)="store.setElementX($event)"
            [disabled]="store.saving()"
            [attr.aria-label]="strings.form.xLabel"
          />
        </label>

        <label class="field">
          <span class="field-label">{{ strings.form.yLabel }}</span>
          <input
            type="number"
            name="y"
            min="0"
            step="any"
            inputmode="decimal"
            [ngModel]="_draft().y"
            (ngModelChange)="store.setElementY($event)"
            [disabled]="store.saving()"
            [attr.aria-label]="strings.form.yLabel"
          />
        </label>

        <label class="field">
          <span class="field-label">{{ strings.form.initialStateLabel }}</span>
          <select
            name="initialState"
            [ngModel]="_draft().initialState"
            (ngModelChange)="store.setElementInitialState($event)"
            [disabled]="store.saving() || store.isEditingElement()"
            [attr.aria-label]="strings.form.initialStateLabel"
            [title]="store.isEditingElement() ? strings.form.stateLockedHint : ''"
          >
            @for (s of stateKeys; track s) {
              <option [value]="s">{{ strings.states[s] }}</option>
            }
          </select>
        </label>

        <p class="field-hint grid-span">{{ strings.form.coordsHint }}</p>

        <div class="form-actions grid-span">
          <button
            class="btn btn-secondary"
            type="button"
            [disabled]="store.saving()"
            (click)="cancel()"
          >
            {{ strings.form.cancelButton }}
          </button>
          <button class="btn btn-primary" type="submit" [disabled]="store.saving() || !valid()">
            {{
              store.saving()
                ? strings.form.saving
                : store.isEditingElement()
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
      animation: formSlideIn 0.15s var(--mapit-ease-out);
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

    .element-form {
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

    .element-grid {
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

    input[type='number'],
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

    input[type='number']:focus,
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

    .field-hint {
      margin: 0;
      font-size: 0.6875rem;
      color: var(--mapit-color-text-muted);
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
      background: #1628b8;
    }
    .btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
  `,
})
export class SpaceElementFormComponent {
  readonly sectorId = input.required<string>();
  readonly saved = output<void>();
  readonly formClosed = output<void>();

  protected readonly store = inject(SpacesStore);

  protected readonly strings = this.store.strings_.elements;

  protected readonly _draft = computed(() => this.store.elementDraft());

  protected readonly typeKeys = [
    'TABLE',
    'BAR',
    'SECTOR_ZONE',
    'STAGE',
    'SEAT',
    'ROOM',
    'DECOR',
  ] as const;

  protected readonly stateKeys = [
    'AVAILABLE',
    'OCCUPIED',
    'RESERVED',
    'CLEANING',
    'OUT_OF_SERVICE',
  ] as const;

  protected valid(): boolean {
    const d = this._draft();
    const x = parseFloat(d.x);
    const y = parseFloat(d.y);
    return !!d.type && !isNaN(x) && x >= 0 && !isNaN(y) && y >= 0;
  }

  protected save(): void {
    if (!this.valid()) return;
    const ctxSectorId = this.sectorId();
    const r = this.store.saveElement(ctxSectorId);
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
