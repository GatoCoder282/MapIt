import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import type { Establishment, EstablishmentType } from '@mapit/api-client';
import { TimezonePicker } from '@mapit/ui-kit';
import { EstablishmentsStore } from '../model/establishments-store';
import { STRINGS } from '../../../../core/strings';

/**
 * Pantalla de gestión de establecimientos del tenant (CU-04).
 *
 * La lista ocupa todo el ancho; alta y edición van en un `<dialog>` modal
 * nativo (focus trap, cierre con Esc y top-layer sin librería extra), así la
 * pantalla nunca parte su grid en dos columnas que se pisan en anchos medios.
 */
@Component({
  selector: 'mapit-establishments',
  imports: [DatePipe, TimezonePicker],
  providers: [EstablishmentsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page">
      <header class="page-header">
        <div>
          <p class="eyebrow">{{ strings.establishments.eyebrow }}</p>
          <h1>{{ strings.establishments.title }}</h1>
          <p class="intro">{{ strings.establishments.intro }}</p>
        </div>
        <button class="btn-primary" type="button" (click)="openNew()">
          {{ strings.establishments.new }}
        </button>
      </header>

      @if (!dialogOpen()) {
        @if (store.error(); as error) {
          <p class="message error" role="alert">{{ error }}</p>
        }
      }

      <section class="card list-card">
        <div class="card-heading">
          <h2>{{ strings.establishments.list.title }}</h2>
          <span class="count">{{ store.items().length }}</span>
        </div>

        @if (store.loading()) {
          <p class="empty">{{ strings.establishments.list.loading }}</p>
        } @else if (store.items().length === 0) {
          <p class="empty">{{ strings.establishments.list.empty }}</p>
        } @else {
          <ul class="items">
            @for (item of store.items(); track item.id) {
              <li class="item-row">
                <div class="item-info">
                  <div class="item-title">
                    <strong>{{ item.name }}</strong>
                    <span class="badge">{{ label(item.type) }}</span>
                  </div>
                  <p class="item-meta">
                    <code>/{{ item.slug }}</code>
                    <span aria-hidden="true">·</span>
                    {{ item.timezone }}
                  </p>
                  <small>
                    {{ strings.establishments.list.updatedPrefix }}
                    {{ item.updatedAt | date: 'short' }}
                  </small>
                </div>
                <div class="row-actions">
                  <button
                    class="btn-secondary small"
                    type="button"
                    [disabled]="store.saving()"
                    (click)="openEdit(item)"
                  >
                    {{ strings.establishments.list.edit }}
                  </button>
                  <button
                    class="btn-danger small"
                    type="button"
                    [disabled]="store.saving()"
                    (click)="confirmRemove(item)"
                  >
                    {{ strings.establishments.list.remove }}
                  </button>
                </div>
              </li>
            }
          </ul>
        }
      </section>

      <dialog
        #editDialog
        class="edit-dialog"
        aria-labelledby="edit-dialog-title"
        (close)="dialogOpen.set(false)"
      >
        <article class="dialog-card">
          <header class="dialog-header">
            <div>
              <p class="eyebrow">
                {{
                  store.isEditing()
                    ? strings.establishments.form.eyebrowEdit
                    : strings.establishments.form.eyebrowNew
                }}
              </p>
              <h2 id="edit-dialog-title">
                {{
                  store.isEditing()
                    ? strings.establishments.form.titleEdit
                    : strings.establishments.form.titleNew
                }}
              </h2>
            </div>
            <button
              class="dialog-close"
              type="button"
              [attr.aria-label]="strings.establishments.form.close"
              (click)="closeDialog()"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </header>

          <div class="dialog-body">
            @if (store.error(); as error) {
              <p class="message error" role="alert">{{ error }}</p>
            }

            <label class="field">
              <span class="field-label">{{ strings.establishments.form.nameLabel }}</span>
              <input
                #name
                [value]="store.draft().name"
                maxlength="120"
                autocomplete="off"
                [placeholder]="strings.establishments.form.namePlaceholder"
                (input)="store.setName(name.value)"
              />
            </label>

            <label class="field">
              <span class="field-label">{{ strings.establishments.form.typeLabel }}</span>
              <select
                #type
                [value]="store.draft().type"
                [disabled]="store.isEditing()"
                (change)="onTypeChange(type.value)"
              >
                @for (option of store.types; track option) {
                  <option [value]="option" [selected]="option === store.draft().type">
                    {{ label(option) }}
                  </option>
                }
              </select>
              @if (store.isEditing()) {
                <span class="hint">{{ strings.establishments.form.typeImmutable }}</span>
              }
            </label>

            <label class="field">
              <span class="field-label">{{ strings.establishments.form.slugLabel }}</span>
              <input
                #slug
                [value]="store.draft().slug"
                maxlength="63"
                autocomplete="off"
                spellcheck="false"
                [placeholder]="strings.establishments.form.slugPlaceholder"
                (input)="store.setSlug(slug.value)"
              />
              <span class="hint">{{ strings.establishments.form.slugHint }}</span>
            </label>

            <div class="field">
              <label class="field-label" for="admin-timezone">{{
                strings.establishments.form.timezoneLabel
              }}</label>
              <mapit-ui-timezone-picker
                inputId="admin-timezone"
                [timezone]="store.draft().timezone"
                (timezoneChange)="store.setTimezone($event)"
              />
            </div>
          </div>

          <footer class="dialog-actions">
            <button
              class="btn-secondary"
              type="button"
              [disabled]="store.saving()"
              (click)="closeDialog()"
            >
              {{ strings.establishments.form.cancel }}
            </button>
            <button
              class="btn-primary"
              type="button"
              [disabled]="store.saving()"
              (click)="store.save()"
            >
              {{
                store.saving()
                  ? strings.establishments.form.submitting
                  : store.isEditing()
                    ? strings.establishments.form.submitEdit
                    : strings.establishments.form.submit
              }}
            </button>
          </footer>
        </article>
      </dialog>
    </main>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100dvh;
      background: var(--mapit-color-canvas);
    }
    .page {
      width: min(1120px, calc(100% - 2rem));
      margin: 0 auto;
      padding: 3rem 0;
    }
    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .eyebrow {
      margin: 0 0 0.4rem;
      color: var(--mapit-color-primary);
      font: var(--mapit-text-caps);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    h1 {
      margin: 0;
      color: var(--mapit-color-text);
      font-size: clamp(1.8rem, 4vw, 2.6rem);
      text-wrap: balance;
    }
    h2 {
      margin: 0;
      color: var(--mapit-color-text);
      font-size: 1.15rem;
      text-wrap: balance;
    }
    .intro {
      margin: 0.5rem 0 0;
      color: var(--mapit-color-text-variant);
    }
    .message {
      margin: 0 0 1.5rem;
      padding: 0.85rem 1rem;
      border-radius: var(--mapit-radius-lg);
    }
    .error {
      color: var(--mapit-color-error);
      background: color-mix(in srgb, var(--mapit-color-error) 10%, var(--mapit-color-surface));
    }

    /* ── Lista ─────────────────────────────────────────────── */
    .card {
      padding: 1.5rem;
      border: 1px solid var(--mapit-color-border);
      border-radius: var(--mapit-radius-lg);
      background: var(--mapit-color-surface);
    }
    .card-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }
    .count {
      padding: 0.15rem 0.7rem;
      border-radius: 999px;
      color: var(--mapit-color-primary);
      background: var(--mapit-color-nav-active-bg);
      font: var(--mapit-text-body-bold);
    }
    .empty {
      margin: 0;
      color: var(--mapit-color-text-muted);
    }
    .items {
      display: grid;
      gap: 0.75rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .item-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 1rem;
      padding: 0.9rem 1rem;
      border: 1px solid var(--mapit-color-border);
      border-radius: var(--mapit-radius-lg);
      background: var(--mapit-color-surface);
      transition: border-color var(--mapit-duration-fast) ease;
    }
    .item-row:hover {
      border-color: var(--mapit-color-accent);
    }
    .item-info {
      min-width: 0;
    }
    .item-title strong {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .item-title {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      flex-wrap: wrap;
    }
    .badge {
      padding: 0.1rem 0.55rem;
      border-radius: 999px;
      color: var(--mapit-color-primary);
      background: var(--mapit-color-nav-active-bg);
      font-size: 0.72rem;
      font-weight: 600;
    }
    .item-meta {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      flex-wrap: wrap;
      margin: 0.35rem 0;
      color: var(--mapit-color-text-variant);
      font-size: 0.9rem;
      min-width: 0;
    }
    .item-info small {
      color: var(--mapit-color-text-muted);
    }
    code {
      padding: 0.05rem 0.3rem;
      border-radius: var(--mapit-radius-input);
      background: var(--mapit-color-surface-low);
      font-family: var(--mapit-font-mono);
    }
    .row-actions {
      display: flex;
      gap: 0.5rem;
      flex-shrink: 0;
    }

    /* ── Botones ───────────────────────────────────────────── */
    .btn-primary,
    .btn-secondary,
    .btn-danger {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.6rem 1.1rem;
      border: none;
      border-radius: var(--mapit-radius-lg);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      touch-action: manipulation;
      transition: background var(--mapit-duration-fast) ease;
    }
    .btn-primary {
      color: var(--mapit-color-on-primary);
      background: var(--mapit-color-accent);
    }
    .btn-primary:hover:not(:disabled) {
      background: color-mix(in srgb, var(--mapit-color-accent) 85%, black);
    }
    .btn-secondary {
      color: var(--mapit-color-primary);
      background: var(--mapit-color-nav-active-bg);
    }
    .btn-secondary:hover:not(:disabled) {
      background: var(--mapit-color-primary-container);
    }
    .btn-danger {
      color: var(--mapit-color-error);
      background: color-mix(in srgb, var(--mapit-color-error) 10%, var(--mapit-color-surface));
    }
    .btn-danger:hover:not(:disabled) {
      background: color-mix(in srgb, var(--mapit-color-error) 16%, var(--mapit-color-surface));
    }
    .btn-primary:disabled,
    .btn-secondary:disabled,
    .btn-danger:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .btn-primary:focus-visible,
    .btn-secondary:focus-visible,
    .btn-danger:focus-visible,
    .dialog-close:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--mapit-color-focus-ring);
    }
    .small {
      padding: 0.4rem 0.8rem;
      font-size: 0.8125rem;
    }

    /* ── Modal de alta/edición (<dialog> nativo) ───────────── */
    .edit-dialog {
      width: min(26rem, calc(100% - 2rem));
      padding: 0;
      border: none;
      border-radius: var(--mapit-radius-xl);
      background: var(--mapit-color-surface);
      color: var(--mapit-color-text);
      box-shadow: var(--mapit-shadow);
      overscroll-behavior: contain;
    }
    .edit-dialog::backdrop {
      background: color-mix(in srgb, var(--mapit-color-text) 40%, transparent);
    }
    .edit-dialog[open] {
      animation: modal-in 160ms var(--mapit-ease-out);
    }
    @keyframes modal-in {
      from {
        opacity: 0;
        transform: translateY(6px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .edit-dialog[open] {
        animation: none;
      }
    }
    .dialog-card {
      display: flex;
      flex-direction: column;
    }
    .dialog-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      padding: 1.25rem 1.25rem 0;
    }
    .dialog-close {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      padding: 0;
      border: none;
      border-radius: var(--mapit-radius);
      background: transparent;
      color: var(--mapit-color-text-muted);
      cursor: pointer;
    }
    .dialog-close:hover {
      background: var(--mapit-color-surface-low);
      color: var(--mapit-color-text);
    }
    .dialog-body {
      display: grid;
      gap: 1rem;
      padding: 1.25rem;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .field-label {
      color: var(--mapit-color-text-variant);
      font-size: 0.8125rem;
      font-weight: 600;
    }
    .field input,
    .field select {
      width: 100%;
      padding: 0.6rem 0.7rem;
      border: 1px solid var(--mapit-color-border-input);
      border-radius: var(--mapit-radius);
      color: var(--mapit-color-text);
      font: inherit;
      background: var(--mapit-color-surface);
    }
    .field input:focus,
    .field select:focus {
      outline: none;
      border-color: var(--mapit-color-accent);
      box-shadow: 0 0 0 3px var(--mapit-color-focus-ring);
    }
    .field select:disabled {
      background: var(--mapit-color-surface-low);
      color: var(--mapit-color-text-muted);
      cursor: not-allowed;
    }
    .hint {
      color: var(--mapit-color-text-muted);
      font-size: 0.78rem;
    }
    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 0 1.25rem 1.25rem;
    }

    @media (max-width: 40rem) {
      .item-row {
        grid-template-columns: 1fr;
      }
      .row-actions {
        justify-content: flex-end;
      }
    }
  `,
})
export class Establishments {
  protected readonly store = inject(EstablishmentsStore);
  protected readonly strings = STRINGS;

  /** Si el modal está abierto, los errores se muestran dentro, no detrás del backdrop. */
  protected readonly dialogOpen = signal(false);

  /** Referencia al modal nativo; solo existe en la plantilla. */
  private readonly editDialog = viewChild<ElementRef<HTMLDialogElement>>('editDialog');

  private wasSaving = false;

  constructor() {
    // Cierra el modal solo cuando un guardado terminó sin error. `save()` no
    // devuelve observable, así que el cierre se engancha al flanco de
    // `saving` (true → false) del store, igual que haría un `finalize`.
    effect(() => {
      const saving = this.store.saving();
      const dialog = this.editDialog()?.nativeElement;
      if (this.wasSaving && !saving && !this.store.error() && dialog?.open) {
        dialog.close();
        this.dialogOpen.set(false);
      }
      this.wasSaving = saving;
    });
  }

  protected label(type: EstablishmentType): string {
    return STRINGS.verticals[type];
  }

  protected onTypeChange(value: string): void {
    this.store.setType(value as EstablishmentType);
  }

  protected openNew(): void {
    this.store.startNew();
    this.editDialog()?.nativeElement.showModal();
    this.dialogOpen.set(true);
  }

  protected openEdit(item: Establishment): void {
    this.store.edit(item);
    this.editDialog()?.nativeElement.showModal();
    this.dialogOpen.set(true);
  }

  protected closeDialog(): void {
    this.editDialog()?.nativeElement.close();
    this.dialogOpen.set(false);
  }

  protected confirmRemove(item: Establishment): void {
    // Plantilla de confirmación con hueco {name}: el nombre es dato, no texto.
    const message = STRINGS.establishments.removeConfirm.replace('{name}', item.name);
    if (confirm(message)) {
      this.store.remove(item.id);
    }
  }
}
