import { computed, effect, inject, Injectable } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ReservationsService, SpacesService, type Reservation } from '@mapit/api-client';
import { AuthSession } from '@mapit/auth';
import { FeatureFlagService } from '@mapit/feature-flags';
import { type SpaceElement } from '@mapit/map-engine';
import { RealtimeClient } from '@mapit/realtime';
import {
  auditTime,
  catchError,
  EMPTY,
  expand,
  forkJoin,
  map,
  merge,
  of,
  reduce,
  Subject,
  switchMap,
  timer,
} from 'rxjs';
import { EstablishmentContext } from './establishment-context';
import { RuntimeConfigStore } from './runtime-config';
import { mapApiElementToLayoutElement } from './spatial-layout';

const MINUTE = 60_000;
const PREPARATION_MINUTES = 15;
export const QUICK_RESERVATION_MINUTES = 90;
export const RESERVATION_PREPARATION_MINUTES = PREPARATION_MINUTES;
const priorityOrder = ['critical', 'urgent', 'preventive'] as const;

type MonitorReservation = Pick<
  Reservation,
  'id' | 'startsAt' | 'endsAt' | 'status' | 'customerName' | 'partySize'
> & { spaceElementIds: Iterable<string> };

export interface LocatedElement {
  element: SpaceElement;
  floorId: string;
  floorName: string;
  sectorId: string;
  sectorName: string;
}

export interface OperationalIncident extends LocatedElement {
  id: string;
  reservation: MonitorReservation;
  customerName: string | null;
  priority: (typeof priorityOrder)[number];
  minutes: number;
  conflict: boolean;
}

export interface IncidentThresholds {
  critical: number;
  urgent: number;
  preventive: number;
}

const DEFAULT_THRESHOLDS: IncidentThresholds = { critical: 5, urgent: 20, preventive: 45 };

function thresholds(value: Partial<IncidentThresholds> | undefined): IncidentThresholds {
  const result = { ...DEFAULT_THRESHOLDS, ...value };
  return Number.isFinite(result.critical) &&
    Number.isFinite(result.urgent) &&
    Number.isFinite(result.preventive) &&
    0 <= result.critical &&
    result.critical <= result.urgent &&
    result.urgent <= result.preventive
    ? result
    : DEFAULT_THRESHOLDS;
}

function isUpcoming(reservation: MonitorReservation): boolean {
  return reservation.status === 'CREATED' || reservation.status === 'CONFIRMED';
}

export function isBlockingReservation(reservation: MonitorReservation): boolean {
  return isUpcoming(reservation) || reservation.status === 'ACTIVE';
}

export function reservationIncidents(
  elements: readonly LocatedElement[],
  reservations: readonly MonitorReservation[],
  now: number,
  window: IncidentThresholds,
): OperationalIncident[] {
  const byId = new Map(elements.map((item) => [item.element.id, item]));
  const incidents: OperationalIncident[] = [];

  for (const reservation of reservations) {
    if (!isUpcoming(reservation) || Date.parse(reservation.endsAt) <= now) continue;
    const remaining = (Date.parse(reservation.startsAt) - now) / MINUTE;
    if (!Number.isFinite(remaining) || remaining > window.preventive) continue;

    for (const elementId of reservation.spaceElementIds) {
      const item = byId.get(elementId);
      if (!item) continue;
      const { state } = item.element;
      const conflict =
        state === 'OCCUPIED' ||
        state === 'OUT_OF_SERVICE' ||
        (state === 'CLEANING' && remaining <= PREPARATION_MINUTES);
      if (!conflict && remaining < 0) continue;
      const priority =
        conflict && remaining <= window.critical
          ? 'critical'
          : conflict && remaining <= window.urgent
            ? 'urgent'
            : 'preventive';
      incidents.push({
        ...item,
        id: `${reservation.id}:${elementId}`,
        reservation,
        customerName: reservation.customerName ?? null,
        priority,
        minutes: Math.max(0, Math.ceil(remaining)),
        conflict,
      });
    }
  }
  return incidents.sort(
    (a, b) =>
      priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority) ||
      a.minutes - b.minutes ||
      a.id.localeCompare(b.id),
  );
}

export function availableQuickElements(
  elements: readonly LocatedElement[],
  reservations: readonly MonitorReservation[],
  startsAt: string,
  endsAt: string,
  people: number,
  now: number,
): LocatedElement[] {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  if (start <= now) return [];
  const preparation = PREPARATION_MINUTES * MINUTE;
  const conflicts = new Set(
    reservations
      .filter(
        (reservation) =>
          isBlockingReservation(reservation) &&
          Date.parse(reservation.startsAt) < end + preparation &&
          start - preparation < Date.parse(reservation.endsAt),
      )
      .flatMap((reservation) => [...reservation.spaceElementIds]),
  );
  return elements
    .filter(({ element }) => {
      const { capacity, id, state, type } = element;
      return (
        type === 'TABLE' &&
        capacity !== null &&
        capacity >= people &&
        state !== 'OUT_OF_SERVICE' &&
        (state === 'AVAILABLE' || start - now > preparation) &&
        !conflicts.has(id)
      );
    })
    .sort(
      (a, b) =>
        (a.element.capacity ?? 0) - (b.element.capacity ?? 0) ||
        a.element.label.localeCompare(b.element.label),
    );
}

