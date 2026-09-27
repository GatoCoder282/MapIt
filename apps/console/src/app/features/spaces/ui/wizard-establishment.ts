import {
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import type { Establishment } from '@mapit/api-client';
import { TimezonePicker } from '@mapit/ui-kit';
import { LucideBedDouble, LucideChefHat, LucideMartini, LucidePartyPopper } from '@lucide/angular';

import { STRINGS } from '../../../core/strings';
import { SLUG_PATTERN } from '../../../core/patterns';
import { SpacesApiService } from '../data/spaces-api';
import { SpacesStore } from '../model/spaces-store';

type Step1Field = 'name' | 'type';

/**
 * Paso 1 del asistente de configuraciÃ³n (CU-04 + CU-05): datos del negocio.
 *
 * Crea el establecimiento y pasa su id al paso 2 por la URL
 * (`/spaces/floors/:establishmentId`), asÃ­ el contexto nunca depende de estado
 * efÃ­mero: refrescar la pÃ¡gina o volver atrÃ¡s conserva la relaciÃ³n.
 */
@Component({
  selector: 'mapit-wizard-establishment',
  imports: [
    FormsModule,
    RouterLink,
    TimezonePicker,
    LucideChefHat,
    LucideMartini,
    LucidePartyPopper,
    LucideBedDouble,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wizard-layout">
      @if (modo() === 'form') {
        <nav
          class="wizard-stepper"
          [attr.aria-label]="strings.wizard.stepperAriaLabel"
          role="navigation"
        >
          <ol class="steps">
            <li class="step active">
              <span
                class="step-circle"
                [attr.aria-label]="strings.wizard.stepBusinessCurrentAriaLabel"
                aria-current="step"
              >
                <span class="step-number">1</span>
              </span>
              <span class="step-label">{{ strings.wizard.stepBusiness }}</span>
            </li>
            <li class="step-divider" aria-hidden="true"></li>
            <li class="step pending">
              <span
                class="step-circle"
                [attr.aria-label]="strings.wizard.stepStructurePendingAriaLabel"
              >
                <span class="step-number">2</span>
              </span>
              <span class="step-label">{{ strings.wizard.stepStructure }}</span>
            </li>
          </ol>
        </nav>
      }

      <section class="wizard-header">
        <h1 class="page-title">
          {{ modo() === 'list' ? strings.wizard.chooserTitle : strings.wizard.step1Title }}
        </h1>
        @if (modo() === 'list') {
          <p class="page-description">{{ strings.wizard.chooserIntro }}</p>
        }
      </section>

      <main class="wizard-main">
        @if (store.error(); as error) {
          <p class="message error" role="alert">{{ error }}</p>
        }

        @if (modo() === 'loading') {
          <div class="state">{{ strings.wizard.loadingEstablishments }}</div>
        }

        @if (modo() === 'list') {
          <div class="chooser">
            <h2 class="chooser-title">{{ strings.wizard.yourEstablishments }}</h2>
            <ul class="est-list">
              @for (est of establishments(); track est.id) {
                <li class="est-card">
                  <div class="est-card-head">
                    <div class="est-icon" aria-hidden="true">
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                      </svg>
                    </div>
                    <span class="est-name" [title]="est.name">{{ est.name }}</span>
                  </div>
                  <div class="est-meta">
                    <span class="chip">{{ verticalLabel(est.type) }}</span>
                    <span class="est-address">{{
                      est.address ?? strings.wizard.withoutAddress
                    }}</span>
                  </div>
                  <div class="est-actions">
                    <button
                      class="btn-icon"
                      type="button"
                      [attr.aria-label]="editActionLabel(est)"
                      [title]="strings.wizard.edit"
                      (click)="openEdit(est)"
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
                        <circle cx="12" cy="5" r="1" />
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="12" cy="19" r="1" />
                      </svg>
                    </button>
                    <button class="btn-primary small" type="button" (click)="selectEst(est.id)">
                      {{ strings.wizard.select }}
                    </button>
                  </div>
                </li>
              }
            </ul>
            <button class="btn-primary" type="button" (click)="startCreate()">
              + {{ strings.wizard.createNew }}
            </button>
          </div>
        }

        @if (modo() === 'form') {
          <form class="form" (ngSubmit)="submit()">
            <label class="field">
              <span class="field-label">{{ strings.wizard.nameLabel }}</span>
              <input
                type="text"
                name="name"
                [ngModel]="name()"
                (ngModelChange)="name.set($event)"
                [placeholder]="strings.wizard.namePlaceholder"
                [attr.aria-invalid]="invalid().has('name') || null"
                maxlength="120"
                required
              />
              @if (invalid().has('name')) {
                <span class="field-error">{{ strings.wizard.nameRequired }}</span>
              }
            </label>

            <fieldset class="field types">
              <legend class="field-label">{{ strings.wizard.typeLabel }}</legend>
              <div class="type-grid" role="radiogroup">
                @for (option of typeOptions; track option.value) {
                  <button
                    type="button"
                    class="type-card"
                    [class.selected]="establishmentType() === option.value"
                    role="radio"
                    [attr.aria-checked]="establishmentType() === option.value"
                    [attr.aria-invalid]="invalid().has('type') || null"
                    (click)="establishmentType.set(option.value)"
                  >
                    @switch (option.value) {
                      @case ('RESTAURANT') {
                        <svg lucideChefHat class="type-icon" aria-hidden="true"></svg>
                      }
                      @case ('NIGHTCLUB') {
                        <svg lucideMartini class="type-icon" aria-hidden="true"></svg>
                      }
                      @case ('EVENT_HALL') {
                        <svg lucidePartyPopper class="type-icon" aria-hidden="true"></svg>
                      }
                      @case ('HOTEL') {
                        <svg lucideBedDouble class="type-icon" aria-hidden="true"></svg>
                      }
                    }
                    <span>{{ option.label }}</span>
                  </button>
                }
              </div>
              @if (invalid().has('type')) {
                <span class="field-error">{{ strings.wizard.typeRequired }}</span>
              }
            </fieldset>

            <div class="field-row">
              <label class="field">
                <span class="field-label">{{ strings.wizard.addressLabel }}</span>
                <input
                  type="text"
                  name="address"
                  [ngModel]="address()"
                  (ngModelChange)="address.set($event)"
                  [placeholder]="strings.wizard.addressPlaceholder"
                  maxlength="200"
                />
              </label>

              <div class="field">
                <label class="field-label" for="wizard-timezone">{{
                  strings.wizard.timezoneLabel
                }}</label>
                <mapit-ui-timezone-picker inputId="wizard-timezone" [(timezone)]="timezone" />
              </div>
            </div>

            <footer class="wizard-footer">
              <div class="footer-actions">
                @if (establishments().length > 0) {
                  <button class="btn-secondary" type="button" (click)="modo.set('list')">
                    {{ strings.wizard.backToList }}
                  </button>
                } @else {
                  <a class="btn-secondary" routerLink="/home">
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      aria-hidden="true"
                    >
                      <line x1="19" y1="12" x2="5" y2="12" />
                      <polyline points="12 19 5 12 12 5" />
                    </svg>
                    {{ strings.wizard.previous }}
                  </a>
                }
                <button class="btn-primary" type="submit" [disabled]="store.saving()">
                  {{ store.saving() ? strings.wizard.creating : strings.wizard.next }}
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    aria-hidden="true"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </div>
            </footer>
          </form>
        }
      </main>

      <dialog
        #editDialog
        class="edit-dialog"
        aria-labelledby="edit-dialog-title"
        (close)="editTarget.set(null)"
      >
        @if (editTarget(); as target) {
          <article class="dialog-card">
            <header class="dialog-header">
              <div>
                <p class="eyebrow">{{ strings.wizard.editEyebrow }}</p>
                <h2 id="edit-dialog-title">{{ strings.wizard.editTitle }}</h2>
              </div>
              <button
                class="dialog-close"
                type="button"
                [attr.aria-label]="strings.wizard.closeDialog"
                (click)="closeEdit()"
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
              @if (editError(); as error) {
                <p class="message error" role="alert">{{ error }}</p>
              }

              <label class="field">
                <span class="field-label">{{ strings.wizard.nameLabel }}</span>
                <input
                  #editName
                  type="text"
                  [value]="editNameValue()"
                  maxlength="120"
                  autocomplete="off"
                  (input)="editNameValue.set(editName.value)"
                />
              </label>

              <label class="field">
                <span class="field-label">{{ strings.wizard.slugLabel }}</span>
                <input
                  #editSlug
                  type="text"
                  [value]="editSlugValue()"
                  maxlength="63"
                  autocomplete="off"
                  spellcheck="false"
                  (input)="editSlugValue.set(editSlug.value)"
                />
                <span class="hint">{{ strings.wizard.slugHint }}</span>
              </label>

              <div class="field">
                <label class="field-label" for="edit-timezone">{{
                  strings.wizard.timezoneLabel
                }}</label>
                <mapit-ui-timezone-picker
                  inputId="edit-timezone"
                  [(timezone)]="editTimezoneValue"
                />
              </div>

              <p class="hint">
                {{ strings.wizard.editTypeImmutable }} {{ verticalLabel(target.type) }}
              </p>
            </div>

            <footer class="dialog-footer">
              <button
                class="btn-danger"
                type="button"
                [disabled]="editSaving() || editDeleting()"
                (click)="openDelete()"
              >
                {{ strings.wizard.delete }}
              </button>
              <span class="dialog-footer-spacer"></span>
              <button
                class="btn-secondary"
                type="button"
                [disabled]="editSaving() || editDeleting()"
                (click)="closeEdit()"
              >
                {{ strings.wizard.cancel }}
              </button>
              <button
                class="btn-primary"
                type="button"
                [disabled]="editSaving() || editDeleting()"
                (click)="saveEdit()"
              >
                {{ editSaving() ? strings.wizard.savingChanges : strings.wizard.saveChanges }}
              </button>
            </footer>
          </article>
        }
      </dialog>

      <!-- Confirmación destructiva (tipo GitHub): exige escribir el nombre para habilitar. -->
      <dialog
        #deleteDialog
        class="edit-dialog confirm-dialog"
        role="alertdialog"
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-warning"
        (close)="closeDelete()"
      >
        @if (editTarget(); as target) {
          <article class="dialog-card">
            <header class="dialog-header">
              <span class="confirm-icon" aria-hidden="true">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                  />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </span>
              <h2 id="delete-dialog-title">{{ strings.wizard.deleteTitle }}</h2>
            </header>

            <div class="dialog-body">
              <p id="delete-dialog-warning" class="confirm-warning">
                {{ strings.wizard.deleteWarningPre
                }}<strong class="confirm-name">«{{ target.name }}»</strong
                >{{ strings.wizard.deleteWarningPost }}
              </p>

              @if (editError(); as error) {
                <p class="message error" role="alert">{{ error }}</p>
              }

              <label class="field">
                <span class="field-label">{{ strings.wizard.deleteNameLabel }}</span>
                <input
                  #deleteName
                  type="text"
                  [value]="deleteNameValue()"
                  autocomplete="off"
                  spellcheck="false"
                  [disabled]="editDeleting()"
                  (input)="deleteNameValue.set(deleteName.value)"
                  (paste)="$event.preventDefault()"
                  (drop)="$event.preventDefault()"
                />
              </label>
            </div>

            <footer class="dialog-footer">
              <button
                class="btn-secondary"
                type="button"
                [disabled]="editDeleting()"
                (click)="deleteDialog.close()"
              >
                {{ strings.wizard.cancel }}
              </button>
              <button
                class="btn-danger-solid"
                type="button"
                [disabled]="!canDelete() || editDeleting()"
                (click)="confirmDelete()"
              >
                {{ editDeleting() ? strings.wizard.deleting : strings.wizard.delete }}
              </button>
            </footer>
          </article>
        }
      </dialog>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100dvh;
      font-family: var(--mapit-font-sans);
      color-scheme: light;
      background: var(--mapit-color-canvas);
      color: var(--mapit-color-text);
      animation: pageIn 180ms ease-out;
    }

    @keyframes pageIn {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      :host {
        animation: none;
      }
    }

    .wizard-layout {
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
    }

    .wizard-stepper {
      display: flex;
      justify-content: center;
      padding: 1.5rem 1rem 0;
      background: var(--mapit-color-canvas);
    }

    .steps {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .step {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .step-circle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border-radius: 9999px;
      background: var(--mapit-color-surface-low);
      color: var(--mapit-color-text-muted);
      font-weight: 600;
      font-size: 0.8125rem;
    }

    .step.active .step-circle {
      background: var(--mapit-color-primary);
      color: var(--mapit-color-on-primary);
    }

    .step.active .step-label {
      color: var(--mapit-color-primary);
      font-weight: 600;
    }

    .step-label {
      font-size: 0.8125rem;
      color: var(--mapit-color-text-muted);
    }

    .step-divider {
      width: 3rem;
      height: 2px;
      background: var(--mapit-color-border);
    }

    .wizard-header {
      padding: 1.5rem 1.5rem 0.5rem;
      text-align: center;
    }

    .page-title {
      margin: 0;
      font-size: 1.375rem;
      font-weight: 700;
    }

    .wizard-main {
      flex: 1;
      padding: 0.5rem 1.5rem 1.5rem;
      max-width: 62rem;
      width: 100%;
      margin: 0 auto;
    }

    .form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      background: var(--mapit-color-surface);
      border: 1px solid var(--mapit-color-border);
      border-radius: 0.75rem;
      padding: 1.5rem;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .field-label {
      font-size: 0.8125rem;
      font-weight: 500;
    }

    input,
    select {
      width: 100%;
      padding: 0.625rem 0.875rem;
      border: 1px solid var(--mapit-color-border);
      border-radius: 0.5rem;
      font: inherit;
      font-size: 0.9375rem;
      background: var(--mapit-color-surface);
      color: var(--mapit-color-text);
      transition:
        border-color 0.15s ease,
        box-shadow 0.15s ease;
    }

    input:focus,
    select:focus {
      outline: none;
      border-color: var(--mapit-color-primary);
      box-shadow: 0 0 0 3px var(--mapit-color-focus-ring);
    }

    .fieldset,
    .types {
      border: none;
      margin: 0;
      padding: 0;
    }

    .type-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
      gap: 0.75rem;
    }

    .type-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 1.25rem 0.75rem;
      border: 1px solid var(--mapit-color-border);
      border-radius: 0.75rem;
      background: var(--mapit-color-surface);
      color: var(--mapit-color-text);
      font: inherit;
      font-size: 0.875rem;
      cursor: pointer;
      transition:
        border-color 0.15s ease,
        background 0.15s ease;
    }

    .type-card:hover {
      border-color: var(--mapit-color-primary);
    }

    .type-card.selected {
      border-color: var(--mapit-color-primary);
      background: var(--mapit-color-nav-active-bg);
      color: var(--mapit-color-primary);
      font-weight: 600;
    }

    .type-card:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--mapit-color-focus-ring);
    }

    .type-icon {
      width: 28px;
      height: 28px;
    }

    .field-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .field-error {
      font-size: 0.75rem;
      color: var(--mapit-color-error);
    }

    .message.error {
      margin: 0 0 0.75rem;
      padding: 0.625rem 0.875rem;
      border-radius: 0.5rem;
      font-size: 0.8125rem;
      color: var(--mapit-color-error);
      background: #fef2f2;
    }

    .wizard-footer {
      display: flex;
      justify-content: space-between;
      border-top: 1px solid var(--mapit-color-border);
      padding-top: 1rem;
    }

    .footer-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
    }

    .btn-secondary,
    .btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1.25rem;
      border-radius: 0.5rem;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition:
        background 150ms ease,
        border-color 150ms ease;
    }

    .btn-secondary {
      border: 1px solid var(--mapit-color-border);
      background: var(--mapit-color-surface);
      color: var(--mapit-color-text);
    }

    .btn-secondary:hover {
      border-color: var(--mapit-color-text-muted);
    }

    .btn-secondary:focus-visible,
    .btn-primary:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--mapit-color-focus-ring);
    }

    .btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1.5rem;
      border: none;
      border-radius: 0.5rem;
      background: var(--mapit-color-accent);
      color: var(--mapit-color-on-primary);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s ease;
    }

    .btn-primary:hover:not(:disabled) {
      background: color-mix(in srgb, var(--mapit-color-accent) 85%, black);
    }

    .btn-primary:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .btn-primary.small {
      padding: 0.375rem 0.875rem;
      font-size: 0.8125rem;
    }

    .state {
      padding: 2rem;
      text-align: center;
      color: var(--mapit-color-text-muted);
    }

    .chooser {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .chooser-title {
      margin: 0;
      font-size: 0.8125rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--mapit-color-text-muted);
    }

    .est-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(19rem, 1fr));
      gap: 0.75rem;
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .est-card {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1rem;
      background: var(--mapit-color-surface);
      border: 1px solid var(--mapit-color-border);
      border-radius: 0.75rem;
      transition: border-color 0.15s ease;
    }

    .est-card:hover {
      border-color: var(--mapit-color-primary);
    }

    .est-card-head {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-width: 0;
    }

    .est-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 0.5rem;
      background: var(--mapit-color-nav-active-bg);
      color: var(--mapit-color-primary);
      flex-shrink: 0;
    }

    .est-name {
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      font-weight: 600;
      font-size: 0.9375rem;
    }

    .est-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-width: 0;
    }

    .est-address {
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      font-size: 0.75rem;
      color: var(--mapit-color-text-muted);
    }

    .chip {
      display: inline-flex;
      align-items: center;
      flex-shrink: 0;
      padding: 0.125rem 0.625rem;
      border-radius: 9999px;
      background: var(--mapit-color-nav-active-bg);
      color: var(--mapit-color-primary);
      font-weight: 600;
      font-size: 0.75rem;
    }

    .est-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: auto;
    }

    .btn-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      padding: 0;
      border: none;
      border-radius: 0.5rem;
      background: transparent;
      color: var(--mapit-color-text-muted);
      cursor: pointer;
      transition:
        background 150ms ease,
        color 150ms ease;
    }

    .btn-icon:hover {
      background: var(--mapit-color-surface-low);
      color: var(--mapit-color-text);
    }

    .btn-icon:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--mapit-color-focus-ring);
    }

    /* Diálogos (editar / confirmación) y botones danger: estilos globales
       en apps/console/src/styles.scss — son compartidos con administration. */

    .btn-secondary.small,
    .btn-primary.small {
      padding: 0.375rem 0.875rem;
      font-size: 0.8125rem;
    }

    .eyebrow {
      margin: 0 0 0.4rem;
      color: var(--mapit-color-primary);
      font: var(--mapit-text-caps);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .hint {
      color: var(--mapit-color-text-muted);
      font-size: 0.78rem;
    }
  `,
})
export class WizardEstablishmentComponent {
  protected readonly store = inject(SpacesStore);
  private readonly api = inject(SpacesApiService);
  private readonly router = inject(Router);

  protected readonly strings = STRINGS.spaces;

  protected readonly name = signal('');
  protected readonly establishmentType = signal<string | null>(null);
  protected readonly address = signal('');
  protected readonly timezone = signal('');
  protected readonly invalid = signal<ReadonlySet<Step1Field>>(new Set());

  /** Selector inicial: si ya hay establecimientos se listan; si no, el formulario. */
  protected readonly modo = signal<'loading' | 'list' | 'form'>('loading');
  protected readonly establishments = signal<Establishment[]>([]);

  protected readonly typeOptions = [
    { value: 'RESTAURANT', label: STRINGS.verticals.RESTAURANT },
    { value: 'NIGHTCLUB', label: STRINGS.verticals.NIGHTCLUB },
    { value: 'EVENT_HALL', label: STRINGS.verticals.EVENT_HALL },
    { value: 'HOTEL', label: STRINGS.verticals.HOTEL },
  ] as const;

  constructor() {
    this.loadEstablishments();
  }

  private loadEstablishments(): void {
    this.api.listEstablishments().subscribe({
      next: (list) => {
        this.establishments.set(list);
        this.modo.set(list.length > 0 ? 'list' : 'form');
      },
      error: () => {
        // Sin listado no se puede elegir: se cae al formulario de alta.
        this.modo.set('form');
      },
    });
  }

  protected selectEst(id: string): void {
    this.store.selectEstablishment(id);
    void this.router.navigate(['/spaces/floors', id]);
  }

  /** La ediciÃ³n rÃ¡pida ocurre aquÃ­ mismo, en un modal: no redirige al backoffice. */
  protected readonly editTarget = signal<Establishment | null>(null);
  protected readonly editNameValue = signal('');
  protected readonly editSlugValue = signal('');
  protected readonly editTimezoneValue = signal('');
  protected readonly editSaving = signal(false);
  protected readonly editDeleting = signal(false);
  protected readonly editError = signal<string | null>(null);

  /** Referencia al modal nativo; solo existe en la plantilla. */
  private readonly editDialog = viewChild<ElementRef<HTMLDialogElement>>('editDialog');

  protected editActionLabel(est: Establishment): string {
    return this.strings.wizard.editAction.replace('{name}', est.name);
  }

  protected openEdit(est: Establishment): void {
    this.editTarget.set(est);
    this.editNameValue.set(est.name);
    this.editSlugValue.set(est.slug);
    this.editTimezoneValue.set(est.timezone);
    this.editError.set(null);
    this.editDialog()?.nativeElement.showModal();
  }

  protected closeEdit(): void {
    this.editDialog()?.nativeElement.close();
  }

  protected saveEdit(): void {
    const target = this.editTarget();
    if (!target) return;

    const name = this.editNameValue().trim();
    const slug = this.editSlugValue().trim();
    if (!name) {
      this.editError.set(this.strings.wizard.nameRequired);
      return;
    }
    if (!SLUG_PATTERN.test(slug)) {
      this.editError.set(this.strings.wizard.slugInvalid);
      return;
    }

    this.editSaving.set(true);
    this.editError.set(null);
    this.api
      .updateEstablishment(target.id, {
        name,
        slug,
        address: target.address ?? null,
        timezone: this.editTimezoneValue().trim() || target.timezone,
      })
      .pipe(finalize(() => this.editSaving.set(false)))
      .subscribe({
        next: (saved) => {
          this.establishments.update((list) =>
            list.map((item) => (item.id === saved.id ? saved : item)),
          );
          this.closeEdit();
        },
        error: (response: { status?: number }) =>
          this.editError.set(
            response?.status === 409
              ? this.strings.wizard.slugConflict
              : this.strings.wizard.updateFailed,
          ),
      });
  }

  /** Baja del establecimiento: modal de confirmación que exige escribir el nombre. */
  protected readonly deleteNameValue = signal('');

  /** Referencia al modal de confirmación; solo existe en la plantilla. */
  private readonly deleteDialog = viewChild<ElementRef<HTMLDialogElement>>('deleteDialog');

  /** El botón de eliminar solo se habilita cuando el nombre coincide exactamente. */
  protected readonly canDelete = computed(
    () =>
      this.deleteNameValue().trim() !== '' &&
      this.deleteNameValue().trim() === this.editTarget()?.name,
  );

  protected openDelete(): void {
    this.deleteNameValue.set('');
    this.editError.set(null);
    this.deleteDialog()?.nativeElement.showModal();
  }

  /** Al cerrar (Esc, botón o cierre programado) se limpia el nombre escrito. */
  protected closeDelete(): void {
    this.deleteNameValue.set('');
  }

  protected confirmDelete(): void {
    const target = this.editTarget();
    if (!target || this.editDeleting() || !this.canDelete()) return;

    this.editDeleting.set(true);
    this.editError.set(null);
    this.api
      .deleteEstablishment(target.id)
      .pipe(finalize(() => this.editDeleting.set(false)))
      .subscribe({
        next: () => {
          this.establishments.update((list) => list.filter((item) => item.id !== target.id));
          this.deleteDialog()?.nativeElement.close();
          this.closeEdit();
          if (this.establishments().length === 0) this.modo.set('form');
        },
        error: () => this.editError.set(this.strings.wizard.deleteFailed),
      });
  }

  protected startCreate(): void {
    this.store.selectEstablishment(null);
    this.modo.set('form');
  }

  protected verticalLabel(type: string): string {
    const verticals = STRINGS.verticals as unknown as Record<string, string>;
    return verticals[type] ?? type;
  }

  protected submit(): void {
    const missing = new Set<Step1Field>();
    if (!this.name().trim()) missing.add('name');
    if (!this.establishmentType()) missing.add('type');
    this.invalid.set(missing);
    if (missing.size > 0) return;

    this.store
      .createEstablishment({
        name: this.name().trim(),
        type: this.establishmentType() as string,
        address: this.address(),
        timezone: this.timezone(),
      })
      .subscribe({
        next: (est) => void this.router.navigate(['/spaces/floors', est.id]),
        error: () => {}, // el store ya fijÃ³ el mensaje visible
      });
  }
}
