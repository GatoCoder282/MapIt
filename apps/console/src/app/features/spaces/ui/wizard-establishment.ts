import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideBedDouble, LucideChefHat, LucideMartini, LucidePartyPopper } from '@lucide/angular';

import { STRINGS } from '../../../core/strings';
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
        <h1 class="page-title">{{ strings.wizard.step1Title }}</h1>
      </section>

      <main class="wizard-main">
        @if (store.error(); as error) {
          <p class="message error" role="alert">{{ error }}</p>
        }

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
              <select name="timezone" [ngModel]="timezone()" (ngModelChange)="timezone.set($event)">
                @for (zone of timezones; track zone) {
                  <option [value]="zone">{{ zone }}</option>
                }
              </select>
            </label>
          </div>

          <footer class="wizard-footer">
            <div class="footer-actions">
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
    }

    .page-title {
      margin: 0;
      font-size: 1.375rem;
      font-weight: 700;
    }

    .wizard-main {
      flex: 1;
      padding: 0.5rem 1.5rem 1.5rem;
      max-width: 52rem;
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
      justify-content: flex-end;
      border-top: 1px solid var(--mapit-color-border);
      padding-top: 1rem;
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
  `,
})
export class WizardEstablishmentComponent {
  protected readonly store = inject(SpacesStore);
  private readonly router = inject(Router);

  protected readonly strings = STRINGS.spaces;

  protected readonly name = signal('');
  protected readonly establishmentType = signal<string | null>(null);
  protected readonly address = signal('');
  protected readonly timezone = signal('');
  protected readonly invalid = signal<ReadonlySet<Step1Field>>(new Set());

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
    // El paso 1 siempre empieza un establecimiento nuevo: limpia el contexto anterior.
    this.store.selectEstablishment(null);
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
