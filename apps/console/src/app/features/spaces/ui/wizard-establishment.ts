import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import type { Establishment } from '@mapit/api-client';
import { LucideBedDouble, LucideChefHat, LucideMartini, LucidePartyPopper } from '@lucide/angular';

import { STRINGS } from '../../../core/strings';
import { SpacesApiService } from '../data/spaces-api';
import { SpacesStore } from '../model/spaces-store';

type Step1Field = 'name' | 'type';

/**
 * Paso 1 del asistente de configuración (CU-04 + CU-05): datos del negocio.
 *
 * Crea el establecimiento y pasa su id al paso 2 por la URL
 * (`/spaces/floors/:establishmentId`), así el contexto nunca depende de estado
 * efímero: refrescar la página o volver atrás conserva la relación.
 */
@Component({
  selector: 'mapit-wizard-establishment',
  imports: [
    FormsModule,
    RouterLink,
    LucideChefHat,
    LucideMartini,
    LucidePartyPopper,
    LucideBedDouble,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wizard-layout">
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
                  <div class="est-info">
                    <span class="est-name">{{ est.name }}</span>
                    <span class="est-meta">
                      <span class="chip">{{ verticalLabel(est.type) }}</span>
                      <span class="est-address">{{
                        est.address ?? strings.wizard.withoutAddress
                      }}</span>
                    </span>
                  </div>
                  <div class="est-actions">
                    <button class="btn-secondary" type="button" (click)="editEst()">
                      {{ strings.wizard.edit }}
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

              <label class="field">
                <span class="field-label">{{ strings.wizard.timezoneLabel }}</span>
                <select
                  name="timezone"
                  [ngModel]="timezone()"
                  (ngModelChange)="timezone.set($event)"
                >
                  @for (zone of timezones; track zone) {
                    <option [value]="zone">{{ zone }}</option>
                  }
                </select>
              </label>
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
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100dvh;
      font-family: var(--mapit-font-sans);
      color-scheme: light;
      --mapit-color-canvas: #f8fafc;
      --mapit-color-surface: #ffffff;
      --mapit-color-surface-low: #f1f5f9;
      --mapit-color-border: #e2e8f0;
      --mapit-color-text: #0f172a;
      --mapit-color-text-muted: #475569;
      --mapit-color-primary: #3b5fe5;
      --mapit-color-primary-soft: #eef2ff;
      --mapit-color-on-primary: #ffffff;
      --mapit-color-error: #dc2626;
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
      box-shadow: 0 0 0 3px #3b5fe533;
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
      background: var(--mapit-color-primary-soft);
      color: var(--mapit-color-primary);
      font-weight: 600;
    }

    .type-card:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px #3b5fe533;
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
      transition: all 0.15s ease;
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
      box-shadow: 0 0 0 3px #3b5fe533;
    }

    .btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1.5rem;
      border: none;
      border-radius: 0.5rem;
      background: var(--mapit-color-primary);
      color: var(--mapit-color-on-primary);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s ease;
    }

    .btn-primary:hover:not(:disabled) {
      background: #2f4fd0;
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
      align-items: center;
      gap: 0.875rem;
      padding: 0.875rem 1rem;
      background: var(--mapit-color-surface);
      border: 1px solid var(--mapit-color-border);
      border-radius: 0.75rem;
      transition: border-color 0.15s ease;
    }

    .est-card:hover {
      border-color: var(--mapit-color-primary);
    }

    .est-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 0.5rem;
      background: var(--mapit-color-primary-soft);
      color: var(--mapit-color-primary);
      flex-shrink: 0;
    }

    .est-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .est-name {
      font-weight: 600;
      font-size: 0.9375rem;
    }

    .est-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .est-address {
      font-size: 0.75rem;
      color: var(--mapit-color-text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      padding: 0.125rem 0.625rem;
      border-radius: 9999px;
      background: var(--mapit-color-primary-soft);
      color: var(--mapit-color-primary);
      font-weight: 600;
      font-size: 0.75rem;
    }

    .est-actions {
      display: flex;
      gap: 0.375rem;
      flex-shrink: 0;
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

  protected readonly timezones: string[] = (
    Intl as { supportedValuesOf?(key: string): string[] }
  ).supportedValuesOf?.('timeZone') ?? ['America/La_Paz'];

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

  /** La edición no se duplica aquí: vive en la pantalla de administración. */
  protected editEst(): void {
    void this.router.navigate(['/establishments']);
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
        error: () => {}, // el store ya fijó el mensaje visible
      });
  }
}
