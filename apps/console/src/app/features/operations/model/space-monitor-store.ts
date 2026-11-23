import { ActivatedRoute } from '@angular/router';
import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { OperationsService, SpacesService, type Floor, type Sector } from '@mapit/api-client';
import { AuthSession } from '@mapit/auth';
import { LAYOUT_VACIO, type ElementState } from '@mapit/map-engine';
import { RealtimeClient } from '@mapit/realtime';
import { auditTime, catchError, filter, finalize, map, merge, of, switchMap, timer } from 'rxjs';
import { EstablishmentContext } from '../../../core/establishment-context';
import { establishmentInstant, establishmentWallTime } from '../../../core/establishment-time';
import {
  availableQuickElements,
  isBlockingReservation,
  type LocatedElement,
  OperationalMapData,
  type OperationalIncident,
  QUICK_RESERVATION_MINUTES,
  RESERVATION_PREPARATION_MINUTES,
} from '../../../core/operational-map-data';
import {
  mapApiElementToLayoutElement,
  normalizeLayoutStyle,
  withElementFinish,
} from '../../../core/spatial-layout';

export const MONITOR_STATES: readonly ElementState[] = [
  'AVAILABLE',
  'OCCUPIED',
  'RESERVED',
  'CLEANING',
  'OUT_OF_SERVICE',
];

type QuickQuery = {
  establishmentId: string;
  startsAt: string;
  endsAt: string;
  partySize: number;
  excludeElementId: string | undefined;
};

@Injectable()
export class SpaceMonitorStore {
  private readonly api = inject(SpacesService);
  private readonly operations = inject(OperationsService);
  private readonly data = inject(OperationalMapData);
  private readonly destroyRef = inject(DestroyRef);
  private readonly realtime = inject(RealtimeClient);
  private readonly context = inject(EstablishmentContext);
  private readonly session = inject(AuthSession);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly routeQuery = toSignal(this.route?.queryParamMap ?? of(null));
  private readonly requestedFloor = this.route?.snapshot.queryParamMap.get('floorId');
  private readonly requestedSector = this.route?.snapshot.queryParamMap.get('sectorId');
  readonly establishment = computed(() =>
    this.context.status() === 'ready' ? this.context.active() : null,
  );
  private readonly establishmentId = computed(() => this.establishment()?.id ?? null);
  private readonly retryCount = signal(0);
  readonly connection = this.realtime.connectionState;
  readonly canEdit = computed(() => ['ADMIN', 'MANAGER'].includes(this.session.user()?.role ?? ''));
  readonly canUpdateState = computed(() => {
    const establishment = this.establishment();
    const role = this.session.user()?.role;
    return !!establishment && (role === 'ADMIN' || (role === 'STAFF' && establishment.canCheckIn));
  });
  readonly stateUpdating = signal(false);
  readonly stateError = linkedSignal({ source: () => this.selectedId(), computation: () => false });
  readonly quickMinutes = QUICK_RESERVATION_MINUTES;
  readonly preparationMinutes = RESERVATION_PREPARATION_MINUTES;
  readonly incidents = this.data.incidents;
  readonly incidentsStatus = this.data.status;
  readonly quickDate = linkedSignal({
    source: this.establishmentId,
    computation: () => '',
  });
  readonly quickTime = linkedSignal({
    source: this.establishmentId,
    computation: () => '',
  });
  readonly quickPeople = linkedSignal({
    source: this.establishmentId,
    computation: () => 2,
  });
  private readonly alternativeId = linkedSignal({
    source: () => [this.establishmentId(), this.quickDate(), this.quickTime()],
    computation: (): string | undefined => undefined,
  });
  private readonly submittedQuick = linkedSignal({
    source: () => [this.establishmentId(), this.quickDate(), this.quickTime(), this.quickPeople()],
    computation: (): QuickQuery | 'invalid' | null => null,
  });
  readonly quickStatus = computed(() => {
    const query = this.submittedQuick();
    if (!query) return 'idle';
    return query === 'invalid' || Date.parse(query.startsAt) <= this.data.now()
      ? 'invalid'
      : this.data.status();
  });
  readonly quickResults = computed(() => {
    const query = this.submittedQuick();
    if (!query || query === 'invalid') return [];
    return availableQuickElements(
      this.data.elements(),
      this.data.reservations(),
      query.startsAt,
      query.endsAt,
      query.partySize,
      this.data.now(),
    )
      .filter((item) => item.element.id !== query.excludeElementId)
      .map((item) => ({
        ...item,
        query: {
          panel: 'quick',
          establishmentId: query.establishmentId,
          floorId: item.floorId,
          sectorId: item.sectorId,
          startsAt: query.startsAt,
          partySize: query.partySize,
          elementId: item.element.id,
        },
      }));
  });

