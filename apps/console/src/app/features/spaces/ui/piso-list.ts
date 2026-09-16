import { CdkDrag, type CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FeatureFlagService } from '@mapit/feature-flags';
import { SpacesStore } from '../model/spaces-store';
import { SectorListComponent } from './sector-list';

/** Lista de pisos como árbol visual con sectores (CU-05 · MAP-69/70). */
@Component({
  selector: 'mapit-piso-list',
  imports: [SectorListComponent, CdkDropList, CdkDrag, CdkDragHandle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (flags.isEnabled('spaces.floors')()) {
      @if (store.error(); as error) {
        <div class="error-banner" role="alert">{{ error }}</div>
      }

      @if (store.loading()) {
        <div class="loading-state">{{ store.strings_.floors.loading }}</div>
      } @else if (store.floors().length === 0) {
        <div class="empty-state">{{ store.strings_.floors.empty }}</div>
      } @else {
        <ul
          class="floor-tree"
          role="tree"
          aria-label="Pisos y sectores"
          cdkDropList
          (cdkDropListDropped)="onFloorDropped($event)"
        >
          @for (floor of store.floors(); track floor.id; let i = $index; let last = $last) {
            <li
              class="floor-node"
              [class.last]="last"
              role="treeitem"
              aria-level="1"
              aria-selected="false"
              cdkDrag
            >
              <!-- Vertical connector line (runs through floor icon center) -->
              <div class="vertical-connector" [class.last]="last"></div>

              <!-- Floor Row -->
              <div class="floor-row">
                <!-- Drag Handle -->
                <button
                  class="drag-handle"
                  type="button"
                  aria-label="Arrastrar para reordenar piso"
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

                <!-- Icon Box: 40x40, blue bg, layers icon -->
                <div class="floor-icon-box">
                  <svg
                    width="20"
                    height="20"
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
                </div>

                <!-- Floor Name -->
                <div class="floor-name">{{ floor.name }}</div>

                <!-- Actions: Edit / Delete -->
                <div class="floor-actions">
                  <button
                    class="action-btn edit"
                    type="button"
                    [disabled]="store.saving()"
                    (click)="store.editFloor(floor); $event.stopPropagation()"
                    aria-label="Editar {{ floor.name }}"
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
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    class="action-btn delete"
                    type="button"
                    [disabled]="store.saving()"
                    (click)="store.removeFloor(floor.id); $event.stopPropagation()"
                    aria-label="Eliminar {{ floor.name }}"
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
                      <polyline points="3 6 5 6 21 6" />
                      <path
                        d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Sectors List (Children) -->
              <mapit-sector-list [floorId]="floor.id" [floorName]="floor.name" />
            </li>
          }
        </ul>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .error-banner {
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
      border-radius: var(--mapit-radius);
      background: #fef2f2;
      color: var(--mapit-color-error);
      font-size: 0.875rem;
    }

    .loading-state,
    .empty-state {
      padding: 3rem 1.5rem;
      text-align: center;
      color: var(--mapit-color-text-muted);
      font-size: 0.875rem;
    }

    /* ===== FLOOR TREE ===== */
    .floor-tree {
      list-style: none;
      margin: 0;
      padding: 0;
      position: relative;
    }

    /* Vertical connector line running through floor icon centers */
    .floor-node {
      position: relative;
      padding-left: 20px; /* Aligns with center of 40px icon box */
    }

    .vertical-connector {
      position: absolute;
      left: 20px; /* Center of 40px icon box = 20px from left edge of node */
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--mapit-color-border);
      z-index: 0;
    }

    .floor-node.last .vertical-connector {
      display: none; /* No line after last floor */
    }

    /* Floor Row */
    .floor-row {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem 0 0.75rem 20px; /* 20px left padding to align with connector */
      background: var(--mapit-color-surface);
      border: 1px solid var(--mapit-color-border);
      border-radius: var(--mapit-radius);
      position: relative;
      z-index: 1;
      transition:
        background 0.15s ease,
        border-color 0.15s ease;
    }

    .floor-row:hover {
      background: var(--mapit-color-surface-low);
      border-color: var(--mapit-color-primary);
    }

    .drag-handle {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
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

    .floor-icon-box {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: var(--mapit-radius);
      background: var(--mapit-color-primary-container);
      color: var(--mapit-color-primary);
      flex-shrink: 0;
    }

    .floor-name {
      flex: 1;
      min-width: 0;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--mapit-color-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .floor-actions {
      display: flex;
      gap: 0.25rem;
      opacity: 0;
      transition: opacity 0.15s ease;
    }

    .floor-row:hover .floor-actions {
      opacity: 1;
    }

    .action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
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

    /* ===== DRAG & DROP (CDK) ===== */
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

    /* ===== SECTORS CONTAINER ===== */
    /* The sector-list component handles its own indentation and connectors */
    ::ng-deep mapit-sector-list {
      display: block;
      margin-top: 0.25rem;
    }
  `,
})
export class PisoListComponent {
  protected readonly store = inject(SpacesStore);
  protected readonly flags = inject(FeatureFlagService);

  protected onFloorDropped(event: CdkDragDrop<unknown>): void {
    this.store.reorderFloors(event.previousIndex, event.currentIndex);
  }
}
