import {
  ChangeDetectionStrategy,
  afterNextRender,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  Injector,
  signal,
  untracked,
  viewChild,
  type ElementRef,
  type OnDestroy,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, map } from 'rxjs';
import { MAP_ENGINE } from '@mapit/map-engine';
import { FeatureFlagService } from '@mapit/feature-flags';
import { ElementTypeIconComponent } from '@mapit/ui-kit';
import {
  LucideCheck,
  LucideCopy,
  LucideClipboardPaste,
  LucideDroplet,
  LucideEye,
  LucideGrid2x2,
  LucideHand,
  LucideLayers,
  LucideMaximize,
  LucideMinus,
  LucideMousePointer2,
  LucidePlus,
  LucideRedo2,
  LucideSave,
  LucideSettings,
  LucideSlidersHorizontal,
  LucideUndo2,
} from '@lucide/angular';
import { ElementLibraryComponent } from './element-library';
import { ElementPropertiesCardComponent } from './element-properties-card';
import { LayoutStyleComponent } from './layout-style';
import { withElementFinish, type LayoutStyle } from '../../../core/spatial-layout';
import { MapEditorStore } from '../model/map-editor-store';
import { localizeString, STRINGS } from '../../../core/strings';
import { EstablishmentContext } from '../../../core/establishment-context';
import {
  EstablishmentStructureComponent,
  type FloorZoneEntry,
} from '../../../core/establishment-structure/establishment-structure';
import { StructureEditorContext } from '../../../core/structure-editor-context';
import { zoneSnapshot } from '../model/zone-snapshot';

type EditorGuide = 'floor' | 'metadata' | 'geometry';

