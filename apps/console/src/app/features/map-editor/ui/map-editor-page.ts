import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  Injector,
  NgZone,
  type OnDestroy,
  runInInjectionContext,
  ChangeDetectorRef,
  untracked,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { type MapEnginePort, MAP_ENGINE } from '@mapit/map-engine';
import { MapEditorStore } from '../model/map-editor-store';
import { STRINGS } from '../../../core/strings';

@Component({
  selector: 'mapit-map-editor-page',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="editor-page">
      <header class="editor-header">
        <div class="header-left">
          <button class="btn-icon" (click)="goBack()" aria-label="{{ strings.back }}">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <div class="sector-info">
            <h1 class="sector-name">{{ store.sectorName() }}</h1>
            <span class="sector-id">{{ store.sectorId() }}</span>
          </div>
        </div>
        <div class="header-center">
          @if (store.floors().length > 1) {
            <div class="floor-selector">
              <label for="floor-select" class="sr-only">{{ strings.selectFloor }}</label>
              <select
                id="floor-select"
                [value]="store.selectedFloorId()"
                (change)="onFloorChange($event)"
                class="floor-select"
                aria-label="{{ strings.selectFloor }}"
              >
                @for (floor of store.floors(); track floor.id) {
                  <option [value]="floor.id">{{ floor.name }}</option>
                }
              </select>
            </div>
          }
          @if (store.sectorsForSelectedFloor().length > 1) {
            <div class="sector-selector">
              <label for="sector-select" class="sr-only">{{ strings.selectSector }}</label>
              <select
                id="sector-select"
                [value]="store.sectorId()"
                (change)="onSectorChange($event)"
                class="sector-select"
                aria-label="{{ strings.selectSector }}"
              >
                @for (sector of store.sectorsForSelectedFloor(); track sector.id) {
                  <option [value]="sector.id">{{ sector.name }}</option>
                }
              </select>
            </div>
          }
        </div>
        <div class="header-right">
          @if (store.saving()) {
            <span class="saving-indicator" aria-live="polite">{{ strings.saving }}</span>
          }
          @if (store.error()) {
            <div class="error-toast" role="alert">
              {{ store.error() }}
              <button class="btn-icon" (click)="store.clearError()" aria-label="Cerrar">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          }
        </div>
      </header>

      <main class="editor-main">
        <aside class="editor-sidebar">
          <div class="sidebar-section">
            <h3>{{ strings.elements }}</h3>
            <ul class="element-list" role="listbox" aria-label="{{ strings.elements }}">
              @for (element of store.elements(); track element.id) {
                <li
                  class="element-item"
                  [class.selected]="isSelected(element.id)"
                  (click)="selectElement(element.id)"
                  (keyup.enter)="selectElement(element.id)"
                  (keydown.space)="selectElement(element.id)"
                  role="option"
                  [attr.aria-selected]="isSelected(element.id)"
                  tabindex="0"
                >
                  <span class="element-type" [attr.data-type]="element.type">{{
                    element.type
                  }}</span>
                  <span class="element-label">{{ element.label }}</span>
                  <span class="element-pos"
                    >({{ Math.round(element.position.x) }},
                    {{ Math.round(element.position.y) }})</span
                  >
                </li>
              } @empty {
                <li class="empty-state">{{ strings.noElements }}</li>
              }
            </ul>
          </div>

          <div class="sidebar-section">
            <h3>{{ strings.properties }}</h3>
            @if (selectedElement(); as el) {
              <dl class="properties">
                <div class="prop-row">
                  <dt>{{ strings.type }}</dt>
                  <dd>{{ el.type }}</dd>
                </div>
                <div class="prop-row">
                  <dt>{{ strings.position }}</dt>
                  <dd>
                    {{ Math.round(store.selectedElementPosition()?.x ?? el.position.x) }},
                    {{ Math.round(store.selectedElementPosition()?.y ?? el.position.y) }}
                  </dd>
                </div>
                <div class="prop-row">
                  <dt>{{ strings.rotation }}</dt>
                  <dd>{{ el.rotation }}°</dd>
                </div>
                <div class="prop-row">
                  <dt>{{ strings.size }}</dt>
                  <dd>{{ Math.round(el.size.width) }} × {{ Math.round(el.size.height) }}</dd>
                </div>
                <div class="prop-row">
                  <dt>{{ strings.state }}</dt>
                  <dd>
                    <span class="state-badge" [attr.data-state]="el.state">{{ el.state }}</span>
                  </dd>
                </div>
                <div class="prop-row">
                  <dt>{{ strings.capacity }}</dt>
                  <dd>{{ el.capacity ?? strings.notReservable }}</dd>
                </div>
              </dl>
            } @else {
              <p class="no-selection">{{ strings.selectElement }}</p>
            }
          </div>
        </aside>

        <div class="canvas-container" #canvasContainer>
          <div #canvasHost class="canvas-host"></div>
        </div>
      </main>
    </div>
  `,
  styles: `
    .editor-page {
      display: grid;
      grid-template-rows: auto 1fr;
      height: 100dvh;
      background: var(--mapit-color-canvas);
      color: var(--mapit-color-text);
      font-family: var(--mapit-font-sans);
    }

    .editor-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.75rem 1rem;
      background: var(--mapit-color-surface);
      border-bottom: 1px solid var(--mapit-color-border);
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
      min-width: 0;
    }

    .btn-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      border: none;
      background: transparent;
      color: var(--mapit-color-text);
      border-radius: 0.5rem;
      cursor: pointer;
      transition: background 150ms ease;
    }

    .btn-icon:hover {
      background: var(--mapit-color-surface-low);
    }

    .btn-icon:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--mapit-color-focus-ring);
    }

    .sector-info {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .sector-name {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .sector-id {
      font-size: 0.75rem;
      color: var(--mapit-color-text-muted);
      font-family: ui-monospace, monospace;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .saving-indicator {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.8125rem;
      color: var(--mapit-color-primary);
      animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.5;
      }
    }

    .error-toast {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.5rem 0.75rem;
      background: var(--mapit-color-error-bg);
      color: var(--mapit-color-error);
      border: 1px solid var(--mapit-color-error-border);
      border-radius: 0.5rem;
      font-size: 0.8125rem;
      max-width: 20rem;
      animation: slideIn 200ms ease-out;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .header-center {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex: 1;
      justify-content: center;
    }

    .floor-selector,
    .sector-selector {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .floor-select label,
    .sector-select label {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--mapit-color-text-muted);
      white-space: nowrap;
    }

    .floor-select,
    .sector-select {
      min-width: 180px;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--mapit-color-border);
      border-radius: 0.5rem;
      background: var(--mapit-color-surface);
      color: var(--mapit-color-text);
      font: inherit;
      font-size: 0.875rem;
      cursor: pointer;
      transition:
        border-color 150ms ease,
        box-shadow 150ms ease;
    }

    .floor-select:hover,
    .sector-select:hover {
      border-color: var(--mapit-color-primary);
    }

    .floor-select:focus-visible,
    .sector-select:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--mapit-color-focus-ring);
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .editor-main {
      display: grid;
      grid-template-columns: 280px 1fr;
      min-height: 0;
    }

    .editor-sidebar {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1rem;
      background: var(--mapit-color-surface);
      border-right: 1px solid var(--mapit-color-border);
      overflow-y: auto;
      min-height: 0;
    }

    .sidebar-section h3 {
      margin: 0 0 0.5rem;
      font-size: 0.8125rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--mapit-color-text-muted);
    }

    .element-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .element-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem;
      background: var(--mapit-color-surface-low);
      border: 1px solid transparent;
      border-radius: 0.375rem;
      cursor: pointer;
      transition: all 150ms ease;
    }

    .element-item:hover {
      border-color: var(--mapit-color-border);
    }

    .element-item.selected {
      border-color: var(--mapit-color-primary);
      background: var(--mapit-color-primary-bg);
    }

    .element-type {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 0.25rem;
      font-size: 0.625rem;
      font-weight: 700;
      text-transform: uppercase;
      background: var(--mapit-color-primary);
      color: var(--mapit-color-on-primary);
    }

    .element-label {
      flex: 1;
      font-size: 0.8125rem;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .element-pos {
      font-size: 0.6875rem;
      color: var(--mapit-color-text-muted);
      font-family: ui-monospace, monospace;
    }

    .empty-state {
      padding: 1rem;
      text-align: center;
      color: var(--mapit-color-text-muted);
      font-size: 0.8125rem;
    }

    .properties {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.375rem 0.75rem;
      margin: 0;
      font-size: 0.8125rem;
    }

    .prop-row dt {
      color: var(--mapit-color-text-muted);
      font-weight: 500;
    }

    .prop-row dd {
      margin: 0;
      font-weight: 600;
    }

    .state-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.125rem 0.5rem;
      border-radius: 9999px;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .state-badge[data-state='AVAILABLE'] {
      background: #dcfce7;
      color: #166534;
    }
    .state-badge[data-state='OCCUPIED'] {
      background: #fee2e2;
      color: #991b1b;
    }
    .state-badge[data-state='RESERVED'] {
      background: #fef3c7;
      color: #92400e;
    }
    .state-badge[data-state='CLEANING'] {
      background: #dbeafe;
      color: #1e40af;
    }
    .state-badge[data-state='OUT_OF_SERVICE'] {
      background: #f3f4f6;
      color: #374151;
    }

    .no-selection {
      margin: 0;
      color: var(--mapit-color-text-muted);
      font-size: 0.8125rem;
      font-style: italic;
    }

    .canvas-container {
      position: relative;
      overflow: hidden;
      background: var(--mapit-color-canvas);
    }

    .canvas-host {
      width: 100%;
      height: 100%;
      min-height: 100%;
    }

    @media (max-width: 64rem) {
      .editor-main {
        grid-template-columns: 1fr;
        grid-template-rows: auto 1fr;
      }
      .editor-sidebar {
        flex-direction: row;
        flex-wrap: wrap;
        border-right: none;
        border-bottom: 1px solid var(--mapit-color-border);
      }
      .sidebar-section {
        flex: 1;
        min-width: 200px;
      }
    }
  `,
})
export class MapEditorPageComponent implements OnDestroy {
  protected readonly canvasHost = viewChild.required<ElementRef<HTMLDivElement>>('canvasHost');

  protected readonly store = inject(MapEditorStore);
  private readonly port = inject<MapEnginePort>(MAP_ENGINE);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  protected readonly strings = STRINGS.spaces.editor;
  protected readonly Math = Math;

  // Flag para garantizar montaje inicial infalible
  private isCanvasMounted = false;

  // Use store's selection state (selectedId, selectedElement are signals/computed in store)
  readonly selectedElement = this.store.selectedElement;
  readonly selectedElementId = this.store.selectedId;

  // sectorId as signal from route params
  readonly sectorId = toSignal(this.route.paramMap.pipe(map((params) => params.get('sectorId'))), {
    initialValue: null,
  });

  // sectorName as signal from query params
  readonly sectorName = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('sectorName') || undefined)),
    { initialValue: undefined },
  );

  // floorId as signal from query params
  readonly floorId = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('floorId') || undefined)),
    { initialValue: undefined },
  );

  // establishmentId as signal from query params
  readonly establishmentId = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('establishmentId') || undefined)),
    { initialValue: undefined },
  );

  // Initialize layout sync effect in injection context (constructor)
  private readonly layoutSyncEffect = runInInjectionContext(this.injector, () =>
    effect(() => {
      const layout = this.store.layout();
      if (!this.port || !this.canvasHost()?.nativeElement) return;

      untracked(() => {
        // Chequeo booleano infalible
        if (!this.isCanvasMounted) {
          this.port.mount(this.canvasHost().nativeElement, layout);
          this.isCanvasMounted = true;
        } else {
          this.port.load(layout);
        }
      });
    }),
  );

  // Load floors when establishmentId changes
  private readonly floorsLoadEffect = runInInjectionContext(this.injector, () =>
    effect(() => {
      const establishmentId = this.establishmentId();
      if (establishmentId) {
        this.store.loadFloorsByEstablishment(establishmentId);
      }
    }),
  );

  // Load sectors when floorId changes
  private readonly sectorsLoadEffect = runInInjectionContext(this.injector, () =>
    effect(() => {
      const floorId = this.floorId();
      if (floorId) {
        this.store.loadSectorsByFloor(floorId);
      }
    }),
  );

  // React to sectorId/sectorName changes
  private readonly sectorLoadEffect = runInInjectionContext(this.injector, () =>
    effect(() => {
      const id = this.sectorId();
      const name = this.sectorName();
      if (id) {
        // untracked previene el bucle infinito de dependencias
        untracked(() => this.store.loadSector(id, name));
      }
    }),
  );

  // Port event handlers (one-time setup, protected from signal changes)
  private readonly portEventsEffect = runInInjectionContext(this.injector, () =>
    effect(() => {
      untracked(() => {
        this.port.onDragStart((_id) => {
          // No longer needed - drag state managed via activeDragCoords signal
        });

        this.port.onDragEnd((payload) => {
          this.store.dragElement(payload.id, payload.x, payload.y);
        });

        this.port.onDragMove((payload) => {
          this.ngZone.run(() => {
            this.store.updateElementPositionLocal(payload.id, payload.x, payload.y);
            this.cdr.markForCheck();
          });
        });

        this.port.onRotateEnd((payload) => {
          this.store.rotateElement(payload.id, payload.rotation);
        });

        this.port.onResizeEnd((payload) => {
          this.store.resizeElement(payload.id, payload.width, payload.height);
        });

        this.port.onElementClick((payload) => {
          this.store.selectElement(payload.id);
        });
      });
    }),
  );

  ngOnDestroy(): void {
    this.port.destroy();
  }

  protected goBack(): void {
    window.history.back();
  }

  protected onSectorChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const sectorId = target.value;
    if (sectorId) {
      const sector = this.store.sectors().find((s) => s.id === sectorId);
      void this.router.navigate(['/spaces/editor', sectorId], {
        queryParams: { sectorName: sector?.name },
      });
    }
  }

  protected onFloorChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const floorId = target.value;
    if (floorId) {
      this.store.selectFloor(floorId);
    }
  }

  protected selectElement(id: string): void {
    this.store.selectElement(id);
    this.port.layout(); // trigger selection in port if needed
  }

  protected isSelected(id: string): boolean {
    return this.store.selectedId() === id;
  }
}
