import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import type { Establishment, Floor, Sector } from '@mapit/api-client';

import { STRINGS } from '../../../core/strings';
import { SpacesApiService } from '../data/spaces-api';
import { SpacesStore } from '../model/spaces-store';
import { FeatureFlagService } from '@mapit/feature-flags';

interface SummaryData {
  establishment: Establishment;
  floors: Floor[];
  sectors: Sector[];
}

/**
 * Paso 3 del asistente de configuraciÃ³n: resumen y confirmaciÃ³n.
 *
 * Solo lee: el establecimiento ya existe (paso 1) y la estructura tambiÃ©n
 * (paso 2). El id viaja en la URL, asÃ­ que el resumen sobrevive a refrescos.
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
          <div class="state">{{ strings.stepSummary }}â€¦</div>
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
          @if (flags.isEnabled('editor.map.enabled')()) {
            <button class="btn-accent" type="button" (click)="openEditor()">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              {{ editorStrings.openEditor }}
            </button>
          }
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
      background: var(--mapit-color-nav-active-bg);
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

    .btn-primary {
      border: none;
      background: var(--mapit-color-accent);
      color: var(--mapit-color-on-primary);
    }

    .btn-primary:hover {
      background: color-mix(in srgb, var(--mapit-color-accent) 85%, black);
    }

    .btn-primary:focus-visible,
    .btn-secondary:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--mapit-color-focus-ring);
    }

    .btn-accent {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1.25rem;
      border-radius: 0.5rem;
      font: inherit;
      font-weight: 600;
      font-size: 0.9375rem;
      cursor: pointer;
      border: none;
      background: var(--mapit-color-primary);
      color: var(--mapit-color-on-primary);
      transition: background 150ms ease;
    }

    .btn-accent:hover {
      background: color-mix(in srgb, var(--mapit-color-primary) 85%, black);
    }

    .btn-accent:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--mapit-color-focus-ring);
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
  protected readonly store = inject(SpacesStore);
  protected readonly flags = inject(FeatureFlagService);

  protected readonly strings = STRINGS.spaces.wizard;
  protected readonly editorStrings = STRINGS.spaces.editor;
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly data = signal<SummaryData | null>(null);

  constructor() {
    effect(() => {
      this.loadSummary(this.establishmentId());
    });
  }

  protected reload(): void {
    this.loadSummary(this.establishmentId());
  }

  private readonly destroyRef = inject(DestroyRef);
  private requestSeq = 0;

  private loadSummary(id: string): void {
    const seq = ++this.requestSeq;
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
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (summary) => {
          if (seq !== this.requestSeq) return;
          this.data.set(summary);
          this.loading.set(false);
        },
        error: () => {
          if (seq !== this.requestSeq) return;
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

  protected openEditor(): void {
    // Get all sectors across all floors
    const allSectors = this.store.allSectors();

    if (allSectors.length === 0) {
      console.warn('[WizardSummary] No sectors found');
      return;
    }

    let targetSectorId: string | null = null;

    // First: find sector with elements
    for (const sector of allSectors) {
      const elements = this.store.elementsBySectorId(sector.id);
      if (elements.length > 0) {
        targetSectorId = sector.id;
        break;
      }
    }

    // Fallback: first sector
    if (!targetSectorId) {
      const firstSector = allSectors[0];
      if (firstSector) {
        targetSectorId = firstSector.id;
      }
    }

    if (targetSectorId) {
      const targetSector = allSectors.find((s) => s.id === targetSectorId);

      // Find floorId for this sector using the new public method
      const targetFloorId = this.store.floorIdForSector(targetSectorId);

      // Get establishmentId from the store
      const establishmentId = this.store.establishmentId();

      console.warn(
        '[WizardSummary] Navigating to editor with sector:',
        targetSectorId,
        targetSector?.name,
      );
      void this.router.navigate(['/spaces/editor', targetSectorId], {
        queryParams: {
          sectorName: targetSector?.name,
          floorId: targetFloorId,
          establishmentId: establishmentId,
        },
      });
    }
  }
}
