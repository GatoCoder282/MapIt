import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import type { PublicAvailabilityMap, PublicEstablishmentSummary } from '@mapit/api-client';
import { currentLocaleTag } from '@mapit/i18n';
import { AvailabilityApi } from '../data/availability-api';
import { findPublicSpace, matchesPublicMap, validPublicInterval } from '../../../core/public-space';
import { STRINGS } from '../../../core/strings';
import { publicMapLayout } from '../data/public-map-layout';

export type AvailabilityStatus = 'idle' | 'loading' | 'loaded' | 'error';
@Injectable()
export class AvailabilityStore {
  private readonly api = inject(AvailabilityApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cancel = new Subject<void>();
  private version = 0;
  private scope = { tenantSlug: '', establishmentSlug: '' };
  private venueRequest: Promise<void> | null = null;
  private routeKey = '';
  readonly status = signal<AvailabilityStatus>('idle');
  readonly failure = signal('');
  readonly date = signal('');
  readonly people = signal<number | null>(null);
  readonly startTime = signal('');
  readonly endTime = signal('');
  readonly venue = signal<PublicEstablishmentSummary | null>(null);
  readonly venueStatus = signal<'loading' | 'ready' | 'error'>('loading');
  readonly arrivalOnly = computed(() => this.venue()?.type === 'RESTAURANT');
  readonly requestedEndTime = computed(() => (this.arrivalOnly() ? '' : this.endTime()));
  readonly response = signal<PublicAvailabilityMap | null>(null);
  readonly schedule = computed(() => {
    const data = this.response();
    if (!data?.startTime) return '';
    return this.arrivalOnly() ? data.startTime : `${data.startTime}–${data.endTime}`;
  });
  readonly floorId = signal('');
  readonly sectorId = signal('');
  readonly selectedElementId = signal<string | null>(null);
  private readonly calendarMonth = signal(
    new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), 1)),
  );
  readonly monthLabel = computed(() =>
    new Intl.DateTimeFormat(currentLocaleTag(), {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(this.calendarMonth()),
  );
  readonly weekdays = computed(() => {
    const formatter = new Intl.DateTimeFormat(currentLocaleTag(), {
      weekday: 'short',
      timeZone: 'UTC',
    });
    return Array.from({ length: 7 }, (_, day) =>
      formatter.format(new Date(Date.UTC(2020, 5, 7 + day))),
    );
  });
  readonly calendarDays = computed(() => {
    const month = this.calendarMonth();
    const year = month.getUTCFullYear();
    const index = month.getUTCMonth();
    const offset = month.getUTCDay();
    const count = new Date(Date.UTC(year, index + 1, 0)).getUTCDate();
    const formatter = new Intl.DateTimeFormat(currentLocaleTag(), {
      dateStyle: 'long',
      timeZone: 'UTC',
    });
    return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, cell) => {
      const day = cell - offset + 1;
      if (day < 1 || day > count) return null;
      const date = new Date(Date.UTC(year, index, day));
      return { day, value: date.toISOString().slice(0, 10), label: formatter.format(date) };
    });
  });
  readonly timeChoices = Array.from(
    { length: 48 },
    (_, index) => `${String(Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`,
  );
  readonly availableCount = computed(() =>
    this.floors().reduce(
      (total, floor) =>
        total +
        floor.sectors.reduce(
          (sum, sector) =>
            sum +
            sector.elements.filter(
              (space) => space.selectable && space.availability === 'AVAILABLE',
            ).length,
          0,
        ),
      0,
    ),
  );
  readonly floors = computed(() => this.response()?.floors ?? []);
  readonly floor = computed(() => this.floors().find((item) => item.id === this.floorId()) ?? null);
  readonly sector = computed(
    () => this.floor()?.sectors.find((item) => item.id === this.sectorId()) ?? null,
  );
  readonly elements = computed(() => this.sector()?.elements ?? []);
  readonly spaces = computed(() => {
    const data = this.response();
    return data ? this.elements().map((item) => findPublicSpace(data, item.id)!) : [];
  });
  readonly availableSpaces = computed(() =>
    this.spaces().filter((space) => space.selectable && space.availability === 'AVAILABLE'),
  );
  readonly layout = computed(() => {
    const floor = this.floor(),
      sector = this.sector();
    return floor && sector && sector.width > 0 && sector.height > 0
      ? publicMapLayout(floor, sector)
      : null;
  });
  readonly selectedSpace = computed(() => {
    const data = this.response(),
      id = this.selectedElementId();
    return data && id ? findPublicSpace(data, id) : null;
  });
  readonly canConfirm = computed(
    () =>
      this.status() === 'loaded' &&
      this.response()?.mode === 'INTERVAL' &&
      this.selectedSpace()?.selectable === true &&
      this.selectedSpace()?.availability === 'AVAILABLE',
  );
  constructor() {
    this.destroyRef.onDestroy(() => {
      this.version++;
      this.cancel.next();
      this.cancel.complete();
    });
  }
  configure(
    tenantSlug: string,
    establishmentSlug: string,
    date: string,
    startTime = '',
    endTime = '',
    people = '',
  ): void {
    this.setPeople(people);
    const key = JSON.stringify([tenantSlug, establishmentSlug, date, startTime, endTime]);
    if (key === this.routeKey) return;
    this.routeKey = key;
    const sameVenue =
      tenantSlug === this.scope.tenantSlug && establishmentSlug === this.scope.establishmentSlug;
    const requestedEnd = sameVenue && this.arrivalOnly() ? '' : endTime;
    if (
      sameVenue &&
      date === this.date() &&
      startTime === this.startTime() &&
      requestedEnd === this.requestedEndTime()
    )
      return;
    if (!sameVenue) {
      this.scope = { tenantSlug, establishmentSlug };
      this.venueRequest = null;
      this.venue.set(null);
      void this.loadVenue();
    }
    this.invalidate();
    this.date.set(date);
    this.showDateMonth(date);
    this.startTime.set(startTime);
    this.endTime.set(requestedEnd);
  }
  loadVenue(): Promise<void> {
    if (this.venueRequest && this.venueStatus() !== 'error') return this.venueRequest;
    const scope = this.scope;
    this.venueStatus.set('loading');
    this.venueRequest = firstValueFrom(
      this.api
        .establishment(scope.tenantSlug, scope.establishmentSlug)
        .pipe(takeUntilDestroyed(this.destroyRef)),
    )
      .then((venue) => {
        if (scope !== this.scope) return;
        if (
          venue.tenantSlug !== scope.tenantSlug ||
          venue.establishmentSlug !== scope.establishmentSlug
        )
          throw new Error('venue-scope-mismatch');
        this.venue.set(venue);
        if (this.arrivalOnly()) this.endTime.set('');
        this.venueStatus.set('ready');
      })
      .catch(() => {
        if (scope === this.scope) this.venueStatus.set('error');
      });
    return this.venueRequest;
  }
  setDate(value: string): void {
    this.invalidate();
    this.date.set(value);
    this.showDateMonth(value);
  }
  moveMonth(direction: number): void {
    const month = this.calendarMonth();
    this.calendarMonth.set(
      new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + direction, 1)),
    );
  }
  private showDateMonth(value: string): void {
    const date = new Date(`${value}T12:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    )
      return;
    this.calendarMonth.set(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)));
  }
  setStartTime(value: string): void {
    this.invalidate();
    this.startTime.set(value);
  }
  setEndTime(value: string): void {
    this.invalidate();
    this.endTime.set(value);
  }
  setPeople(value: string): void {
    this.people.set(/^(?:[1-9]|1\d|20)$/.test(value) ? Number(value) : null);
  }
  private invalidate(): void {
    this.version++;
    this.cancel.next();
    this.response.set(null);
    this.selectedElementId.set(null);
    this.floorId.set('');
    this.sectorId.set('');
    this.status.set('idle');
    this.failure.set('');
  }
  async search(selectedId: string | null = null): Promise<void> {
    this.invalidate();
    const version = this.version;
    if (!this.venue()) {
      this.status.set('loading');
      await this.loadVenue();
      if (version !== this.version) return;
      if (!this.venue()) {
        this.status.set('error');
        this.failure.set(STRINGS.venueIdentity.error);
        return;
      }
      this.status.set('idle');
    }
    const end = this.requestedEndTime();
    if (!validPublicInterval(this.date(), this.startTime(), end, this.arrivalOnly())) {
      this.failure.set(
        this.arrivalOnly()
          ? STRINGS.availability.arrivalRequired
          : STRINGS.availability.intervalRequired,
      );
      return;
    }
    const { tenantSlug, establishmentSlug } = this.scope;
    const date = this.date(),
      start = this.startTime();
    this.status.set('loading');
    try {
      const data = await firstValueFrom(
        this.api
          .map(tenantSlug, establishmentSlug, date, start, end)
          .pipe(takeUntil(this.cancel), takeUntilDestroyed(this.destroyRef)),
      );
      if (version !== this.version) return;
      if (!matchesPublicMap(data, tenantSlug, establishmentSlug, date, start, end))
        throw new Error('scope-mismatch');
      this.response.set(data);
      this.floorId.set(data.floors[0]?.id ?? '');
      this.sectorId.set(data.floors[0]?.sectors[0]?.id ?? '');
      this.status.set('loaded');
      if (selectedId) this.restoreSelection(selectedId);
    } catch (error) {
      if (version !== this.version) return;
      this.status.set('error');
      this.failure.set(
        this.arrivalOnly() && error instanceof HttpErrorResponse && error.status === 400
          ? STRINGS.availability.arrivalInvalid
          : STRINGS.availability.error,
      );
    }
  }
  restoreSelection(id: string | null): void {
    this.failure.set('');
    this.selectedElementId.set(null);
    if (!id || this.status() !== 'loaded') return;
    const floor = this.floors().find((item) =>
      item.sectors.some((sector) => sector.elements.some((space) => space.id === id)),
    );
    const sector = floor?.sectors.find((item) => item.elements.some((space) => space.id === id));
    const space = sector?.elements.find((item) => item.id === id);
    if (!floor || !sector || !space?.selectable || space.availability !== 'AVAILABLE') {
      this.failure.set(STRINGS.availability.selectionUnavailable);
      return;
    }
    this.selectFloor(floor.id);
    this.selectSector(sector.id);
    this.select(id);
  }
  selectFloor(id: string): void {
    if (id === this.floorId() || !this.floors().some((item) => item.id === id)) return;
    this.selectedElementId.set(null);
    this.floorId.set(id);
    this.sectorId.set(this.floor()?.sectors[0]?.id ?? '');
  }
  selectSector(id: string): void {
    if (id === this.sectorId() || !this.floor()?.sectors.some((item) => item.id === id)) return;
    this.selectedElementId.set(null);
    this.sectorId.set(id);
  }
  select(id: string | null): void {
    const item = this.elements().find((element) => element.id === id);
    this.selectedElementId.set(
      this.response()?.mode === 'INTERVAL' && item?.selectable && item.availability === 'AVAILABLE'
        ? item.id
        : null,
    );
  }
}
