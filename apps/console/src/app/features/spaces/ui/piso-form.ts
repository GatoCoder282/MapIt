import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FeatureFlagService } from '@mapit/feature-flags';
import { SpacesStore } from '../model/spaces-store';

/** Formulario de creación/edición de planta (CU-05 · MAP-69). */
@Component({
  selector: 'mapit-piso-form',
  // NOTA: se usa el evento nativo (submit) en lugar de (ngSubmit). Este era el
  // bug: sin @angular/forms importado, `(ngSubmit)` se enlazaba a un evento DOM
  // "ngsubmit" que nunca existe, y el guardado fallaba en silencio.
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (flags.isEnabled('spaces.floors')()) {
      <article class="form-card">
        <header class="card-header">
          <div>
            <p class="eyebrow">
              {{
                store.isEditingFloor()
                  ? store.strings_.floors.form.eyebrowEdit
                  : store.strings_.floors.form.eyebrowNew
              }}
            </p>
            <h3>
              {{
                store.isEditingFloor()
                  ? store.strings_.floors.form.editTitle
                  : store.strings_.floors.form.createTitle
              }}
            </h3>
          </div>
        </header>

        @if (store.error(); as error) {
          <p class="message error" role="alert">{{ error }}</p>
        }

        <form (submit)="save($event)">
          <label>
            {{ store.strings_.floors.form.nameLabel }}
            <input
              type="text"
              [value]="store.floorDraft().name"
              [attr.maxlength]="store.strings_.floors.form.nameMaxLength"
              [placeholder]="store.strings_.floors.form.namePlaceholder"
              (input)="onNameInput($event)"
              [disabled]="store.saving()"
            />
            <span class="char-count">
              {{ store.floorDraft().name.length }}/{{ store.strings_.floors.form.nameMaxLength }}
            </span>
          </label>

          <label>
            {{ store.strings_.floors.form.levelLabel }}
            <input
              type="number"
              [value]="store.floorDraft().level"
              min="0"
              max="999"
              placeholder="0"
              (input)="onLevelInput($event)"
              [disabled]="store.saving()"
            />
          </label>

          @if (store.isEditingFloor()) {
            <p class="hint">
              {{ store.strings_.floors.form.slugHint }}
            </p>
          }

          <footer class="form-actions">
            <button
              class="primary"
              type="submit"
              [disabled]="store.saving() || !store.floorDraft().name.trim()"
            >
              {{
                store.saving()
                  ? store.strings_.floors.form.saving
                  : store.isEditingFloor()
                    ? store.strings_.floors.form.updateButton
                    : store.strings_.floors.form.saveButton
              }}
            </button>
            @if (store.isEditingFloor()) {
              <button
                class="secondary"
                type="button"
                [disabled]="store.saving()"
                (click)="store.startNewFloor()"
              >
                {{ store.strings_.floors.form.cancelButton }}
              </button>
            }
          </footer>
        </form>
      </article>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .form-card {
      padding: 1.5rem;
      border: 1px solid var(--mapit-color-border);
      border-radius: var(--mapit-radius-lg);
      background: var(--mapit-color-surface);
    }
    .card-header {
      margin-bottom: 1.25rem;
    }
    .eyebrow {
      margin: 0 0 0.35rem;
      color: var(--mapit-color-primary);
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    h3 {
      margin: 0;
      color: var(--mapit-color-text);
      font-size: 1.1rem;
      font-weight: 600;
    }
    .message {
      margin: 0 0 1rem;
      padding: 0.75rem 1rem;
      border-radius: var(--mapit-radius);
    }
    .error {
      color: var(--mapit-color-error);
      background: #fef2f2;
    }
    label {
      display: grid;
      gap: 0.35rem;
      margin-bottom: 1rem;
      color: var(--mapit-color-text-variant);
      font-size: 0.875rem;
      font-weight: 500;
    }
    input[type='text'],
    input[type='number'] {
      width: 100%;
      padding: 0.6rem 0.75rem;
      border: 1px solid var(--mapit-color-border-input);
      border-radius: var(--mapit-radius-input);
      color: var(--mapit-color-text);
      font: inherit;
      background: var(--mapit-color-surface);
      transition:
        border-color 0.15s ease,
        box-shadow 0.15s ease;
    }
    input[type='text']:focus,
    input[type='number']:focus {
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
      text-align: right;
      font-size: 0.7rem;
      color: var(--mapit-color-text-muted);
    }
    .hint {
      margin: -0.5rem 0 1rem;
      color: var(--mapit-color-text-muted);
      font-size: 0.75rem;
    }
    .form-actions {
      display: flex;
      gap: 0.75rem;
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid var(--mapit-color-border);
    }
    button {
      padding: 0.55rem 1rem;
      border: none;
      border-radius: var(--mapit-radius);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      transition:
        opacity 0.15s ease,
        background 0.15s ease;
    }
    button:disabled {
      opacity: 0.55;
      cursor: wait;
    }
    .primary {
      color: var(--mapit-color-on-primary);
      background: var(--mapit-color-primary);
    }
    .primary:hover:not(:disabled) {
      background: #1d4ed8;
    }
    .secondary {
      color: var(--mapit-color-primary);
      background: var(--mapit-color-primary-container);
      border: 1px solid var(--mapit-color-border);
    }
    .secondary:hover:not(:disabled) {
      background: var(--mapit-color-surface-low);
    }
  `,
})
export class PisoFormComponent {
  protected readonly store = inject(SpacesStore);
  protected readonly flags = inject(FeatureFlagService);

  protected onNameInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.store.setFloorName(target.value);
  }

  protected onLevelInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.store.setFloorLevel(target.value);
  }

  /** Handler del submit nativo: previene la recarga y delega en el store. */
  protected save(event: Event): void {
    event.preventDefault();
    this.store.saveFloor();
  }
}