  private readonly floorRequest = computed(() => ({
    id: this.establishmentId(),
    retry: this.retryCount(),
  }));
  private readonly floorResult = toSignal(
    toObservable(this.floorRequest).pipe(
      switchMap(({ id }) =>
        id
          ? this.api.listFloorsByEstablishment({ establishmentId: id }).pipe(
              map((items) => ({ id, items, error: false })),
              catchError(() => of({ id, items: [] as Floor[], error: true })),
            )
          : of(null),
      ),
    ),
  );
  readonly floors = computed(() => {
    const result = this.floorResult();
    return result && result.id === this.establishmentId() ? result.items : [];
  });
  private readonly floorChoice = linkedSignal({
    source: this.floors,
    computation: (floors, previous): string | null =>
      floors.find((floor) => floor.id === (previous?.value ?? this.requestedFloor))?.id ??
      floors[0]?.id ??
      null,
  });
  readonly floorId = computed(
    () => this.floors().find((floor) => floor.id === this.floorChoice())?.id ?? null,
  );

  private readonly floorScope = computed(() => ({
    establishment: this.establishmentId(),
    id: this.floorId(),
    retry: this.retryCount(),
  }));
  private readonly sectorResult = toSignal(
    toObservable(this.floorScope).pipe(
      switchMap(({ id, establishment }) =>
        id
          ? this.api.listSectorsByFloor({ floorId: id }).pipe(
              map((items) => ({ id, establishment, items, error: false })),
              catchError(() => of({ id, establishment, items: [] as Sector[], error: true })),
            )
          : of(null),
      ),
    ),
  );
  readonly sectors = computed(() => {
    const result = this.sectorResult();
    return result && result.establishment === this.establishmentId() && result.id === this.floorId()
      ? result.items
      : [];
  });
  private readonly sectorChoice = linkedSignal({
    source: this.sectors,
    computation: (sectors, previous): string | null =>
      sectors.find((sector) => sector.id === (previous?.value ?? this.requestedSector))?.id ??
      sectors[0]?.id ??
      null,
  });
  private readonly location = signal<
    (Pick<LocatedElement, 'floorId' | 'sectorId'> & { elementId: string }) | null
  >(null);
  readonly sector = computed(
    () => this.sectors().find((sector) => sector.id === this.sectorChoice()) ?? null,
  );

  private readonly sectorId = computed(() => this.sector()?.id ?? null);
  private readonly selectionScope = computed(() => ({
    establishment: this.establishmentId(),
    floor: this.floorId(),
    sector: this.sectorId(),
  }));
  readonly selectedId = linkedSignal<ReturnType<typeof this.selectionScope>, string | null>({
    source: this.selectionScope,
    computation: () => null,
  });

