import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import type { PublicAvailabilityMap } from '@mapit/api-client';
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
  private routeKey = '';
  readonly status = signal<AvailabilityStatus>('idle');
  readonly failure = signal('');
  readonly date = signal('');
  readonly startTime = signal('');
  readonly endTime = signal('');
  readonly response = signal<PublicAvailabilityMap | null>(null);
  readonly floorId = signal('');
  readonly sectorId = signal('');
  readonly selectedElementId = signal<string | null>(null);
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
  ): void {
    const key = JSON.stringify([tenantSlug, establishmentSlug, date, startTime, endTime]);
    if (key === this.routeKey) return;
    this.routeKey = key;
    if (
      tenantSlug === this.scope.tenantSlug &&
      establishmentSlug === this.scope.establishmentSlug &&
      date === this.date() &&
      startTime === this.startTime() &&
      endTime === this.endTime()
    )
      return;
    this.scope = { tenantSlug, establishmentSlug };
    this.invalidate();
    this.date.set(date);
    this.startTime.set(startTime);
    this.endTime.set(endTime);
  }
  setDate(value: string): void {
    this.invalidate();
    this.date.set(value);
  }
  setStartTime(value: string): void {
    this.invalidate();
    this.startTime.set(value);
  }
  setEndTime(value: string): void {
    this.invalidate();
    this.endTime.set(value);
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
  async search(): Promise<void> {
    this.invalidate();
    if (!validPublicInterval(this.date(), this.startTime(), this.endTime())) {
      this.failure.set(STRINGS.availability.intervalRequired);
      return;
    }
    const version = this.version;
    const { tenantSlug, establishmentSlug } = this.scope;
    const date = this.date(),
      start = this.startTime(),
      end = this.endTime();
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
    } catch {
      if (version !== this.version) return;
      this.status.set('error');
      this.failure.set(STRINGS.availability.error);
    }
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