@Component({
  selector: 'mapit-map-editor-page',
  imports: [
    RouterLink,
    EstablishmentStructureComponent,
    ElementLibraryComponent,
    ElementPropertiesCardComponent,
    LayoutStyleComponent,
    ElementTypeIconComponent,
    LucideCheck,
    LucideCopy,
    LucideClipboardPaste,
    LucideDroplet,
    LucideEye,
    LucideGrid2x2,
    LucideHand,
    LucideLayers,
    LucideMaximize,
    LucideMinus,
    LucideMousePointer2,
    LucidePlus,
    LucideRedo2,
    LucideSave,
    LucideSettings,
    LucideSlidersHorizontal,
    LucideUndo2,
  ],
  providers: [MapEditorStore, StructureEditorContext],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:beforeunload)': 'beforeUnload($event)',
    '(document:keydown)': 'onShortcut($event)',
  },
  templateUrl: './map-editor-page.html',
  styleUrl: './map-editor-page.scss',
})
export class MapEditorPageComponent implements OnDestroy {
  protected readonly localizeString = localizeString;
  private readonly canvasHost = viewChild<ElementRef<HTMLDivElement>>('canvasHost');
  protected readonly store = inject(MapEditorStore);
  protected readonly port = inject(MAP_ENGINE);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly flags = inject(FeatureFlagService);
  private readonly floorsEnabled = this.flags.isEnabled('spaces.floors');
  private readonly fromStructure = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('fromStructure') === '1')),
    { initialValue: false },
  );
  protected readonly structureLink = computed(() =>
    this.floorsEnabled() ? '/spaces/structure' : '/spaces/setup',
  );
  protected readonly exitSaving = signal(false);
  protected readonly exitError = signal(false);
  private readonly formError = signal<EditorGuide | null>(null);
  protected readonly guide = signal<EditorGuide | null>(null);
  protected readonly guideText = computed(() => {
    const reason = this.guide();
    return reason
      ? {
          title: this.strings.workspace[`${reason}Title`],
          help: this.strings.workspace[`${reason}Help`],
        }
      : null;
  });
  protected readonly exitFailure = computed(() => {
    const reason = this.formError();
    const error = this.store.error();
    if (reason) return this.strings.workspace[`${reason}Help`];
    return error ? localizeString(error) : this.strings.workspace.exitError;
  });
  private readonly exitDialog = viewChild<ElementRef<HTMLDialogElement>>('exitDialog');
  private readonly guideDialog = viewChild<ElementRef<HTMLDialogElement>>('guideDialog');
  private exitResponse: { result: Promise<boolean>; resolve: (value: boolean) => void } | null =
    null;
  protected readonly dirty = computed(() => this.store.dirty() || this.hasFormDraft());
  protected readonly establishment = inject(EstablishmentContext).active;
  protected readonly propertiesTab = signal<'details' | 'style' | 'advanced'>('details');
  protected readonly appearance = this.store.appearance;
  protected readonly styleAvatar = computed(() => {
    const element = this.store.selectedElement();
    return element
      ? this.port.furniturePreview?.(
          withElementFinish(element, this.appearance().elements[element.id]),
        )
      : null;
  });
  protected readonly strings = STRINGS.spaces.editor;
  protected readonly stateLabels = STRINGS.spaces.elements.states;
  protected readonly typeLabels = STRINGS.spaces.elements.types;
  protected readonly panel = signal<'structure' | 'elements'>('structure');
  protected readonly copied = signal(false);
  private readonly elementLibrary = viewChild(ElementLibraryComponent);
  protected readonly preview = signal(false);
  protected readonly panning = signal(false);
  protected readonly grid = signal(true);
  protected readonly zoomPercent = computed(() => Math.round((this.port.zoom?.() ?? 1) * 100));
  protected readonly locked = computed(() => this.store.busy() || this.store.loading());
  protected readonly editable = computed(
    () => this.store.canEdit() && !this.locked() && !this.preview() && !this.zoneId(),
  );
  protected readonly zoneId = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('zoneId'))),
    { initialValue: null },
  );
  protected readonly zoneView = computed(() => zoneSnapshot(this.store.layout(), this.zoneId()));
  protected readonly floorZones = computed(() => {
    const result: Record<string, FloorZoneEntry[]> = {};
    const activeFloor = this.store.selectedFloorId();
    const activeSector = this.store.sectorId();
    for (const [floorId, layout] of Object.entries(this.store.floorLayouts())) {
      result[floorId] = layout.sectors.flatMap((sector) =>
        floorId === activeFloor && sector.id === activeSector
          ? []
          : sector.elements
              .filter(({ type }) => type === 'SECTOR_ZONE')
              .map((zone) => ({
                id: zone.id,
                sectorId: sector.id,
                label: zone.name ?? zone.label ?? this.typeLabels.SECTOR_ZONE,
              })),
      );
    }
    if (activeFloor && activeSector) {
      (result[activeFloor] ??= []).push(
        ...this.store
          .elements()
          .filter(({ type }) => type === 'SECTOR_ZONE')
          .map(({ id, label }) => ({ id, label, sectorId: activeSector })),
      );
    }
    return result;
  });
  protected readonly selectedFloor = computed(() =>
    this.store.floors().find((floor) => floor.id === this.store.selectedFloorId()),
  );
  protected readonly floorName = computed(() => this.selectedFloor()?.name);
  protected readonly floorDimensions = linkedSignal(() => {
    const floor = this.selectedFloor();
    return { width: floor?.canvasWidth ?? 0, height: floor?.canvasHeight ?? 0 };
  });
  protected readonly canApplyFloorDimensions = computed(() => {
    const floor = this.selectedFloor();
    const { width, height } = this.floorDimensions();
    return (
      !!floor &&
      this.store.canEditMetadata() &&
      !this.locked() &&
      !this.store.conflict() &&
      (!this.store.floorCanvas() || !this.dirty()) &&
      Number.isFinite(width) &&
      Number.isFinite(height) &&
      width >= 20 &&
      height >= 20 &&
      (width !== floor.canvasWidth || height !== floor.canvasHeight)
    );
  });

  protected setFloorDimension(axis: 'width' | 'height', value: number): void {
    this.floorDimensions.update((size) => ({ ...size, [axis]: value }));
  }

  protected applyFloorDimensions(event: Event): void {
    event.preventDefault();
    if (!this.canApplyFloorDimensions()) return;
    const { width, height } = this.floorDimensions();
    this.store.saveFloorDimensions(width, height);
  }
  private readonly propertiesCard = viewChild(ElementPropertiesCardComponent);
  private mounted = false;
  private renderedSpace: string | null = null;
  private readonly requested = toSignal(
    combineLatest([this.route.paramMap, this.route.queryParamMap]).pipe(
      map(([params, query]) => ({
        sector: params.get('sectorId') ?? query.get('sectorId'),
        floor: query.get('floorId'),
      })),
    ),
  );
  private readonly manualFloor = signal<string | null>(null);

  constructor() {
    effect(() => {
      const floorId = this.store.selectedFloorId();
      if (floorId) untracked(() => this.store.loadFloorZones(floorId));
    });
    effect(() => {
      if (this.zoneId()) {
        this.panel.set('structure');
        this.propertiesTab.set('details');
        untracked(() => this.store.selectElement(null));
      }
    });
    effect(() => {
      const request = this.requested();
      if (!request) return;
      untracked(() => this.store.openRoute(request.sector, request.floor));
    });

    effect(() => {
      const host = this.canvasHost()?.nativeElement;
      const zone = this.zoneView();
      const base = zone ?? this.store.layout();
      const appearance = this.appearance();
      const sector = this.store.sectorId();
      const floorId = this.store.selectedFloorId();
      const floor = sector ? undefined : this.selectedFloor();
      const layout = {
        ...base,
        ...(floor?.canvasWidth && floor.canvasHeight
          ? { size: { width: floor.canvasWidth, height: floor.canvasHeight } }
          : {}),
        ...(appearance.room ? { appearance: appearance.room } : {}),
        elements: base.elements.map((element) =>
          withElementFinish(element, appearance.elements[element.id]),
        ),
      };
      const space = zone ? this.zoneId() : (sector ?? floorId);
      if (!host) return;
      untracked(() => {
        if (!this.mounted) {
          this.port.mount(host, layout);
          this.port.setLayoutFinish?.(true);
          this.mounted = true;
          this.port.onDragMove(({ id, x, y }) => this.store.updateElementPositionLocal(id, x, y));
          this.port.onDragEnd(({ id, x, y }) => this.store.dragElement(id, x, y));
          this.port.onResizeEnd(({ id, x, y, width, height, rotation }) => {
            this.store.resizeElement(id, x, y, width, height, rotation);
          });
          this.port.onElementClick(({ id }) => this.selectElement(id));
          this.port.onExternalDrop?.(({ key, x, y }) => {
            if (!this.editable() || !this.stageForms()) return;
            if (key.startsWith('catalog:')) this.elementLibrary()?.dropModel(key, x, y);
            else this.store.createElementFromDrop(key, x, y);
          });
          this.port.fitToViewport?.();
        } else {
          this.port.load(layout);
        }
        if (space !== this.renderedSpace) {
          this.renderedSpace = space;
          this.port.fitToViewport?.();
        }
      });
    });

    effect(() => {
      const floor = this.manualFloor();
      const sector = this.store.sectorId();
      if (floor && floor === this.store.selectedFloorId() && !this.store.loading()) {
        this.manualFloor.set(null);
        void this.router.navigate(sector ? ['/spaces/editor', sector] : ['/spaces/editor'], {
          queryParams: { floorId: floor, ...(this.fromStructure() ? { fromStructure: '1' } : {}) },
          replaceUrl: true,
        });
      }
    });
    effect(() => {
      const editable = this.editable();
      untracked(() => this.port.setEditable(editable));
    });
    effect(() => {
      const panning = this.panning();
      untracked(() => this.port.setPanning?.(panning));
    });
    effect(() => this.port.setGridVisible?.(this.grid() && !this.preview()));
    effect(() => {
      const id = this.preview() ? null : this.store.selectedId();
      untracked(() => this.port.setSelectedElement(id));
    });
  }

  ngOnDestroy(): void {
    this.exitResponse?.resolve(false);
    this.port.destroy();
  }

  canDeactivate(): boolean | Promise<boolean> {
    if (this.structureManager() && !this.structureManager()!.canDeactivate()) return false;
    if (this.exitResponse) return this.exitResponse.result;
    if (this.store.busy()) return false;
    if (!this.dirty()) return true;
    const dialog = this.exitDialog()?.nativeElement;
    if (!dialog) return false;
    let resolveExit!: (allow: boolean) => void;
    const result = new Promise<boolean>((resolve) => {
      resolveExit = resolve;
    });
    this.exitResponse = { result, resolve: resolveExit };
    this.exitError.set(false);
    dialog.showModal();
    return result;
  }

  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.store.busy() || this.dirty()) event.preventDefault();
  }

  protected finishExit(allow: boolean): void {
    const response = this.exitResponse;
    this.exitResponse = null;
    this.exitDialog()?.nativeElement.close();
    response?.resolve(allow);
  }

  protected cancelExit(event: Event): void {
    event.preventDefault();
    if (!this.exitSaving()) this.finishExit(false);
  }

  protected discardAndExit(): void {
    if (!this.store.discardChanges()) return;
    this.propertiesCard()?.discardDraft();
    this.finishExit(true);
  }

  protected async saveAndExit(): Promise<void> {
    if (this.exitSaving()) return;
    this.exitSaving.set(true);
    this.exitError.set(false);
    try {
      if (await this.save()) this.finishExit(true);
      else this.exitError.set(true);
    } finally {
      this.exitSaving.set(false);
    }
  }

  protected async save(): Promise<boolean> {
    if (this.store.busy()) return false;
    if (this.stageForms()) return await this.store.saveChanges();
    const reason = this.formError();
    if (reason && !this.exitSaving()) this.showGuide(reason);
    return false;
  }

  private stageForms(): boolean {
    this.formError.set(null);
    const elementError = this.stageElement();
    if (elementError) {
      this.formError.set(elementError);
      return false;
    }
    return true;
  }

  private hasFormDraft(): boolean {
    return this.propertiesCard()?.dirty() ?? false;
  }

  protected focusLibrary(): void {
    if (this.locked() || this.zoneId()) return;
    if (this.structureManager() && !this.structureManager()!.canDeactivate()) return;
    if (!this.store.selectedFloorId()) {
      this.showGuide('floor');
      return;
    }
    if (!this.stageForms()) return;
    this.panel.set('elements');
    if (!this.store.sectorId()) this.store.prepareFloorCanvas();
    afterNextRender(() => this.elementLibrary()?.focus(), { injector: this.injector });
  }

  protected updateAppearance(update: (current: LayoutStyle) => LayoutStyle): void {
    this.store.updateAppearance(update);
  }

  protected openStyle(tab: 'style' | 'advanced'): void {
    const reason = this.stageElement();
    if (reason) this.showGuide(reason);
    else this.propertiesTab.set(tab);
  }

  private showGuide(reason: EditorGuide): void {
    this.guide.set(reason);
    afterNextRender(
      () => {
        const dialog = this.guideDialog()?.nativeElement;
        if (dialog && !dialog.open) dialog.showModal();
      },
      { injector: this.injector },
    );
  }

  private readonly structureManager = viewChild(EstablishmentStructureComponent);

  protected openZone(event: { floorId: string; zone: FloorZoneEntry }): void {
    void this.router.navigate(['/spaces/editor', event.zone.sectorId], {
      queryParams: { floorId: event.floorId, zoneId: event.zone.id },
    });
  }

  protected async selectStructure(selection: {
    floorId: string;
    sectorId?: string;
  }): Promise<void> {
    await this.router.navigate(
      selection.sectorId ? ['/spaces/editor', selection.sectorId] : ['/spaces/editor'],
      { queryParams: { floorId: selection.floorId } },
    );
  }

  protected refreshStructure(): void {
    if (!this.dirty() && !this.locked()) this.store.reloadSector();
  }

  protected async selectFloor(id: string): Promise<void> {
    if (id !== this.store.selectedFloorId() && !this.locked() && (await this.canDeactivate())) {
      this.manualFloor.set(id);
      this.store.selectFloor(id);
    }
  }

  protected selectSector(id: string): void {
    if (id === this.store.sectorId() || this.locked()) return;
    void this.router.navigate(['/spaces/editor', id], {
      queryParams: {
        floorId: this.store.selectedFloorId(),
        ...(this.fromStructure() ? { fromStructure: '1' } : {}),
      },
    });
  }

  protected selectElement(id: string | null): void {
    if (this.zoneId()) return;
    const reason =
      id === this.store.selectedId() || this.preview() || this.locked()
        ? null
        : this.stageElement();
    if (reason) this.showGuide(reason);
    if (this.preview() || this.locked() || reason) {
      this.port.setSelectedElement(this.preview() ? null : this.store.selectedId());
      return;
    }
    this.store.selectElement(id);
    if (id === null) this.propertiesTab.set('details');
    this.port.setSelectedElement(id);
  }

  private stageElement(): EditorGuide | null {
    const card = this.propertiesCard();
    if (card && !card.applyMetadataDraft()) return 'metadata';
    if (card && !card.applyGeometryDraft()) return 'geometry';
    return null;
  }

  protected async reload(): Promise<void> {
    if (await this.canDeactivate()) this.store.reloadSector();
  }

  protected onShortcut(event: KeyboardEvent): void {
    if (
      !this.editable() ||
      this.exitDialog()?.nativeElement.open ||
      this.guideDialog()?.nativeElement.open ||
      (event.target instanceof HTMLElement &&
        event.target.closest('input, textarea, select, dialog, [contenteditable]'))
    )
      return;
    if (
      (event.key === 'Delete' || event.key === 'Backspace') &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      const element = this.store.selectedElement();
      if (!element || event.repeat) return;
      event.preventDefault();
      this.store.confirmDeleteElement(element.id);
      return;
    }
    if (!event.ctrlKey && !event.metaKey) return;
    switch (event.key.toLowerCase()) {
      case 'c':
        if (!this.store.selectedElement()) return;
        this.copy();
        break;
      case 'v':
        if (!this.store.canPaste()) return;
        this.paste();
        break;
      case 's':
        void this.save();
        break;
      case 'z':
        if (event.shiftKey) this.store.redo();
        else this.store.undo();
        break;
      case 'y':
        this.store.redo();
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  protected copy(): void {
    if (this.editable() && this.stageForms()) this.copied.set(this.store.copySelectedElement());
  }

  protected paste(): void {
    if (this.editable() && this.stageForms()) {
      this.store.pasteElement();
      this.propertiesTab.set('details');
    }
  }

  protected duplicate(): void {
    const el = this.store.selectedElement();
    if (el && this.editable() && this.stageForms()) {
      this.store.createElementFromDrop('copy:' + el.id, el.position.x + 24, el.position.y + 24);
    }
  }

  protected togglePreview(): void {
    if (!this.store.selectedFloorId()) {
      this.showGuide('floor');
      return;
    }
    if (!this.preview() && !this.stageForms()) {
      const reason = this.formError();
      if (reason) this.showGuide(reason);
      return;
    }
    this.preview.update((value) => !value);
    this.port.fitToViewport?.();
  }

  protected openSaveTemplateDialog(): void {
    if (this.store.busy() || this.store.loading()) return;
    const name = window.prompt(this.strings.templateNameLabel, '');
    if (name !== null) {
      this.store.saveAsTemplate(name);
    }
  }
}
