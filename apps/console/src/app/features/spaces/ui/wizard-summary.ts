import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import type { Establishment, Floor, Sector } from '@mapit/api-client';

import { STRINGS } from '../../../core/strings';
import { SpacesApiService } from '../data/spaces-api';

interface SummaryData {
  establishment: Establishment;
  floors: Floor[];
  sectors: Sector[];
}

/**
 * Paso 3 del asistente de configuración: resumen y confirmación.
 *
 * Solo lee: el establecimiento ya existe (paso 1) y la estructura también
 * (paso 2). El id viaja en la URL, así que el resumen sobrevive a refrescos.
 */
@Component({
  selector: 'mapit-wizard-summary',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wizard-layout">
      <nav class="wizard-stepper" [attr.aria-label]="strings.stepperAriaLabel" role="navigation">
        <ol class="steps">
          <li class="step completed">
            <a
              class="step-circle"
              [routerLink]="['/spaces/setup']"
              [attr.aria-label]="strings.stepBusinessAriaLabel"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </a>
            <span class="step-label">{{ strings.stepBusiness }}</span>
          </li>
          <li class="step-divider completed" aria-hidden="true"></li>
          <li class="step completed">
            <a
              class="step-circle"
              [routerLink]="['/spaces/floors', establishmentId()]"
              [attr.aria-label]="strings.stepStructureAriaLabel"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </a>
            <span class="step-label">{{ strings.stepStructure }}</span>
          </li>
          <li class="step-divider completed" aria-hidden="true"></li>
          <li class="step active">
            <span
              class="step-circle"
              [attr.aria-label]="strings.stepSummaryAriaLabel"
              aria-current="step"
            >
              <span class="step-number">3</span>
            </span>
            <span class="step-label">{{ strings.stepSummary }}</span>
          </li>
        </ol>
      </nav>

      <section class="wizard-header">
        <h1 class="page-title">{{ strings.summaryTitle }}</h1>
        <p class="page-description">{{ strings.summaryIntro }}</p>
      </section>

      <main class="wizard-main">
        @if (loading()) {
          <div class="state">{{ strings.stepSummary }}…</div>
        } @else if (error()) {
          <div class="state error" role="alert">
            {{ strings.summaryError }}
            <button class="btn-secondary" type="button" (click)="reload()">
              {{ strings.retry }}
            </button>
          </div>
        } @else if (data(); as summary) {
          <div class="cards">
            <section class="summary-card">
              <h2 class="card-title">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                </svg>
                {{ strings.cardBusiness }}
              </h2>
              <dl class="fields">
                <div class="field">
                  <dt>{{ strings.labelCommercialName }}</dt>
                  <dd class="strong">{{ summary.establishment.name }}</dd>
                </div>
                <div class="field">
                  <dt>{{ strings.labelSpaceType }}</dt>
                  <dd>
                    <span class="chip">{{ verticalLabel(summary.establishment.type) }}</span>
                  </dd>
                </div>
                <div class="field">
                  <dt>{{ strings.labelId }}</dt>
                  <dd class="mono">{{ summary.establishment.slug }}</dd>
                </div>
              </dl>
            </section>

            <section class="summary-card">
              <h2 class="card-title">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
                {{ strings.cardStructure }}
              </h2>
              <dl class="fields">
                <div class="field">
                  <dt>{{ strings.labelFloors }}</dt>
                  <dd class="count-row">
                    <span>{{
                      summary.floors.length > 0 ? floorNames(summary.floors) : strings.noFloors
                    }}</span>
                    <span class="count">{{ summary.floors.length }}</span>
                  </dd>
                </div>
                <div class="field">
                  <dt>{{ strings.labelZones }}</dt>
                  <dd class="count-row">
                    <span>{{
                      summary.sectors.length > 0 ? sectorNames(summary.sectors) : strings.noZones
                    }}</span>
                    <span class="count">{{ summary.sectors.length }}</span>
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        }
      </main>

      <footer class="wizard-footer">
        <div class="footer-actions">
          <a class="btn-secondary" [routerLink]="['/spaces/floors', establishmentId()]">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            {{ strings.previous }}
          </a>
          <button class="btn-primary" type="button" (click)="finish()">
            {{ strings.finish }}
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
        </div>
      </footer>
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
      text-decoration: none;
    }

    .step.completed .step-circle {
      background: var(--mapit-color-primary);
      color: var(--mapit-color-on-primary);
    }

    .step.completed .step-label {
      color: var(--mapit-color-primary);
      font-weight: 600;
    }

    .step.active .step-circle {
      background: var(--mapit-color-surface);
      border: 2px solid var(--mapit-color-primary);
      color: var(--mapit-color-primary);
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

    .step-divider.completed {
      background: var(--mapit-color-primary);
    }

    .wizard-header {
      padding: 1.5rem 1.5rem 0.5rem;
      text-align: center;
    }

    .page-title {
      margin: 0 0 0.5rem;
      font-size: 1.375rem;
      font-weight: 700;
    }

    .page-description {
      margin: 0 auto;
      max-width: 36rem;
      font-size: 0.875rem;
      color: var(--mapit-color-text-muted);
    }

    .wizard-main {
      flex: 1;
      padding: 1rem 1.5rem 1.5rem;
      max-width: 62rem;
      width: 100%;
      margin: 0 auto;
    }

    .state {
      padding: 2rem;
      text-align: center;
      color: var(--mapit-color-text-muted);
    }

    .state.error {
      color: var(--mapit-color-error);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }

    .cards {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .summary-card {
      background: var(--mapit-color-surface);
      border: 1px solid var(--mapit-color-border);
      border-radius: 0.75rem;
      padding: 1.25rem;
    }

    .card-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0 0 1rem;
      font-size: 0.9375rem;
      font-weight: 600;
    }

    .fields {
      display: flex;
      flex-direction: column;
      gap: 0.875rem;
      margin: 0;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .field dt {
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--mapit-color-text-muted);
    }

    .field dd {
      margin: 0;
      font-size: 0.9375rem;
    }

    .field .strong {
      font-weight: 700;
      font-size: 1.0625rem;
    }

    .field .mono {
      font-family: ui-monospace, monospace;
      color: var(--mapit-color-text-muted);
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      background: var(--mapit-color-primary-soft);
      color: var(--mapit-color-primary);
      font-weight: 600;
      font-size: 0.8125rem;
    }

    .count-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .count {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--mapit-color-primary);
    }

    .wizard-footer {
      border-top: 1px solid var(--mapit-color-border);
      padding: 1rem 1.5rem;
    }

    .footer-actions {
      max-width: 62rem;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
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
      font-size: 0.9375rem;
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

    .btn-primary {
      border: none;
      background: var(--mapit-color-primary);
      color: var(--mapit-color-on-primary);
    }

    .btn-primary:hover {
      background: #2f4fd0;
    }

    .btn-primary:focus-visible,
    .btn-secondary:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px #3b5fe533;
    }

    @media (max-width: 48rem) {
      .cards {
        grid-template-columns: 1fr;
      }
      .step-label {
        display: none;
      }
    }
  `,
})
export class WizardSummaryComponent {
  readonly establishmentId = input.required<string>();

  private readonly api = inject(SpacesApiService);
  private readonly router = inject(Router);

  protected readonly strings = STRINGS.spaces.wizard;
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly data = signal<SummaryData | null>(null);

  constructor() {
    this.reload();
  }

  protected reload(): void {
    const id = this.establishmentId();
    this.loading.set(true);
    this.error.set(false);
    this.api
      .getEstablishment(id)
      .pipe(
        switchMap((establishment) =>
          this.api.listFloors(id).pipe(
            switchMap((floors) =>
              floors.length === 0
                ? of({ establishment, floors, sectors: [] as Sector[] })
                : forkJoin(floors.map((f) => this.api.listSectorsByFloor(f.id))).pipe(
                    map((sectorLists) => ({
                      establishment,
                      floors,
                      sectors: sectorLists.flat(),
                    })),
                  ),
            ),
          ),
        ),
      )
      .subscribe({
        next: (summary) => {
          this.data.set(summary);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }

  protected verticalLabel(type: string): string {
    const verticals = STRINGS.verticals as unknown as Record<string, string>;
    return verticals[type] ?? type;
  }

  protected floorNames(floors: Floor[]): string {
    return floors.map((f) => f.name).join(', ');
  }

  protected sectorNames(sectors: Sector[]): string {
    return sectors.map((s) => s.name).join(', ');
  }

  protected finish(): void {
    void this.router.navigate(['/home']);
  }
}