  private readonly connectionChanges = toObservable(this.connection);
  private readonly snapshotScope = computed(() => ({
    ...this.selectionScope(),
    retry: this.retryCount(),
    detailAccess: this.canEdit(),
  }));
  private readonly snapshot = toSignal(
    toObservable(this.snapshotScope).pipe(
      switchMap(({ establishment, floor, sector, detailAccess }) => {
        if (!establishment || !floor || !sector) return of(null);
        const load = () =>
          detailAccess
            ? this.api.listSpaceElementsBySector({ sectorId: sector })
            : this.api
                .getFloorLayout({ floorId: floor })
                .pipe(
                  map((layout) =>
                    layout.floor.id === floor
                      ? (layout.sectors.find((entry) => entry.id === sector)?.elements ?? [])
                      : [],
                  ),
                );
        const changes = this.realtime.subscribeEstablishment(establishment).pipe(
          filter(
            (event) =>
              event.establishmentId === establishment &&
              (!event.sectorId || event.sectorId === sector),
          ),
          auditTime(80),
        );
        // The server snapshot is authoritative after every event and reconnection.
        const refresh = merge(changes, this.connectionChanges, timer(15_000, 15_000));
        return refresh.pipe(
          switchMap(() =>
            load().pipe(
              map((items) => ({
                establishment,
                floor,
                sector,
                items: items.filter((el) => el.sectorId === sector),
                error: false,
              })),
              catchError(() => of({ establishment, floor, sector, items: [], error: true })),
            ),
          ),
        );
      }),
    ),
  );
  readonly layout = computed(() => {
    const view = this.snapshot();
    const scope = this.selectionScope();
    const sector = this.sector();
    if (
      !sector ||
      !view ||
      view.establishment !== scope.establishment ||
      view.floor !== scope.floor ||
      view.sector !== sector.id
    ) {
      return LAYOUT_VACIO;
    }
    const appearance = normalizeLayoutStyle(sector.appearance);
    return {
      ...LAYOUT_VACIO,
      floorId: scope.floor ?? '',
      name: sector.name,
      size: { width: sector.width, height: sector.height },
      ...(appearance.room ? { appearance: appearance.room } : {}),
      elements: view.items.map((item) =>
        withElementFinish(mapApiElementToLayoutElement(item), appearance.elements[item.id]),
      ),
    };
  });
  readonly counts = computed(() => {
    const counts: Record<ElementState, number> = {
      AVAILABLE: 0,
      OCCUPIED: 0,
      RESERVED: 0,
      CLEANING: 0,
      OUT_OF_SERVICE: 0,
    };
    for (const element of this.layout().elements) {
      if (element.reservable) counts[element.state]++;
    }
    return counts;
  });
  readonly selected = computed(() =>
    this.layout().elements.find((el) => el.id === this.selectedId()),
  );
  readonly selectedReservation = computed(() => this.reservationFor(this.selectedId()));

  reservationFor(elementId: string | null) {
    if (!elementId) return undefined;
    const reservations = this.data
      .reservations()
      .filter(
        (reservation) =>
          isBlockingReservation(reservation) &&
          Date.parse(reservation.endsAt) > this.data.now() &&
          [...reservation.spaceElementIds].includes(elementId),
      )
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    const reservation = reservations[0];
    return reservation ? { reservation, customerName: reservation.customerName } : undefined;
  }
  readonly error = computed(() => {
    const floors = this.floorResult();
    const sectors = this.sectorResult();
    const view = this.snapshot();
    return (
      (floors?.id === this.establishmentId() && floors?.error) ||
      (sectors?.establishment === this.establishmentId() &&
        sectors?.id === this.floorId() &&
        sectors?.error) ||
      (view?.establishment === this.establishmentId() &&
        view?.floor === this.floorId() &&
        view?.sector === this.sector()?.id &&
        view?.error)
    );
  });
  readonly loading = computed(() => {
    const id = this.establishmentId();
    if (!id) return false;
    if (this.floorResult()?.id !== id) return true;
    const floor = this.floorId();
    if (floor && (this.sectorResult()?.id !== floor || this.sectorResult()?.establishment !== id))
      return true;
    const sector = this.sector()?.id;
    return Boolean(
      sector &&
      (this.snapshot()?.establishment !== id ||
        this.snapshot()?.floor !== floor ||
        this.snapshot()?.sector !== sector),
    );
  });

  constructor() {
    let locatedQuery: ReturnType<typeof this.routeQuery>;
    effect(() => {
      const query = this.routeQuery();
      const elementId = query?.get('elementId');
      const establishmentId = this.establishmentId();
      const requested = query?.get('establishmentId');
      if (
        !elementId ||
        !establishmentId ||
        (requested && requested !== establishmentId) ||
        query === locatedQuery
      )
        return;
      const requestedFloor = query?.get('floorId');
      const requestedSector = query?.get('sectorId');
      const item =
        requestedFloor && requestedSector
          ? undefined
          : this.data.elements().find(({ element }) => element.id === elementId);
      const floor = requestedFloor ?? item?.floorId;
      const sector = requestedSector ?? item?.sectorId;
      if (!floor || !sector || !this.floors().some(({ id }) => id === floor)) return;
      locatedQuery = query;
      this.location.set({ floorId: floor, sectorId: sector, elementId });
      this.floorChoice.set(floor);
    });

    effect(() => {
      const destination = this.location();
      if (!destination || this.floorId() !== destination.floorId) return;
      if (this.sectors().some(({ id }) => id === destination.sectorId)) {
        this.sectorChoice.set(destination.sectorId);
      }
      if (
        this.sector()?.id === destination.sectorId &&
        this.layout().elements.some(({ id }) => id === destination.elementId)
      ) {
        this.selectedId.set(destination.elementId);
        this.location.set(null);
      }
    });
    effect(() => {
      const query = this.routeQuery();
      const date = query?.get('date');
      const time = query?.get('time');
      const parties = query?.get('partySize');
      const establishmentId = this.establishmentId();
      const requestedEstablishment = query?.get('establishmentId');
      if (
        !establishmentId ||
        query?.has('elementId') ||
        (requestedEstablishment && requestedEstablishment !== establishmentId) ||
        !date ||
        !time ||
        !parties
      )
        return;
      untracked(() => {
        this.quickDate.set(date);
        this.quickTime.set(time);
        this.quickPeople.set(Number(parties));
        this.searchQuick();
      });
    });
  }

