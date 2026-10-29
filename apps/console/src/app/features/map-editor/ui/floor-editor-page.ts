import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  effect,
  inject,
  Injector,
  NgZone,
  type OnDestroy,
  runInInjectionContext,
  untracked,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { type MapEnginePort, MAP_ENGINE } from '@mapit/map-engine';

import { FloorEditorStore } from '../model/floor-editor-store';
import { localizeString, STRINGS } from '../../../core/strings';

/**
 * Vista de planta (HU-4.01, F1): composición de sectores sobre el lienzo del piso.
 *
 * <p>El canvas es de solo colocación (mover/rotar sectores, D-3): los elementos
 * internos se ven pero no se editan aquí; "Editar sector" navega a la vista de
 * sector (`/spaces/editor/:sectorId`). La biblioteca duplica sectores del
 * establecimiento hacia esta planta (RN-5) vía drag & drop o clic.
 */
@Component({
  selector: 'mapit-floor-editor-page',
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
          <h1 class="floor-name">{{ store.floorName() }}</h1>
        </div>
        <div class="header-right">
          <button
            class="btn-primary"
            (click)="store.saveLayout()"
            [disabled]="!store.dirty() || store.saving()"
          >
            {{ store.saving() ? strings.saving : strings.saveLayout }}
          </button>
          @if (store.conflictingIds().length > 0) {
            <button class="btn-icon" (click)="store.discardAndReload()">
              {{ strings.reload }}
            </button>
          }
          @if (store.error()) {
            <div class="error-toast" role="alert">
              {{ localizeString(store.error() ?? '') }}
              <button class="btn-icon" (click)="store.clearError()">✕</button>
            </div>
          }
        </div>
      </header>

      <main class="editor-main">
        <aside class="editor-sidebar">
          <div class="sidebar-section">
            <h3>{{ strings.libraryTitle }}</h3>
            <p class="hint">{{ strings.libraryHint }}</p>
            @if (store.librarySectors().length === 0) {
              <p class="empty-state">{{ strings.libraryEmpty }}</p>
            }
            <ul class="library" role="listbox" aria-label="{{ strings.libraryTitle }}">
              @for (sector of store.librarySectors(); track sector.id) {
                <li
                  class="library-item"
                  tabindex="0"
                  role="option"
                  data-testid="library-sector"
                  [attr.data-sector-id]="sector.id"
                  [attr.aria-selected]="false"
                  draggable="true"
                  (dragstart)="onLibraryDragStart($event, sector.id)"
                  (keydown.enter)="store.duplicateSector(sector.id)"
                >
                  <span class="library-label">{{ sector.name }}</span>
                </li>
              }
            </ul>
          </div>
        </aside>

        <div class="canvas-container" #canvasHost data-testid="floor-editor-canvas"></div>
      </main>

      @if (store.selectedSectorId(); as selectedId) {
        <footer class="editor-footer">
          <button class="btn-primary" data-testid="edit-sector" (click)="editSelected(selectedId)">
            {{ strings.editSector }}
          </button>
        </footer>
      }
    </div>
  `,
  styles: `
    .editor-page {
      display: flex;
      flex-direction: column;
      height: 100dvh;
    }
    .editor-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--mapit-color-border);
      background: var(--mapit-color-surface);
    }
    .floor-name {
      margin: 0;
      font-size: 1rem;
    }
    .editor-main {
      display: grid;
      grid-template-columns: 260px 1fr;
      flex: 1;
      min-height: 0;
    }
    .editor-sidebar {
      border-right: 1px solid var(--mapit-color-border);
      padding: 1rem;
      overflow-y: auto;
      background: var(--mapit-color-surface);
    }
    .library {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .library-item {
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--mapit-color-border);
      border-radius: 0.5rem;
      cursor: grab;
      background: var(--mapit-color-surface-low);
    }
    .library-item:hover {
      border-color: var(--mapit-color-primary);
      background: var(--mapit-color-nav-active-bg);
    }
    .library-item:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--mapit-color-focus-ring);
    }
    .library-item.selected {
      border-color: var(--mapit-color-primary);
    }
    .canvas-container {
      position: relative;
      overflow: auto;
      background: var(--mapit-color-canvas);
    }
    .canvas-host {
      width: 100%;
      height: 100%;
    }
    .editor-footer {
      padding: 0.75rem 1rem;
      border-top: 1px solid var(--mapit-color-border);
      background: var(--mapit-color-surface);
      display: flex;
      justify-content: flex-end;
    }
    .btn-icon {
      border: none;
      background: transparent;
      cursor: pointer;
    }
    .btn-primary {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 0.5rem;
      background: var(--mapit-color-primary);
      color: var(--mapit-color-on-primary);
      cursor: pointer;
    }
    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .error-toast {
      display: inline-flex;
      gap: 0.5rem;
      align-items: center;
      padding: 0.5rem;
      color: var(--mapit-color-error);
      background: var(--mapit-color-error-bg);
      border-radius: 0.5rem;
    }
    .hint {
      font-size: 0.8125rem;
      color: var(--mapit-color-text-muted);
    }
    .empty-state {
      color: var(--mapit-color-text-muted);
      font-style: italic;
    }
  `,
})
export class FloorEditorPageComponent implements OnDestroy {
  protected readonly localizeString = localizeString;
  protected readonly canvasHost = viewChild.required<ElementRef<HTMLDivElement>>('canvasHost');
  protected readonly store = inject(FloorEditorStore);
  protected readonly strings = STRINGS.spaces.floorEditor;

  private readonly port = inject<MapEnginePort>(MAP_ENGINE);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);

  private isCanvasMounted = false;

  readonly floorId = toSignal(this.route.paramMap.pipe(map((p) => p.get('floorId'))), {
    initialValue: null,
  });

  /** Establecimiento para la biblioteca de sectores duplicables (llega por query). */
  readonly establishmentId = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('establishmentId'))),
    { initialValue: null },
  );

  constructor() {
    runInInjectionContext(this.injector, () => {
      effect(() => {
        const id = this.floorId();
        if (id) untracked(() => this.store.loadFloor(id));
      });

      effect(() => {
        const estId = this.establishmentId();
        if (estId) untracked(() => this.store.loadLibrary(estId));
      });

      effect(() => {
        const layout = this.store.layout();
        const host = this.canvasHost()?.nativeElement;
        if (!host) return;
        untracked(() => {
          if (!this.isCanvasMounted) {
            this.port.mount(host, layout);
            this.isCanvasMounted = true;
          } else {
            this.port.load(layout);
          }
        });
      });

      effect(() => {
        untracked(() => {
          this.port.onSectorDragEnd?.((p) =>
            this.ngZone.run(() => {
              this.store.moveSector(p.id, p.x, p.y);
              this.cdr.markForCheck();
            }),
          );
          this.port.onSectorRotateEnd?.((p) =>
            this.ngZone.run(() => {
              this.store.rotateSector(p.id, p.rotation);
              this.cdr.markForCheck();
            }),
          );
          this.port.onSectorClick?.((p) => this.ngZone.run(() => this.store.selectSector(p.id)));
          this.port.onExternalDrop?.(({ key, x, y }) =>
            this.ngZone.run(() => {
              if (key.startsWith('sector:')) {
                this.store.duplicateSector(key.slice('sector:'.length), x, y);
              }
            }),
          );
        });
      });
    });
  }

  ngOnDestroy(): void {
    this.port.destroy();
  }

  protected goBack(): void {
    window.history.back();
  }

  protected onLibraryDragStart(event: DragEvent, sectorId: string): void {
    event.dataTransfer?.setData('text/plain', `sector:${sectorId}`);
    event.dataTransfer?.setData('text', `sector:${sectorId}`);
  }

  protected editSelected(sectorId: string): void {
    const floorId = this.floorId();
    void this.router.navigate(['/spaces/editor', sectorId], {
      queryParams: floorId ? { floorId } : {},
    });
  }
}
