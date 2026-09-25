import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { SpacesStore } from '../model/spaces-store';

/** Formulario inline de creación de sector (CU-05 · MAP-70). */
@Component({
  selector: 'mapit-sector-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- La animación de entrada la hace el keyframe CSS formSlideIn del :host.
         Sin at-formEnter: Angular lo trataba como trigger sin declarar (NG05105). -->
    <div class="sector-form">
      <div class="form-header">
        <p class="form-eyebrow">{{ store.strings_.sectors.form.eyebrowNew }}</p>
        <h4 class="form-title">{{ store.strings_.sectors.form.createTitle }}</h4>
      </div>

      @if (store.error(); as error) {
        <p class="message error" role="alert">{{ error }}</p>
      }

      <label class="name-field">
        <span class="field-label">{{ store.strings_.sectors.form.nameLabel }}</span>
        <div class="input-wrapper">
          <input
            #nameInput
            type="text"
            [value]="store.sectorDraft().name"
            [attr.maxlength]="store.strings_.sectors.form.nameMaxLength"
            [placeholder]="store.strings_.sectors.form.namePlaceholder"
            (input)="store.setSectorName(nameInput.value)"
            [disabled]="store.saving()"
            autocomplete="off"
          />
          <span class="char-count"
            >{{ store.sectorDraft().name.length }}/{{
              store.strings_.sectors.form.nameMaxLength
            }}</span
          >
        </div>
        <p class="field-hint">{{ store.strings_.sectors.form.slugHint }}</p>
      </label>

      <div class="form-actions">
        <button
          class="btn-secondary"
          type="button"
          [disabled]="store.saving()"
          (click)="onCancel()"
        >
          {{ store.strings_.sectors.form.cancelButton }}
        </button>
        <button
          class="btn-primary"
          type="button"
          [disabled]="store.saving() || !store.sectorDraft().name.trim()"
          (click)="save()"
        >
          {{
            store.saving()
              ? store.strings_.sectors.form.saving
              : store.strings_.sectors.form.saveButton
          }}
        </button>
      </div>
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

    .sector-form {
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

    .name-field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .field-label {
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--mapit-color-text);
    }

    .input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    input[type='text'] {
      width: 100%;
      padding: 0.5rem 0.75rem;
      padding-right: 60px; /* Space for char count */
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

    input[type='text']:focus {
      outline: none;
      border-color: var(--mapit-color-primary);
      box-shadow: 0 0 0 3px var(--mapit-color-focus-ring);
    }

    input:disabled {
      background: var(--mapit-color-surface-low);
      color: var(--mapit-color-text-muted);
      cursor: not-allowed;
    }

    .char-count {
      position: absolute;
      right: 0.5rem;
      font-size: 0.6875rem;
      color: var(--mapit-color-text-muted);
      pointer-events: none;
    }

    .field-hint {
      margin: 0;
      font-size: 0.6875rem;
      color: var(--mapit-color-text-muted);
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 1rem;
      padding-top: 0.75rem;
      border-top: 1px solid var(--mapit-color-border);
    }

    .btn-secondary,
    .btn-primary {
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
      background: var(--mapit-color-surface-low);
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

    .btn-primary:disabled,
    .btn-secondary:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
  `,
})
export class SectorFormComponent {
  readonly floorId = input.required<string>();
  readonly saved = output<void>();
  readonly formClosed = output<void>();

  protected readonly store = inject(SpacesStore);

  protected save(): void {
    const name = this.store.sectorDraft().name.trim();
    if (!name) return;

    this.store.createSector(this.floorId(), name).subscribe({
      next: () => this.saved.emit(),
      error: () => {}, // Error handled in store
    });
  }

  protected onCancel(): void {
    this.formClosed.emit();
  }
}