  selectFloor(id: string): void {
    this.location.set(null);
    if (this.floors().some((floor) => floor.id === id)) this.floorChoice.set(id);
  }

  selectSector(id: string): void {
    this.location.set(null);
    if (this.sectors().some((sector) => sector.id === id)) this.sectorChoice.set(id);
  }

  locate(item: LocatedElement): void {
    if (!this.floors().some(({ id }) => id === item.floorId)) return;
    this.location.set({
      floorId: item.floorId,
      sectorId: item.sectorId,
      elementId: item.element.id,
    });
    this.floorChoice.set(item.floorId);
  }

  searchQuick(): void {
    const establishment = this.establishment();
    const partySize = this.quickPeople();
    const startsAt = establishment
      ? establishmentInstant(`${this.quickDate()}T${this.quickTime()}`, establishment.timezone)
      : null;
    if (!establishment || !startsAt || !Number.isSafeInteger(partySize) || partySize < 1) {
      this.submittedQuick.set('invalid');
      return;
    }
    const endsAt = new Date(Date.parse(startsAt) + this.quickMinutes * 60_000).toISOString();
    this.submittedQuick.set({
      establishmentId: establishment.id,
      startsAt,
      endsAt,
      partySize,
      excludeElementId: this.alternativeId(),
    });
    this.data.refresh();
  }

  findAlternative(incident: OperationalIncident): void {
    const establishment = this.establishment();
    if (!establishment) return;
    const nextMinute = Math.ceil((this.data.now() + 60_000) / 60_000) * 60_000;
    const start = new Date(Math.max(nextMinute, Date.parse(incident.reservation.startsAt)));
    const local = establishmentWallTime(start.toISOString(), establishment.timezone);
    if (!local) return;
    this.quickDate.set(local.slice(0, 10));
    this.quickTime.set(local.slice(11));
    this.quickPeople.set(incident.reservation.partySize ?? 0);
    this.alternativeId.set(incident.element.id);
    if (incident.reservation.partySize) this.searchQuick();
  }

  updateSelectedState(state: ElementState): void {
    const selected = this.selected();
    const sectorId = this.sector()?.id;
    if (!sectorId || !selected?.reservable) return;
    this.updateState(sectorId, selected.id, selected.state, state);
  }

  updateIncidentState(incident: OperationalIncident): void {
    const current = this.incidents().find(({ id }) => id === incident.id);
    if (!current?.conflict || current.element.state !== 'CLEANING') return;
    this.updateState(current.sectorId, current.element.id, 'CLEANING', 'AVAILABLE');
  }

  private updateState(
    sectorId: string,
    elementId: string,
    expectedState: ElementState,
    state: ElementState,
  ): void {
    if (!this.canUpdateState() || this.stateUpdating()) return;
    const establishmentId = this.establishmentId();
    this.stateUpdating.set(true);
    this.stateError.set(false);
    this.operations
      .updateSpaceElementState({
        sectorId,
        elementId,
        spaceElementStateUpdateRequest: { state, expectedState },
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.stateUpdating.set(false)),
      )
      .subscribe({
        next: () => {
          this.retry();
          this.data.refresh();
        },
        error: () => {
          if (this.establishmentId() !== establishmentId) return;
          this.stateError.set(true);
          this.retry();
          this.data.refresh();
        },
      });
  }

  retry(): void {
    this.retryCount.update((count) => count + 1);
  }
}
