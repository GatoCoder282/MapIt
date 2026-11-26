import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import {
  LucideChevronRight,
  LucideEllipsis,
  LucideLayers,
  LucidePieChart,
  LucidePlus,
  LucideSlidersHorizontal,
} from '@lucide/angular';
import { FeatureFlagService } from '@mapit/feature-flags';
import type { Floor, Sector } from '@mapit/api-client';
import { EstablishmentContext } from '../establishment-context';
import { confirmOperationalExit } from '../operational-exit-guard';
import { localizeString, STRINGS } from '../strings';
import { StructureEditorContext } from '../structure-editor-context';
import { SpacesStore } from './spaces-store';
import { PisoFormComponent } from './piso-form';
import { SectorFormComponent } from './sector-form';

export interface FloorZoneEntry {
  id: string;
  sectorId: string;
  label: string;
}

@Component({
  selector: 'mapit-establishment-structure',
  imports: [
    LucideChevronRight,
    LucideEllipsis,
    LucideLayers,
    LucidePieChart,
    LucidePlus,
    LucideSlidersHorizontal,
    RouterOutlet,
    PisoFormComponent,
    SectorFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:beforeunload)': 'beforeUnload($event)' },
  template: `
    <div
      class="workspace"
      [class.embedded]="embedded()"
      [class.onboarding]="
        embedded() &&
        establishment() &&
        !store.loading() &&
        !store.error() &&
        !store.floors().length &&
        !floorForm()
      "
    >
      <aside [attr.aria-label]="strings.editor.workspace.structure">
        <header>
          <span class="icon-tile"><svg lucideLayers aria-hidden="true"></svg></span>
          <div>
            <h2>{{ strings.editor.workspace.structure }}</h2>
            <p>
              {{
                embedded()
                  ? strings.editor.workspace.structureZonesSubtitle
                  : strings.editor.workspace.structureSubtitle
              }}
            </p>
          </div>
        </header>
        <div class="tabs" role="group" [attr.aria-label]="strings.editor.workspace.structure">
          <button type="button" [attr.aria-pressed]="!ordering()" (click)="ordering.set(false)">
            <svg lucideLayers aria-hidden="true"></svg
            >{{
              embedded()
                ? strings.editor.workspace.floorsAndZones
                : strings.editor.workspace.floorsAndSectors
            }}
          </button>
          <button type="button" [attr.aria-pressed]="ordering()" (click)="ordering.set(true)">
            <svg lucideSlidersHorizontal aria-hidden="true"></svg
            >{{ strings.editor.workspace.order }}
          </button>
        </div>
        @if (store.error(); as error) {
          @if (!floorForm() && !sectorForm()) {
            <p class="feedback" role="alert">{{ localize(error) }}</p>
          }
        }
        @if (store.loading()) {
          <p class="feedback" role="status">{{ strings.floors.loading }}</p>
        } @else if (establishment() && !store.floors().length) {
          @if (embedded() && !store.error() && !floorForm()) {
            <div class="first-floor-empty">
              <span class="empty-layers" aria-hidden="true"><svg lucideLayers></svg></span>
              <h3>{{ strings.editor.workspace.firstFloorEmptyTitle }}</h3>
              <p>{{ strings.editor.workspace.firstFloorEmptyHelp }}</p>
            </div>
          } @else {
            <p class="feedback">{{ strings.floors.empty }}</p>
          }
        }
        <ul class="tree">
          @for (
            floor of store.floors();
            track floor.id;
            let index = $index, first = $first, last = $last
          ) {
            <li class="floor">
              <div class="row floor-row" [class.selected]="state.floorId() === floor.id">
                <button
                  type="button"
                  class="expand"
                  [attr.aria-label]="strings.editor.workspace.toggleFloor + ' · ' + floor.name"
                  [attr.aria-expanded]="isExpanded(floor.id)"
                  (click)="toggleFloor(floor.id)"
                >
                  <svg lucideChevronRight class="chevron" aria-hidden="true"></svg>
                </button>
                <button
                  type="button"
                  class="node floor-node"
                  [attr.aria-pressed]="state.floorId() === floor.id && !state.sectorId()"
                  [disabled]="locked()"
                  (click)="openFloor(floor.id)"
                >
                  <svg lucideLayers aria-hidden="true"></svg
                  ><span [title]="floor.name">{{ floor.name }}</span>
                </button>
                @if (!embedded() && sectorsEnabled()) {
                  <button
                    type="button"
                    class="floor-add"
                    [disabled]="locked()"
                    [attr.aria-label]="strings.editor.workspace.addSector + ' · ' + floor.name"
                    (click)="editSector(floor.id)"
                  >
                    <svg lucidePlus aria-hidden="true"></svg>
                  </button>
                }
                <details
                  class="options"
                  tabindex="-1"
                  #floorMenu
                  (keydown.escape)="floorMenu.open = false"
                >
                  <summary
                    [attr.aria-label]="
                      strings.editor.workspace.structureActions + ' · ' + floor.name
                    "
                  >
                    <svg lucideEllipsis aria-hidden="true"></svg>
                  </summary>
                  <div class="actions">
                    <button
                      type="button"
                      [disabled]="locked()"
                      (click)="floorMenu.open = false; openFloor(floor.id)"
                    >
                      {{ strings.floorEditor.viewFloor }}
                    </button>
                    <button
                      type="button"
                      [disabled]="locked()"
                      (click)="floorMenu.open = false; editFloor(floor)"
                    >
                      {{ strings.floors.list.editButton }}
                    </button>
                    <button
                      type="button"
                      [disabled]="locked()"
                      (click)="floorMenu.open = false; store.removeFloor(floor.id)"
                    >
                      {{ strings.floors.list.deleteButton }}
                    </button>
                  </div>
                </details>
              </div>
              @if (ordering()) {
                <div class="order-actions">
                  <button
                    type="button"
                    [disabled]="locked() || first"
                    (click)="store.reorderFloors(index, index - 1)"
                  >
                    {{ strings.editor.workspace.moveUp }}
                  </button>
                  <button
                    type="button"
                    [disabled]="locked() || last"
                    (click)="store.reorderFloors(index, index + 1)"
                  >
                    {{ strings.editor.workspace.moveDown }}
                  </button>
                </div>
              }
              @if (isExpanded(floor.id) && embedded()) {
                <ul class="sectors" [attr.aria-label]="floor.name">
                  @for (zone of zonesByFloor()[floor.id] ?? []; track zone.id) {
                    <li class="row sector" [class.selected]="selectedZone() === zone.id">
                      <button
                        type="button"
                        class="node"
                        [attr.aria-pressed]="selectedZone() === zone.id"
                        [disabled]="editorLocked()"
                        (click)="zoneSelected.emit({ floorId: floor.id, zone })"
                      >
                        <span class="sector-icon"
                          ><svg lucidePieChart aria-hidden="true"></svg
                        ></span>
                        <span [title]="zone.label">{{ zone.label }}</span>
                      </button>
                    </li>
                  }
                </ul>
              } @else if (isExpanded(floor.id) && sectorsEnabled()) {
                <ul class="sectors" [attr.aria-label]="floor.name">
                  @if (store.sectorsLoading(floor.id)) {
                    <li class="feedback" role="status">{{ strings.sectors.loading }}</li>
                  }
                  @for (sector of store.sectorsByFloorId(floor.id); track sector.id) {
                    <li class="row sector" [class.selected]="state.sectorId() === sector.id">
                      <button
                        type="button"
                        class="node"
                        [attr.aria-pressed]="state.sectorId() === sector.id"
                        [disabled]="locked()"
                        (click)="openFloor(floor.id, sector.id)"
                      >
                        <span class="sector-icon"
                          ><svg lucidePieChart aria-hidden="true"></svg></span
                        ><span [title]="sector.name">{{ sector.name }}</span>
                      </button>
                      <details
                        class="options"
                        tabindex="-1"
                        #sectorMenu
                        (keydown.escape)="sectorMenu.open = false"
                      >
                        <summary
                          [attr.aria-label]="
                            strings.editor.workspace.structureActions + ' · ' + sector.name
                          "
                        >
                          <svg lucideEllipsis aria-hidden="true"></svg>
                        </summary>
                        <div class="actions">
                          <button
                            type="button"
                            [disabled]="locked()"
                            (click)="sectorMenu.open = false; editSector(floor.id, sector)"
                          >
                            {{ strings.sectors.list.editButton }}
                          </button>
                          <button
                            type="button"
                            [disabled]="locked()"
                            (click)="sectorMenu.open = false; store.removeSector(sector.id)"
                          >
                            {{ strings.sectors.list.deleteButton }}
                          </button>
                        </div>
                      </details>
                    </li>
                  }
                  <li class="create-sector">
                    <button
                      type="button"
                      class="add add-sector"
                      [disabled]="locked()"
                      (click)="editSector(floor.id)"
                    >
                      <svg lucidePlus aria-hidden="true"></svg
                      >{{ strings.editor.workspace.addSector }}
                    </button>
                  </li>
                </ul>
              }
              @if (sectorForm() === floor.id) {
                <mapit-sector-form
                  [floorId]="floor.id"
                  (saved)="afterSave(floor.id, $event.id)"
                  (formClosed)="closeForms()"
                />
              }
            </li>
          }
        </ul>
        @if (floorForm()) {
          <mapit-piso-form
            [dismissible]="true"
            (saved)="afterSave($event.id)"
            (formClosed)="closeForms()"
          />
        } @else if (establishment()) {
          <div class="start-hint" aria-hidden="true">
            <span>{{ strings.editor.workspace.floorSetupStart }}</span>
            <svg lucideChevronRight></svg>
          </div>
          <button type="button" class="add add-floor" [disabled]="locked()" (click)="editFloor()">
            <svg lucidePlus aria-hidden="true"></svg>{{ strings.wizard.addFloor }}
          </button>
        }
      </aside>
      @if (!embedded()) {
        <section>
          <router-outlet />
        </section>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
      padding: 1rem;
    }
    :host:has(.embedded) {
      padding: 0;
    }
    .workspace {
      display: grid;
      align-items: start;
      gap: 1rem;
      grid-template-columns: minmax(19rem, 25rem) minmax(0, 1fr);
    }
    .workspace.embedded {
      display: block;
    }
    aside {
      min-width: 0;
      padding: 1rem;
      color: var(--mapit-color-text);
      background: var(--mapit-color-surface);
      border: 1px solid var(--mapit-color-border);
      border-radius: var(--mapit-radius-lg);
    }
    .embedded aside {
      max-height: var(--editor-height, 75dvh);
      overflow: auto;
      scrollbar-width: thin;
      scrollbar-color: var(--mapit-color-border) transparent;
    }
    header {
      position: relative;
      isolation: isolate;
      overflow: hidden;
      margin: -1rem -1rem 1rem;
      padding: 1.25rem 1rem;
      border-radius: var(--mapit-radius-lg) var(--mapit-radius-lg) 0 0;
      background: linear-gradient(
        110deg,
        var(--mapit-color-surface),
        var(--mapit-editor-selection-soft)
      );
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    header::after {
      content: '';
      position: absolute;
      z-index: -1;
      width: 55%;
      height: 85%;
      inset-inline-end: -12%;
      inset-block-end: -40%;
      border-radius: 70% 0 0 0;
      transform: rotate(-18deg);
      background: color-mix(in srgb, var(--mapit-color-primary-container) 70%, transparent);
      pointer-events: none;
    }
    header > div {
      min-width: 0;
    }
    h2 {
      margin: 0;
      font-size: 1.125rem;
      line-height: 1.25;
      font-weight: 750;
    }
    p {
      margin: 0.375rem 0 0;
      color: var(--mapit-color-text-muted);
      font-size: 0.8125rem;
      line-height: 1.5;
    }
    .icon-tile,
    .sector-icon {
      display: grid;
      place-items: center;
      flex-shrink: 0;
      color: var(--mapit-color-primary);
      background: var(--mapit-color-primary-container);
      border-radius: var(--mapit-radius);
    }
    .icon-tile {
      width: 2.75rem;
      height: 2.75rem;
    }
    .icon-tile svg {
      width: 1.5rem;
      height: 1.5rem;
    }
    svg {
      width: 1.125rem;
      height: 1.125rem;
      flex-shrink: 0;
    }
    button,
    summary {
      min-height: 2.5rem;
      padding: 0.375rem 0.5rem;
      border: 1px solid transparent;
      border-radius: var(--mapit-radius);
      background: transparent;
      color: inherit;
      font: inherit;
      font-size: 0.8125rem;
      cursor: pointer;
    }
    button:focus-visible,
    summary:focus-visible {
      outline: 2px solid var(--mapit-color-primary);
      outline-offset: -2px;
    }
    button:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    button:hover:not(:disabled),
    summary:hover {
      background: var(--mapit-color-surface-low);
    }
    .tabs {
      display: flex;
      gap: 0.25rem;
      margin-block-end: 1rem;
      padding: 0.25rem;
      border: 1px solid var(--mapit-color-border);
      border-radius: var(--mapit-radius-lg);
    }
    .tabs button {
      display: flex;
      flex: 1;
      align-items: center;
      justify-content: center;
      gap: 0.375rem;
      min-width: 0;
      font-weight: 650;
    }
    .tabs button:first-child {
      flex: 2;
    }
    .tabs button[aria-pressed='true'] {
      color: var(--mapit-color-primary);
      background: var(--mapit-color-primary-container);
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .tree {
      border-block: 1px solid var(--mapit-color-border);
    }
    .floor {
      padding-block: 0.625rem;
    }
    .floor + .floor {
      border-block-start: 1px solid var(--mapit-color-border);
    }
    .row {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      min-width: 0;
    }
    .floor-row {
      border-radius: var(--mapit-radius);
    }
    .node,
    .add {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 650;
    }
    .node {
      flex: 1;
      min-width: 0;
      text-align: start;
    }
    .node > span:not(.sector-icon) {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .floor-node {
      font-size: 0.9375rem;
      padding-inline-start: 0.25rem;
    }
    .expand {
      display: grid;
      place-items: center;
      flex: 0 0 2rem;
      padding-inline: 0.25rem;
    }
    .expand[aria-expanded='true'] .chevron {
      transform: rotate(90deg);
    }
    .selected {
      color: var(--mapit-color-primary);
      background: var(--mapit-color-primary-container);
    }
    .sectors {
      position: relative;
      margin: 0.5rem 0 0.25rem 1rem;
      padding-inline-start: 1rem;
    }
    .sector {
      position: relative;
      margin-block-end: 0.375rem;
      border: 1px solid var(--mapit-color-border);
      border-radius: var(--mapit-radius);
    }
    .sectors::before {
      content: '';
      position: absolute;
      inset-block: 0 3rem;
      inset-inline-start: 0;
      border-inline-start: 1px solid var(--mapit-color-border);
    }
    .sector::before {
      content: '';
      position: absolute;
      inset-inline-start: -1rem;
      top: 50%;
      width: 1rem;
      border-block-start: 1px solid var(--mapit-color-border);
    }
    .sector-icon {
      width: 1.75rem;
      height: 1.75rem;
    }
    .sector-icon svg {
      width: 1rem;
      height: 1rem;
    }
    .sector .node {
      font-weight: 600;
    }
    .add {
      color: var(--mapit-color-primary);
    }
    .add-sector {
      width: 100%;
      background: var(--mapit-color-primary-container);
    }
    .add-floor {
      justify-content: center;
      width: 100%;
      margin-block-start: 1rem;
      border-color: currentColor;
    }
    .options {
      position: relative;
      flex-shrink: 0;
    }
    .options[open] {
      z-index: 2;
    }
    .options summary {
      display: grid;
      place-items: center;
      width: 2.5rem;
      list-style: none;
    }
    .floor-add {
      display: grid;
      place-items: center;
      flex: 0 0 2.5rem;
      color: var(--mapit-color-primary);
      border-color: var(--mapit-color-border);
      background: var(--mapit-color-surface);
    }
    .floor-row .options summary {
      border-color: var(--mapit-color-border);
      background: var(--mapit-color-surface);
    }
    .options summary::-webkit-details-marker {
      display: none;
    }
    .actions {
      position: absolute;
      z-index: 2;
      inset-inline-end: 0;
      display: grid;
      min-width: max-content;
      padding: 0.25rem;
      border: 1px solid var(--mapit-color-border);
      border-radius: var(--mapit-radius);
      color: var(--mapit-color-text);
      background: var(--mapit-color-surface);
      box-shadow: 0 4px 12px rgb(15 23 42 / 8%);
    }
    .actions button {
      text-align: start;
    }
    .order-actions {
      display: flex;
      justify-content: end;
      gap: 0.25rem;
    }
    .feedback {
      padding-block: 0.5rem;
    }
    .onboarding aside {
      max-height: none;
      padding: 1.5rem;
      overflow: visible;
      border-color: var(--mapit-editor-selection);
      background: linear-gradient(
        145deg,
        var(--mapit-color-surface),
        color-mix(in srgb, var(--mapit-editor-selection-soft) 35%, var(--mapit-color-surface))
      );
      box-shadow: 0 6px 22px color-mix(in srgb, var(--mapit-editor-selection) 15%, transparent);
    }
    .onboarding header {
      margin: -1.5rem -1.5rem 1.25rem;
      padding: 1.5rem;
    }
    .onboarding header h2 {
      font: 800 1.25rem / 1.3 var(--mapit-font-display);
    }
    .onboarding header p {
      font-size: 0.9375rem;
    }
    .onboarding .tree {
      display: none;
    }
    .first-floor-empty {
      display: grid;
      justify-items: center;
      gap: 0.625rem;
      padding: 1.75rem 0.5rem 0.75rem;
      text-align: center;
    }
    .empty-layers {
      display: grid;
      place-items: center;
      width: 5.5rem;
      height: 5.5rem;
      margin-bottom: 0.5rem;
      border-radius: 1.25rem;
      background: var(--mapit-editor-selection-soft);
      color: var(--mapit-editor-selection);
    }
    .empty-layers svg {
      width: 3.5rem;
      height: 3.5rem;
    }
    .first-floor-empty h3 {
      margin: 0;
      font: 800 1.0625rem / 1.4 var(--mapit-font-display);
    }
    .first-floor-empty p {
      max-width: 28ch;
      margin: 0;
      color: var(--mapit-color-text-variant);
      font-size: 0.9375rem;
    }
    .start-hint {
      display: none;
    }
    .onboarding .start-hint {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      color: var(--mapit-color-primary-hover);
      font-weight: 750;
    }
    .start-hint span {
      padding: 0.5rem 1rem;
      border-radius: 2rem;
      background: var(--mapit-editor-selection-soft);
    }
    .start-hint svg {
      width: 1.5rem;
      height: 1.5rem;
      transform: rotate(90deg);
    }
    .onboarding .add-floor {
      min-height: 3.25rem;
      margin-top: 0.25rem;
      border-color: var(--mapit-editor-selection);
      background: var(--mapit-editor-selection);
      color: var(--mapit-color-on-primary);
      font-size: 1rem;
    }
    .onboarding .add-floor:hover:not(:disabled) {
      background: var(--mapit-color-primary-hover);
    }
    @media (max-width: 48rem) {
      .embedded aside {
        max-height: 29rem;
      }
      .onboarding aside {
        max-height: none;
      }
    }
    @media (max-width: 64rem) {
      .workspace {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class EstablishmentStructureComponent {
  readonly embedded = input(false);
  readonly selectedFloor = input<string | null>(null);
  readonly selectedSector = input<string | null>(null);
  readonly editorLocked = input(false);
  readonly zonesByFloor = input<Readonly<Record<string, readonly FloorZoneEntry[]>>>({});
  readonly selectedZone = input<string | null>(null);
  readonly zoneSelected = output<{ floorId: string; zone: FloorZoneEntry }>();
  readonly floorExpanded = output<string>();
  readonly selected = output<{ floorId: string; sectorId?: string }>();
  readonly changed = output<void>();
  protected readonly ordering = signal(false);
  protected readonly state = inject(StructureEditorContext);
  protected readonly store = inject(SpacesStore);
  protected readonly establishment = inject(EstablishmentContext).active;
  protected readonly sectorsEnabled = inject(FeatureFlagService).isEnabled('spaces.sectors');
  protected readonly floorForm = signal(false);
  protected readonly sectorForm = signal<string | null>(null);
  protected readonly strings = STRINGS.spaces;
  protected readonly expanded = signal<Readonly<Record<string, boolean>>>({});
  protected readonly localize = localizeString;
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private observedFloor: Floor | undefined;
  private observedSectors: readonly Sector[] | undefined;

  constructor() {
    effect(() => {
      if (!this.embedded()) return;
      this.state.floorId.set(this.selectedFloor());
      this.state.sectorId.set(this.selectedSector());
      this.state.geometryLocked.set(this.editorLocked());
    });
    effect(() => {
      const venue = this.establishment();
      if (venue) untracked(() => this.store.loadEstablishmentType(venue.id));
    });
    effect(() => {
      const floors = this.store.floors();
      const requested = this.route.firstChild?.snapshot.paramMap.get('floorId');
      const current = requested ?? this.state.floorId();
      if (
        !this.embedded() &&
        this.establishment() &&
        !this.store.loading() &&
        !this.store.error()
      ) {
        const match = floors.find((floor) => floor.id === current);
        if (!match && (floors.length || requested)) {
          const path = floors[0] ? [floors[0].id] : ['./'];
          untracked(
            () => void this.router.navigate(path, { relativeTo: this.route, replaceUrl: true }),
          );
        }
      }
      const floor = floors.find((item) => item.id === current);
      const sectors = current ? this.store.sectorsByFloor()[current] : undefined;
      if (
        !this.state.geometryLocked() &&
        floor &&
        floor.id === this.observedFloor?.id &&
        (floor !== this.observedFloor || (sectors && sectors !== this.observedSectors))
      ) {
        untracked(() => this.state.refresh.update((revision) => revision + 1));
        if (this.embedded()) untracked(() => this.changed.emit());
      }
      this.observedFloor = floor;
      this.observedSectors = sectors;
    });
    effect(() => {
      this.state.refreshTree();
      const floorId = this.state.floorId();
      const floorExists = this.store.floors().some((floor) => floor.id === floorId);
      if (floorId && floorExists && this.sectorsEnabled()) {
        untracked(() => this.store.loadSectorsByFloor(floorId));
      }
    });
    effect(() => {
      const busy =
        this.store.busy() || this.store.dirty() || this.floorForm() || !!this.sectorForm();
      this.state.metadataLocked.set(busy);
    });
    effect(() => {
      const floorId = this.state.floorId();
      if (!floorId || !this.state.createSector()) return;
      untracked(() => {
        this.state.createSector.set(false);
        this.editSector(floorId);
      });
    });
  }

  canDeactivate(): boolean {
    const allowed = confirmOperationalExit(this.store.busy(), this.store.dirty());
    if (allowed && this.store.dirty()) this.closeForms();
    return allowed;
  }

  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.store.busy() || this.store.dirty()) event.preventDefault();
  }

  protected locked(): boolean {
    return this.state.geometryLocked() || this.store.busy();
  }

  protected openFloor(floorId: string, sectorId?: string): void {
    if (!this.canDeactivate() || this.state.geometryLocked()) return;
    this.afterSave(floorId, sectorId);
  }

  protected afterSave(floorId: string, sectorId?: string): void {
    this.closeForms();
    this.expanded.update((expanded) => ({ ...expanded, [floorId]: true }));
    if (this.embedded()) {
      this.selected.emit(sectorId ? { floorId, sectorId } : { floorId });
      return;
    }
    void this.router.navigate([floorId], {
      relativeTo: this.route,
      queryParams: sectorId ? { sectorId } : {},
    });
  }

  protected isExpanded(floorId: string): boolean {
    return this.expanded()[floorId] ?? this.state.floorId() === floorId;
  }

  protected toggleFloor(floorId: string): void {
    const open = !this.isExpanded(floorId);
    this.expanded.update((expanded) => ({ ...expanded, [floorId]: open }));
    if (!open) return;
    if (this.embedded()) this.floorExpanded.emit(floorId);
    else if (this.sectorsEnabled()) this.store.loadSectorsByFloor(floorId);
  }

  protected editFloor(floor?: Floor): void {
    if (!this.canDeactivate()) return;
    this.closeForms();
    if (floor) this.store.editFloor(floor);
    this.floorForm.set(true);
  }

  protected editSector(floorId: string, sector?: Sector): void {
    if (!this.sectorsEnabled() || !this.canDeactivate()) return;
    this.closeForms();
    this.expanded.update((expanded) => ({ ...expanded, [floorId]: true }));
    if (sector) this.store.editSector(sector);
    this.sectorForm.set(floorId);
  }

  protected closeForms(): void {
    this.floorForm.set(false);
    this.sectorForm.set(null);
    this.store.startNewFloor();
    this.store.startNewSector();
  }
}
