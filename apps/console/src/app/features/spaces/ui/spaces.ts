import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { PisoFormComponent } from './piso-form';
import { PisoListComponent } from './piso-list';
import { SpacesStore } from '../model/spaces-store';

/** Pantalla principal del Setup Wizard - Step 2: Estructura del espacio (CU-05 · MAP-69/70). */
@Component({
  selector: 'mapit-spaces',
  imports: [PisoFormComponent, PisoListComponent],
  providers: [SpacesStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wizard-layout">
      <!-- Top Bar -->
      <header class="wizard-topbar" role="banner">
        <div class="topbar-left">
          <span class="brand">MapIt</span>
          <span class="divider" aria-hidden="true"></span>
          <span class="wizard-title">Setup Wizard</span>
        </div>
        <div class="topbar-right">
          <button class="help-btn" type="button" aria-label="Ayuda" (click)="openHelp()">?</button>
          <button class="exit-btn" type="button" (click)="exitWizard()">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </svg>
            Exit Setup
          </button>
        </div>
      </header>

      <!-- Stepper -->
      <nav class="wizard-stepper" aria-label="Progreso del asistente" role="navigation">
        <ol class="steps">
          <li class="step completed" [class.active]="false">
            <button
              class="step-circle"
              type="button"
              aria-label="Paso 1: Business Details, completado"
              disabled
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
            </button>
            <span class="step-label">Business Details</span>
          </li>
          <li class="step-divider completed" aria-hidden="true"></li>
          <li class="step active" [class.active]="true">
            <button
              class="step-circle"
              type="button"
              aria-label="Paso 2: Space Structure, actual"
              disabled
            >
              <span class="step-number">2</span>
            </button>
            <span class="step-label">Space Structure</span>
          </li>
          <li class="step-divider" aria-hidden="true"></li>
          <li class="step pending" [class.active]="false">
            <button
              class="step-circle"
              type="button"
              aria-label="Paso 3: Summary, pendiente"
              disabled
            >
              <span class="step-number">3</span>
            </button>
            <span class="step-label">Summary</span>
          </li>
        </ol>
      </nav>

      <!-- Page Header -->
      <section class="wizard-header">
        <div class="header-content">
          <h1 class="page-title">Estructura del espacio</h1>
          <p class="page-description">
            Define the physical hierarchy of your location. Start by creating floors, then add
            specific sectors or zones to each floor.
          </p>
        </div>
      </section>

      <!-- Main Content Card -->
      <main class="wizard-main" role="main">
        <div class="central-card">
          <div class="card-header">
            <div>
              <p class="card-eyebrow">{{ store.strings_.floors.title }}</p>
              <h2 class="card-title">{{ store.strings_.floors.subtitle }}</h2>
            </div>
            <span class="drag-badge" aria-label="Arrastra para reordenar">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                aria-hidden="true"
              >
                <circle cx="9" cy="19" r="1" />
                <circle cx="9" cy="12" r="1" />
                <circle cx="9" cy="5" r="1" />
                <circle cx="15" cy="19" r="1" />
                <circle cx="15" cy="12" r="1" />
                <circle cx="15" cy="5" r="1" />
              </svg>
              Drag to reorder
            </span>
          </div>

          <!-- Zona con scroll: header/topbar/stepper/footer quedan fijos y la
               lista crece dentro de la tarjeta sin romper el layout del wizard. -->
          <div class="card-scroll">
            <div class="floor-tree">
              <mapit-piso-list />
            </div>

            <!-- Formulario de alta/edición de planta -->
            <div class="floor-form-slot">
              <mapit-piso-form />
            </div>

            <!-- Add Floor Button (Bottom of Card) -->
            <button class="add-floor-btn" type="button" (click)="store.startNewFloor()">
              <span class="add-floor-icon" aria-hidden="true">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="5" />
                </svg>
              </span>
              <span class="add-floor-text">Agregar piso</span>
            </button>
          </div>
        </div>
      </main>

      <!-- Bottom Navigation -->
      <footer class="wizard-footer" role="contentinfo">
        <div class="footer-divider" aria-hidden="true"></div>
        <div class="footer-actions">
          <button class="btn-secondary" type="button" (click)="goBack()">
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
            Anterior
          </button>
          <button class="btn-primary" type="button" (click)="goNext()">
            Siguiente
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
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
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100dvh;
      font-family: var(--mapit-font-sans);

      /* ── Light Theme explícito del Setup Wizard (ver DESIGN.md).
         Los tokens se pisan en el host y heredan hacia los hijos del wizard
         (custom properties), sin tocar el tema global aunque el SO esté en dark. */
      color-scheme: light;
      --mapit-color-canvas: #f8fafc;
      --mapit-color-surface: #ffffff;
      --mapit-color-surface-low: #f1f5f9;
      --mapit-color-text: #0f172a;
      --mapit-color-text-variant: #64748b;
      --mapit-color-text-muted: #64748b;
      --mapit-color-border: #e2e8f0;
      --mapit-color-border-input: #cbd5e1;
      --mapit-color-primary: #2563eb;
      --mapit-color-primary-container: #eff6ff;
      --mapit-color-on-primary: #ffffff;
      --mapit-color-focus-ring: rgb(59 130 246 / 0.2);

      background: var(--mapit-color-canvas);
    }

    .wizard-layout {
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
    }

    /* ===== TOP BAR ===== */
    .wizard-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 64px;
      padding: 0 2rem;
      background: var(--mapit-color-surface);
      border-bottom: 1px solid var(--mapit-color-border);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .topbar-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .brand {
      font-size: 1.125rem;
      font-weight: 700;
      color: var(--mapit-color-primary);
      font-family: var(--mapit-font-display);
    }

    .divider {
      width: 1px;
      height: 20px;
      background: var(--mapit-color-border);
    }

    .wizard-title {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--mapit-color-text-variant);
    }

    .topbar-right {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .help-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: 1.5px solid var(--mapit-color-border);
      border-radius: 50%;
      background: transparent;
      color: var(--mapit-color-text-variant);
      font: inherit;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition:
        background 0.15s ease,
        color 0.15s ease;
    }

    .help-btn:hover {
      background: var(--mapit-color-surface-low);
      color: var(--mapit-color-text);
    }

    .exit-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.4rem 0.25rem;
      border: none;
      background: transparent;
      color: var(--mapit-color-text-variant);
      font: inherit;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: color 0.15s ease;
    }

    .exit-btn:hover {
      color: var(--mapit-color-text);
    }

    /* ===== STEPPER ===== */
    .wizard-stepper {
      padding: 1.5rem 2rem;
      background: var(--mapit-color-surface);
      border-bottom: 1px solid var(--mapit-color-border);
    }

    .steps {
      display: flex;
      align-items: flex-start;
      justify-content: center;
      gap: 0;
      max-width: 600px;
      margin: 0 auto;
    }

    .step {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      flex: 1;
      position: relative;
    }

    .step:not(:last-child) {
      padding-right: 0;
    }

    .step-circle {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 2px solid;
      font-size: 1rem;
      font-weight: 600;
      cursor: default;
      transition: all 0.2s ease;
    }

    .step.completed .step-circle {
      background: var(--mapit-color-primary);
      border-color: var(--mapit-color-primary);
      color: var(--mapit-color-on-primary);
    }

    .step.active .step-circle {
      background: var(--mapit-color-surface);
      border-color: var(--mapit-color-primary);
      color: var(--mapit-color-primary);
    }

    .step.pending .step-circle {
      background: var(--mapit-color-surface);
      border-color: var(--mapit-color-border);
      color: var(--mapit-color-text-muted);
    }

    .step-label {
      font-size: 0.75rem;
      font-weight: 500;
      text-align: center;
      max-width: 100px;
    }

    .step.completed .step-label {
      color: var(--mapit-color-text-muted);
    }

    .step.active .step-label {
      color: var(--mapit-color-primary);
      font-weight: 600;
    }

    .step.pending .step-label {
      color: var(--mapit-color-text-muted);
    }

    .step-divider {
      flex: 1;
      height: 2px;
      /* Alineada con el centro del círculo de 40px y separada de ambos pasos */
      margin: 19px 12px 0;
      position: relative;
    }

    .step-divider.completed {
      background: var(--mapit-color-primary);
    }

    .step-divider {
      background: var(--mapit-color-border);
    }

    /* ===== WIZARD HEADER ===== */
    .wizard-header {
      padding: 2rem;
      background: var(--mapit-color-surface);
      border-bottom: 1px solid var(--mapit-color-border);
    }

    .header-content {
      max-width: 720px;
      margin: 0 auto;
      text-align: center;
    }

    .page-title {
      margin: 0 0 0.75rem;
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--mapit-color-text);
      font-family: var(--mapit-font-display);
    }

    .page-description {
      margin: 0;
      font-size: 1rem;
      line-height: 1.6;
      color: var(--mapit-color-text-variant);
    }

    /* ===== MAIN CONTENT ===== */
    .wizard-main {
      flex: 1;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 2rem;
    }

    .central-card {
      width: 100%;
      max-width: 720px;
      background: var(--mapit-color-surface);
      border: 1px solid var(--mapit-color-border);
      border-radius: 16px;
      box-shadow: var(--mapit-shadow);
      overflow: hidden;
    }

    /*
     * Contenedor con scroll vertical limitado: con 3+ pisos la lista crece
     * AQUÍ dentro, mientras topbar, stepper, header y footer permanecen fijos.
     * El alto disponible se deriva del viewport restando las zonas fijas.
     */
    .card-scroll {
      max-height: calc(100dvh - 340px);
      overflow-y: auto;
      overflow-x: hidden;
      padding: 0 1.5rem 1.5rem;

      /* Scrollbar discreto (claro, 8px) */
      scrollbar-width: thin;
      scrollbar-color: #cbd5e1 transparent;
    }

    .card-scroll::-webkit-scrollbar {
      width: 8px;
    }

    .card-scroll::-webkit-scrollbar-track {
      background: transparent;
    }

    .card-scroll::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 9999px;
    }

    .card-scroll::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }

    @media (max-width: 900px) {
      .card-scroll {
        max-height: calc(100dvh - 300px);
      }
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.5rem;
      border-bottom: 1px solid var(--mapit-color-border);
    }

    .card-eyebrow {
      margin: 0 0 0.25rem;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--mapit-color-primary);
    }

    .card-title {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--mapit-color-text);
    }

    .drag-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.75rem;
      background: var(--mapit-color-surface-low);
      border-radius: 9999px;
      font-size: 0.6875rem;
      font-weight: 700;
      color: var(--mapit-color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .floor-tree {
      padding: 0;
    }

    .floor-form-slot {
      padding: 1.5rem;
      border-top: 1px solid var(--mapit-color-border);
    }

    .floor-form-slot mapit-piso-form ::ng-deep .form-card {
      border: none;
      padding: 0;
    }

    /* ===== ADD FLOOR BUTTON ===== */
    .add-floor-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      width: 100%;
      min-height: 100px;
      padding: 1.5rem;
      margin-top: 1rem;
      border: 2px dashed var(--mapit-color-border-input);
      border-radius: var(--mapit-radius-lg);
      background: var(--mapit-color-canvas);
      color: var(--mapit-color-text-variant);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .add-floor-btn:hover {
      border-color: var(--mapit-color-primary);
      background: var(--mapit-color-primary-container);
      color: var(--mapit-color-primary);
    }

    .add-floor-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--mapit-color-surface-low);
      color: var(--mapit-color-text-muted);
    }

    .add-floor-btn:hover .add-floor-icon {
      background: var(--mapit-color-primary);
      color: var(--mapit-color-on-primary);
    }

    .add-floor-text {
      font-size: 0.875rem;
      font-weight: 500;
    }

    /* ===== FOOTER ===== */
    .wizard-footer {
      background: var(--mapit-color-surface);
      border-top: 1px solid var(--mapit-color-border);
    }

    .footer-divider {
      height: 1px;
      background: var(--mapit-color-border);
    }

    .footer-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 2rem;
      max-width: 720px;
      margin: 0 auto;
    }

    .btn-secondary,
    .btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1.25rem;
      border-radius: var(--mapit-radius);
      font-size: 0.875rem;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-secondary {
      border: 1px solid var(--mapit-color-border);
      background: var(--mapit-color-surface);
      color: var(--mapit-color-text);
    }

    .btn-secondary:hover {
      background: var(--mapit-color-surface-low);
      border-color: var(--mapit-color-text-muted);
    }

    .btn-primary {
      border: none;
      background: var(--mapit-color-primary);
      color: var(--mapit-color-on-primary);
    }

    .btn-primary:hover {
      background: #1d4ed8;
    }

    @media (max-width: 640px) {
      .wizard-topbar {
        padding: 0 1rem;
      }
      .wizard-stepper {
        padding: 1rem;
      }
      .steps {
        gap: 0.5rem;
      }
      .step-label {
        font-size: 0.6875rem;
        max-width: 80px;
      }
      .step-circle {
        width: 32px;
        height: 32px;
        font-size: 0.875rem;
      }
      .step-divider {
        margin-top: 15px;
      }
      .wizard-header {
        padding: 1.5rem 1rem;
      }
      .page-title {
        font-size: 1.25rem;
      }
      .wizard-main {
        padding: 1rem;
      }
      .footer-actions {
        padding: 1rem;
        flex-direction: column-reverse;
        gap: 0.75rem;
      }
      .btn-secondary,
      .btn-primary {
        width: 100%;
        justify-content: center;
      }
    }
  `,
})
export class SpacesComponent {
  protected readonly store = inject(SpacesStore);
  protected readonly showSectorForm = signal(false);

  openHelp(): void {
    // TODO: Implement help modal
    console.warn('Help clicked');
  }

  exitWizard(): void {
    // TODO: Implement exit confirmation
    console.warn('Exit wizard clicked');
  }

  goBack(): void {
    // TODO: Navigate to step 1
    console.warn('Go back to step 1');
  }

  goNext(): void {
    // TODO: Navigate to step 3
    console.warn('Go next to step 3');
  }
}
