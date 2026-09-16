import { CdkDrag, type CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FeatureFlagService } from '@mapit/feature-flags';
import { SpacesStore } from '../model/spaces-store';
import { SectorFormComponent } from './sector-form';

/** Lista de sectores dentro de un piso (CU-05 · MAP-70). */
@Component({
  selector: 'mapit-sector-list',
  imports: [SectorFormComponent, CdkDropList, CdkDrag, CdkDragHandle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (flags.isEnabled('spaces.sectors')()) {
      <div class="sectors-container">
        <!-- Vertical connector from parent floor icon -->
        <div class="parent-connector"></div>

        @if (loading()) {
          <div class="loading-state">{{ store.strings_.sectors.loading }}</div>
        } @else if (sectors().length === 0 && !showForm()) {
          <div class="empty-state">{{ store.strings_.sectors.empty }}</div>
        }

        <!-- Sectores reordenables (drag & drop) -->
        <div cdkDropList (cdkDropListDropped)="onSectorDropped($event)">
          @for (sector of sectors(); track sector.id; let i = $index; let last = $last) {
            <div
              class="sector-node"
              [class.last]="last"
              role="treeitem"
              aria-level="2"
              aria-selected="false"
              cdkDrag
            >
              <!-- Horizontal connector from vertical line to sector -->
              <div class="horizontal-connector" [class.last]="last"></div>

              <!-- Sector Row -->
              <div class="sector-row">
                <button
                  class="drag-handle"
                  type="button"
                  aria-label="Arrastrar para reordenar sector"
                  cdkDragHandle
                >
                  <svg
                    width="16"
                    height="16"
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
                </button>

                <!-- Sector Icon -->
                <div
                  class="sector-icon"
                  [class.icon-restaurant]="isRestaurantSector(sector.name)"
                  [class.icon-terrace]="isTerraceSector(sector.name)"
                >
                  @if (isRestaurantSector(sector.name)) {
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
                  } @else if (isTerraceSector(sector.name)) {
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      aria-hidden="true"
                    >
                      <path d="M12 2v20" />
                      <path d="M2 12h20" />
                      <path d="M8 5c0-1.5 1.5-2 2-2s2 0.5 2 2" />
                      <path d="M14 17c0 1.5 1.5 2 2 2s2-0.5 2-2" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  } @else {
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                  }
                </div>

                <div class="sector-name">{{ sector.name }}</div>

                <div class="sector-actions">
                  <button
                    class="action-btn edit"
                    type="button"
                    [disabled]="store.saving()"
                    (click)="store.editSector(sector); $event.stopPropagation()"
                    aria-label="Editar {{ sector.name }}"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      aria-hidden="true"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    class="action-btn delete"
                    type="button"
                    [disabled]="store.saving()"
                    (click)="store.removeSector(sector.id); $event.stopPropagation()"
                    aria-label="Eliminar {{ sector.name }}"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      aria-hidden="true"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path
                        d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          }
        </div>

        <!-- Add Sector Button -->
        <div class="add-sector-node" role="treeitem" aria-level="2" aria-selected="false">
          <div class="horizontal-connector last"></div>
          <button class="add-sector-btn" type="button" (click)="toggleForm()">
            <span class="add-sector-icon" aria-hidden="true">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </span>
            <span class="add-sector-text">Agregar Sector</span>
          </button>
        </div>

        <!-- Inline Sector Form -->
        @if (showForm()) {
          <mapit-sector-form
            [floorId]="floorId()"
            (saved)="onSectorSaved()"
            (formClosed)="onFormCancelled()"
          />
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .sectors-container {
      position: relative;
      margin-left: 20px; /* Align with floor icon center */
      padding-left: 28px; /* Space for horizontal connectors (28px from vertical line) */
    }

    /* Vertical connector from parent floor */
    .parent-connector {
      position: absolute;
      left: 0;
      top: -8px; /* Extend slightly above first sector */
      bottom: 0;
      width: 2px;
      background: var(--mapit-color-border);
    }

    .sector-node {
      position: relative;
      margin-bottom: 0.25rem;
    }

    .add-sector-node {
      position: relative;
    }

    /* Horizontal connectors */
    .horizontal-connector {
      position: absolute;
      left: -28px;
      top: 50%;
      width: 28px;
      height: 2px;
      background: var(--mapit-color-border);
      transform: translateY(-50%);
    }

    .horizontal-connector.last {
      width: 16px; /* Shorter for last item */
    }

    /* Sector Row */
    .sector-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 0.75rem;
      background: var(--mapit-color-canvas);
      border: 1px solid var(--mapit-color-border);
      border-radius: var(--mapit-radius);
      transition: all 0.15s ease;
    }

    .sector-row:hover {
      background: var(--mapit-color-surface);
      border-color: var(--mapit-color-primary);
    }

    .drag-handle {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border: none;
      background: transparent;
      color: var(--mapit-color-text-muted);
      cursor: grab;
      border-radius: var(--mapit-radius-input);
      flex-shrink: 0;
      transition:
        color 0.15s ease,
        background 0.15s ease;
    }

    .drag-handle:hover {
      color: var(--mapit-color-text);
      background: var(--mapit-color-surface-low);
    }

    .drag-handle:active {
      cursor: grabbing;
    }

    .sector-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: var(--mapit-radius-input);
      background: var(--mapit-color-surface);
      color: var(--mapit-color-primary);
      flex-shrink: 0;
    }

    .sector-icon.icon-restaurant {
      color: var(--mapit-color-primary);
    }

    .sector-icon.icon-terrace {
      color: #f59e0b; /* Amber for terrace */
    }

    .sector-name {
      flex: 1;
      min-width: 0;
      font-size: 0.875rem;
      color: var(--mapit-color-text-variant);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .sector-actions {
      display: flex;
      gap: 0.125rem;
      opacity: 0;
      transition: opacity 0.15s ease;
    }

    .sector-row:hover .sector-actions {
      opacity: 1;
    }

    .action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border: none;
      background: transparent;
      color: var(--mapit-color-text-muted);
      border-radius: var(--mapit-radius-input);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .action-btn:hover {
      color: var(--mapit-color-text);
      background: var(--mapit-color-surface-low);
    }

    .action-btn.edit:hover {
      color: var(--mapit-color-primary);
      background: var(--mapit-color-primary-container);
    }

    .action-btn.delete:hover {
      color: var(--mapit-color-error);
      background: #fef2f2;
    }

    .action-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Add Sector Button */
    .add-sector-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      padding: 0.625rem 0.75rem;
      border: 1px dashed var(--mapit-color-primary);
      border-radius: var(--mapit-radius);
      background: var(--mapit-color-surface);
      color: var(--mapit-color-primary);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .add-sector-btn:hover {
      background: var(--mapit-color-primary-container);
      border-color: var(--mapit-color-primary);
    }

    .add-sector-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      color: var(--mapit-color-primary);
    }

    .add-sector-text {
      font-size: 0.875rem;
      font-weight: 500;
    }

    /* Drag & drop (CDK) */
    .cdk-drag-placeholder {
      opacity: 0.4;
    }

    .cdk-drag-preview {
      box-sizing: border-box;
      background: var(--mapit-color-surface);
      border-radius: var(--mapit-radius);
      box-shadow: 0 4px 12px rgb(0 0 0 / 15%);
    }

    .cdk-drag-animating {
      transition: transform 0.2s ease;
    }

    .loading-state,
    .empty-state {
      padding: 1.5rem 0.75rem;
      text-align: center;
      color: var(--mapit-color-text-muted);
      font-size: 0.8125rem;
    }
  `,
})
export class SectorListComponent {
  readonly floorId = input.required<string>();
  readonly floorName = input.required<string>();

  protected readonly store = inject(SpacesStore);
  protected readonly flags = inject(FeatureFlagService);
  protected readonly showForm = signal(false);

  protected readonly sectors = computed(() => this.store.sectorsByFloorId(this.floorId()));
  protected readonly loading = computed(() => this.store.sectorsLoading(this.floorId()));

  constructor() {
    // Carga inicial: sin esto, los sectores existentes solo aparecían al abrir
    // el formulario, y la lista daba la impresión de no renderizar nada.
    effect(() => this.store.loadSectorsByFloor(this.floorId()));
  }

  protected onSectorDropped(event: CdkDragDrop<unknown>): void {
    this.store.reorderSectors(this.floorId(), event.previousIndex, event.currentIndex);
  }

  protected isRestaurantSector(name: string): boolean {
    const n = name.toLowerCase();
    return (
      n.includes('salón') || n.includes('restaurant') || n.includes('comedor') || n.includes('mesa')
    );
  }

  protected isTerraceSector(name: string): boolean {
    const n = name.toLowerCase();
    return (
      n.includes('terraza') || n.includes('exterior') || n.includes('patio') || n.includes('jardín')
    );
  }

  protected toggleForm(): void {
    this.showForm.set(true);
  }

  protected onSectorSaved(): void {
    this.showForm.set(false);
  }

  protected onFormCancelled(): void {
    this.showForm.set(false);
  }
}