@Injectable({ providedIn: 'root' })
export class OperationalMapData {
  private readonly spaces = inject(SpacesService);
  private readonly bookings = inject(ReservationsService);
  private readonly realtime = inject(RealtimeClient);
  private readonly session = inject(AuthSession);
  private readonly context = inject(EstablishmentContext);
  private readonly runtime = inject(RuntimeConfigStore, { optional: true });
  private readonly enabled = inject(FeatureFlagService).isEnabled('operations.space-monitor');
  private readonly reload = new Subject<void>();
  private readonly scope = computed(() =>
    this.enabled() && this.context.status() === 'ready'
      ? (this.context.active()?.id ?? null)
      : null,
  );
  private readonly connectionChanges = toObservable(this.realtime.connectionState);
  readonly now = toSignal(timer(0, 1000).pipe(map(() => Date.now())), {
    initialValue: Date.now(),
  });

  private readonly response = toSignal(
    toObservable(this.scope).pipe(
      switchMap((establishmentId) => {
        if (!establishmentId) return of(null);
        const live = merge(
          this.realtime.subscribeEstablishment(establishmentId),
          this.realtime.subscribeEstablishmentPayments(establishmentId),
          this.realtime.subscribeEstablishmentReservations(establishmentId),
        ).pipe(auditTime(100));
        return merge(live, this.connectionChanges, timer(15_000, 15_000), this.reload).pipe(
          switchMap(() =>
            forkJoin({
              elements: this.spaces.listFloorsByEstablishment({ establishmentId }).pipe(
                switchMap((floors) =>
                  floors.length
                    ? forkJoin(floors.map(({ id }) => this.spaces.getFloorLayout({ floorId: id })))
                    : of([]),
                ),
                map((floors) =>
                  floors.flatMap(({ floor, sectors }) =>
                    sectors.flatMap((sector) =>
                      sector.elements.map((element): LocatedElement => ({
                        element: mapApiElementToLayoutElement(element),
                        floorId: floor.id,
                        floorName: floor.name,
                        sectorId: sector.id,
                        sectorName: sector.name,
                      })),
                    ),
                  ),
                ),
              ),
              reservations: this.loadReservations(establishmentId),
            }).pipe(
              map(({ elements, reservations }) => ({
                establishmentId,
                elements,
                reservations,
                failed: false,
              })),
              catchError(() =>
                of({ establishmentId, elements: [], reservations: [], failed: true }),
              ),
            ),
          ),
        );
      }),
    ),
  );
  readonly snapshot = computed(() => {
    const snapshot = this.response();
    return snapshot?.establishmentId === this.scope() ? snapshot : null;
  });
  readonly status = computed(() =>
    !this.snapshot() ? 'loading' : this.snapshot()?.failed ? 'error' : 'ready',
  );
  readonly elements = computed(() => this.snapshot()?.elements ?? []);
  readonly reservations = computed(() => this.snapshot()?.reservations ?? []);

  private loadReservations(establishmentId: string) {
    const cutoff = Date.now() - PREPARATION_MINUTES * MINUTE;
    if (this.session.user()?.role !== 'STAFF') {
      return this.bookings
        .listReservations({ establishmentId, endsAfter: new Date(cutoff).toISOString() })
        .pipe(map((items) => items.filter((item) => item.establishmentId === establishmentId)));
    }

    const limit = 100;
    const page = (offset: number) =>
      this.bookings.listEstablishmentReservations({ establishmentId, limit, offset });
    return page(0).pipe(
      expand((result) => {
        const next = result.offset + result.items.length;
        return result.items.length > 0 && next < result.total ? page(next) : EMPTY;
      }),
      reduce(
        (items, result) =>
          items.concat(result.items.filter((item) => Date.parse(item.endsAt) > cutoff)),
        [] as MonitorReservation[],
      ),
    );
  }
  readonly incidents = computed(() =>
    reservationIncidents(
      this.elements(),
      this.reservations(),
      this.now(),
      thresholds(this.runtime?.config().mapIncidentThresholds),
    ),
  );

  constructor() {
    effect(() => {
      if (this.scope()) this.realtime.connect();
    });
  }

  refresh(): void {
    this.reload.next();
  }
}
