import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  afterNextRender,
  Component,
  computed,
  effect,
  inject,
  Injector,
  linkedSignal,
  signal,
  untracked,
  viewChild,
  type ElementRef,
  type OnDestroy,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  LucideArmchair,
  LucideCalendarCheck,
  LucideCircleSlash,
  LucideHand,
  LucideHouse,
  LucideChevronRight,
  LucideMaximize,
  LucideMinus,
  LucidePencil,
  LucidePanelRight,
  LucidePlus,
  LucideSparkles,
  LucideStore,
  LucideUserRound,
  LucideUsers,
  LucideZap,
  LucideX,
} from '@lucide/angular';
import { MAP_ENGINE, type SpaceElementId } from '@mapit/map-engine';
import { FeatureFlagService } from '@mapit/feature-flags';
import { I18nService, LocalizedDatePipe, LocalizedNumberPipe } from '@mapit/i18n';
import { AuthSession } from '@mapit/auth';
import type { LocatedElement, OperationalIncident } from '../../../core/operational-map-data';
import { confirmOperationalExit } from '../../../core/operational-exit-guard';
import { STRINGS } from '../../../core/strings';
import { QuickReservationStore } from '../model/quick-reservation-store';
import { MONITOR_STATES, SpaceMonitorStore } from '../model/space-monitor-store';
import { QuickReservationComponent } from './quick-reservation';

const PANELS = ['table', 'operations', 'quick'] as const;
type MonitorPanel = (typeof PANELS)[number];

@Component({
  selector: 'mapit-space-monitor',
  imports: [
    RouterLink,
    NgTemplateOutlet,
    LocalizedDatePipe,
    LocalizedNumberPipe,
    LucideArmchair,
    LucideCalendarCheck,
    LucideChevronRight,
    LucideCircleSlash,
    LucideHand,
    LucideHouse,
    LucideMaximize,
    LucideMinus,
    LucidePencil,
    LucidePanelRight,
    LucidePlus,
    LucideSparkles,
    LucideStore,
    LucideUserRound,
    LucideUsers,
    LucideZap,
    LucideX,
    QuickReservationComponent,
  ],
  providers: [SpaceMonitorStore, QuickReservationStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './space-monitor.html',
  styleUrl: './space-monitor.scss',
  host: { '(document:keydown.escape)': 'handleEscape($event)' },
})
export class SpaceMonitor implements OnDestroy {
  protected readonly store = inject(SpaceMonitorStore);
  protected readonly quickReservation = inject(QuickReservationStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(AuthSession);
  private readonly injector = inject(Injector);
  private readonly mapParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  private readonly editorEnabled = inject(FeatureFlagService).isEnabled('map-editor.enabled');
  protected readonly canOpenEditor = computed(() => this.store.canEdit() && this.editorEnabled());
  protected readonly canCheckIn = computed(
    () =>
      this.store.establishment()?.canCheckIn &&
      ['ADMIN', 'STAFF'].includes(this.session.user()?.role ?? ''),
  );
  protected readonly canBook = computed(() =>
    ['ADMIN', 'MANAGER', 'STAFF'].includes(this.session.user()?.role ?? ''),
  );
  protected readonly port = inject(MAP_ENGINE);
  protected readonly locale = inject(I18nService).locale;
  protected readonly strings = STRINGS.spaces.editor.monitor;
  protected readonly checkIn = STRINGS.checkIn;
  protected readonly reservationForm = STRINGS.reservations.form;
  protected get homeLabel(): string {
    return STRINGS.staffShell.nav.home;
  }
  protected readonly workspace = STRINGS.spaces.editor.workspace;
  protected readonly editor = STRINGS.spaces.editor;
  protected readonly states = MONITOR_STATES;
  protected readonly panning = signal(false);
  protected readonly panels = PANELS;
  protected readonly panel = signal<MonitorPanel>('table');
  protected readonly alternativeSearch = signal(false);
  protected readonly showQuickBooking = computed(() => {
    const table = this.quickReservation.scope();
    const params = this.mapParams();
    const target = params.get('panel') === 'quick' ? params.get('elementId') : null;
    return (
      this.canBook() && !this.alternativeSearch() && !!table && (!target || target === table.id)
    );
  });
  protected readonly panelOpen = signal(false);
  protected readonly panelMotion = signal(false);
  private readonly panelToggle = viewChild<ElementRef<HTMLButtonElement>>('panelToggle');
  private readonly monitor = viewChild<ElementRef<HTMLDivElement>>('monitor');
  private readonly tabList = viewChild<ElementRef<HTMLElement>>('tabList');
  protected readonly preview = signal<{
    id: SpaceElementId;
    x: number;
    y: number;
    left: boolean;
  } | null>(null);
  protected readonly previewElement = computed(() =>
    this.selectableElements().find(({ id }) => id === this.preview()?.id),
  );
  protected readonly previewReservation = computed(() =>
    this.store.reservationFor(this.previewElement()?.id ?? null),
  );
  private previewExit: ReturnType<typeof setTimeout> | undefined;
  protected readonly reservationExpanded = linkedSignal({
    source: () => this.store.selectedReservation()?.reservation.id,
    computation: () => false,
  });
  protected readonly resultsLimit = signal(4);
  protected readonly extendResults = (limit: number): number => limit + 4;
  protected readonly selectableElements = computed(() =>
    this.store
      .layout()
      .elements.filter((element) => element.reservable)
      .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x),
  );
  protected readonly connectionLabel = computed(() => {
    const connection = this.store.connection();
    if (connection === 'connected') return this.strings.live;
    if (connection === 'connecting') return this.strings.connecting;
    if (connection === 'disabled') return this.strings.realtimeDisabled;
    return this.strings.offline;
  });
  private readonly host = viewChild<ElementRef<HTMLDivElement>>('host');
  private mounted = false;
  private scope: string | null = null;

  constructor() {
    effect(() => {
      const params = this.mapParams();
      const panel = params.get('panel');
      if (panel === 'operations' || panel === 'quick') {
        this.alternativeSearch.set(
          panel === 'quick' && !params.has('elementId') && params.has('partySize'),
        );
        this.panel.set(panel);
        this.panelOpen.set(true);
        this.clearPreview();
      }
    });
    let prefilledQuery: ReturnType<typeof this.mapParams> | undefined;
    effect(() => {
      const params = this.mapParams();
      const elementId = params.get('elementId');
      const startsAt = params.get('startsAt');
      const establishmentId = params.get('establishmentId');
      if (
        params === prefilledQuery ||
        params.get('panel') !== 'quick' ||
        !elementId ||
        !startsAt ||
        !this.canBook() ||
        (establishmentId && establishmentId !== this.store.establishment()?.id) ||
        elementId !== this.quickReservation.scope()?.id
      )
        return;
      prefilledQuery = params;
      untracked(() => this.quickReservation.prefill(startsAt, Number(params.get('partySize'))));
    });
    effect(() => {
      const host = this.host()?.nativeElement;
      const layout = this.store.layout();
      const sector = this.store.sector()?.id ?? null;
      if (!host) return;
      untracked(() => {
        if (!this.mounted) {
          this.port.setEditable(false);
          this.port.mount(host, layout);
          this.port.setGridVisible?.(false);
          this.port.setOperationalDisplay?.(true);
          this.port.onElementClick(({ id }) => this.selectElement(id, true));
          this.port.fitToViewport?.();
          this.mounted = true;
        } else {
          this.port.load(layout);
        }
        if (this.scope !== sector) {
          this.scope = sector;
          this.clearPreview();
          this.port.fitToViewport?.();
        }
      });
    });
    effect(() => {
      const id = this.store.selectedId();
      untracked(() => this.port.setSelectedElement(id));
    });
    effect(() => this.port.setPanning?.(this.panning()));
  }

  private selectElement(id: SpaceElementId | null, animate = false): void {
    if (this.quickReservation.busy()) {
      this.port.setSelectedElement(this.store.selectedId());
      return;
    }
    if (id && !this.selectableElements().some((element) => element.id === id)) {
      this.port.setSelectedElement(this.store.selectedId());
      return;
    }
    this.store.selectedId.set(id);
    if (id) {
      this.selectPanel('table');
      this.openPanel(animate);
    }
  }

  protected openPanel(animate = false): void {
    this.clearPreview();
    this.panelMotion.set(animate);
    this.panelOpen.set(true);
    afterNextRender(
      () =>
        this.tabList()
          ?.nativeElement.querySelector<HTMLButtonElement>('[aria-selected="true"]')
          ?.focus(),
      { injector: this.injector },
    );
  }

  protected closePanel(animate = false): void {
    this.panelMotion.set(animate);
    this.panelOpen.set(false);
    this.panelToggle()?.nativeElement.focus();
    if (this.mapParams().has('panel')) this.clearPanelQuery();
  }

  protected inspectPointer(event: PointerEvent, canvas: HTMLElement): void {
    if (event.pointerType !== 'mouse' || this.panning()) return;
    const { left, top, width, height } = canvas.getBoundingClientRect();
    const x = event.clientX - left;
    const y = event.clientY - top;
    const hit = this.port.elementAtViewport?.({ x, y });
    if (!hit || !this.selectableElements().some((el) => el.id === hit.id)) {
      this.schedulePreviewExit();
      return;
    }
    this.keepPreview();
    if (hit.id === this.preview()?.id) return;
    const cardWidth = Math.min(256, width - 16);
    const before = hit.bounds.x - 10;
    const after = hit.bounds.x + hit.bounds.width + 10;
    const fitsRight = after + cardWidth <= width - 8;
    const showOnLeft = !fitsRight && before >= cardWidth + 8;
    const topEdge = fitsRight || showOnLeft ? hit.bounds.y : hit.bounds.y + hit.bounds.height + 10;
    this.preview.set({
      id: hit.id,
      x: showOnLeft ? before : Math.max(8, Math.min(after, width - cardWidth - 8)),
      y: Math.min(Math.max(8, topEdge), Math.max(8, height - 185)),
      left: showOnLeft,
    });
  }

  protected inspectKey(event: KeyboardEvent): void {
    const elements = this.selectableElements();
    if (!elements.length) return;
    const index = elements.findIndex(({ id }) => id === this.preview()?.id);
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.selectElement(elements[Math.max(0, index)]!.id);
      return;
    }
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = (index + 1) % elements.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = (index < 0 ? elements.length - 1 : index + elements.length - 1) % elements.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = elements.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    this.keepPreview();
    this.preview.set({ id: elements[next]!.id, x: 64, y: 62, left: false });
  }

  protected handleEscape(event: Event): void {
    if (this.preview()) {
      event.stopPropagation();
      this.clearPreview();
    } else if (
      this.panelOpen() &&
      event.target instanceof Node &&
      this.monitor()?.nativeElement.contains(event.target)
    ) {
      event.stopPropagation();
      this.closePanel();
    }
  }

  protected keepPreview(): void {
    clearTimeout(this.previewExit);
    this.previewExit = undefined;
  }

  protected schedulePreviewExit(): void {
    if (this.preview() && this.previewExit === undefined) {
      this.previewExit = setTimeout(() => this.clearPreview(), 170);
    }
  }

  protected clearPreview(): void {
    this.keepPreview();
    this.preview.set(null);
  }

  protected selectPanel(panel: MonitorPanel): void {
    if (panel !== 'quick') this.alternativeSearch.set(false);
    this.panel.set(panel);
    const requestedPanel = this.mapParams().get('panel');
    if (requestedPanel && requestedPanel !== panel) {
      this.clearPanelQuery();
    }
  }

  private clearPanelQuery(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        panel: null,
        date: null,
        time: null,
        partySize: null,
        startsAt: null,
        endsAt: null,
        ...(this.mapParams().get('panel') === 'quick' ? { elementId: null } : {}),
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected activatePanel(panel: MonitorPanel, tabList: HTMLElement): void {
    this.selectPanel(panel);
    tabList.querySelector<HTMLButtonElement>(`#map-tab-${panel}`)?.focus();
  }

  protected openAlternatives(incident: OperationalIncident, tabList: HTMLElement): void {
    this.store.findAlternative(incident);
    this.alternativeSearch.set(true);
    this.activatePanel('quick', tabList);
  }

  protected cancelQuickReservation(): void {
    this.quickReservation.reset();
    const tabs = this.tabList()?.nativeElement;
    if (tabs) this.activatePanel('table', tabs);
  }

  canDeactivate(): boolean {
    return confirmOperationalExit(this.quickReservation.busy(), this.quickReservation.dirty());
  }

  protected locateTable(item: LocatedElement, tabList: HTMLElement): void {
    this.store.locate(item);
    this.port.fitToViewport?.();
    this.activatePanel('table', tabList);
  }

  protected navigatePanels(event: KeyboardEvent, tabList: HTMLElement): void {
    const index = PANELS.indexOf(this.panel());
    let next: MonitorPanel;
    switch (event.key) {
      case 'ArrowLeft':
        next = PANELS[(index + PANELS.length - 1) % PANELS.length]!;
        break;
      case 'ArrowRight':
        next = PANELS[(index + 1) % PANELS.length]!;
        break;
      case 'Home':
        next = 'table';
        break;
      case 'End':
        next = 'quick';
        break;
      default:
        return;
    }
    event.preventDefault();
    this.activatePanel(next, tabList);
  }

  ngOnDestroy(): void {
    this.keepPreview();
    this.port.destroy();
  }
}
