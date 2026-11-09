import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import type { PublicAvailabilityMap, VerticalProfile } from '@mapit/api-client';
import { AvailabilityApi } from '../data/availability-api';
import { findPublicSpace, matchesPublicMap } from '../../../core/public-space';
import {
  fillVerticalText,
  nextDay,
  validVerticalInterval,
  verticalTerms,
} from '../../../core/vertical-booking';
import { STRINGS } from '../../../core/strings';
import { publicMapLayout } from '../data/public-map-layout';

export type AvailabilityStatus = 'idle' | 'loading' | 'loaded' | 'error';
/**
 * ViewModel del buscador público. HU-7.01/7.02: carga el perfil de vertical del establecimiento
 * antes de buscar para pedir turno, noche, evento o estadía (llegada y salida).
 */
@Injectable()
export class AvailabilityStore {
  private readonly api = inject(AvailabilityApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cancel = new Subject<void>();
  private version = 0;
  private scope = { tenantSlug: '', establishmentSlug: '' };
  private routeKey = '';
  private profileKey = '';
  readonly status = signal<AvailabilityStatus>('idle');
  readonly profile = signal<VerticalProfile | null>(null);
  readonly profileStatus = signal<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  readonly endDate = signal('');
  readonly stay = computed(() => this.profile()?.bookingMode === 'STAY');
  readonly terms = computed(() => verticalTerms(this.profile()));
  readonly hint = computed(() =>
    this.profile() ? fillVerticalText(this.terms().hint, this.profile()) : '',
  );
  /** Apagada en Unleash: se ve el plano, pero no se reserva (403 en el backend). */
  readonly bookingDisabled = computed(() => this.profile()?.enabled === false);
  readonly intervalValid = computed(() =>
    validVerticalInterval(
      this.profile(),
      this.date(),
      this.startTime(),
      this.endTime(),
      this.endDate(),
    ),
  );
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
      !this.bookingDisabled() &&
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
    endDate = '',
  ): void {
    const key = JSON.stringify([tenantSlug, establishmentSlug, date, startTime, endTime, endDate]);
    if (key === this.routeKey) return;
    this.routeKey = key;
    this.loadProfile(tenantSlug, establishmentSlug);
    if (
      tenantSlug === this.scope.tenantSlug &&
      establishmentSlug === this.scope.establishmentSlug &&
      date === this.date() &&
      startTime === this.startTime() &&
      endTime === this.endTime() &&
      endDate === this.endDate()
    )
      return;
    this.scope = { tenantSlug, establishmentSlug };
    this.invalidate();
    this.date.set(date);
    this.startTime.set(startTime);
    this.endTime.set(endTime);
    this.endDate.set(endDate);
    this.applyStayDefaults();
  }
  setEndDate(value: string): void {
    this.invalidate();
    this.endDate.set(value);
  }
  private loadProfile(tenantSlug: string, establishmentSlug: string): void {
    const key = JSON.stringify([tenantSlug, establishmentSlug]);
    if (key === this.profileKey) return;
    this.profileKey = key;
    this.profile.set(null);
    this.profileStatus.set('loading');
    this.api
      .profile(tenantSlug, establishmentSlug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile) => {
          if (key !== this.profileKey) return;
          this.profile.set(profile);
          this.profileStatus.set('loaded');
          this.applyStayDefaults();
        },
        // Sin perfil el buscador funciona como antes (fecha y horas del mismo día).
        error: () => {
          if (key === this.profileKey) this.profileStatus.set('error');
        },
      });
  }
  /** En estadía las horas no se piden: son las de check-in/out del perfil. */
  private applyStayDefaults(): void {
    const profile = this.profile();
    if (profile?.bookingMode !== 'STAY') return;
    this.startTime.set(profile.defaultStartTime ?? '');
    this.endTime.set(profile.defaultEndTime ?? '');
    if (!this.endDate() && this.date()) this.endDate.set(nextDay(this.date()));
  }
  setDate(value: string): void {
    this.invalidate();
    this.date.set(value);
    if (this.stay() && value && (!this.endDate() || this.endDate() <= value))
      this.endDate.set(nextDay(value));
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
    if (!this.intervalValid()) {
      this.failure.set(
        this.profile()
          ? fillVerticalText(this.terms().intervalRequired, this.profile())
          : STRINGS.availability.intervalRequired,
      );
      return;
    }
    const version = this.version;
    const { tenantSlug, establishmentSlug } = this.scope;
    const date = this.date(),
      start = this.startTime(),
      end = this.endTime(),
      endDate = this.stay() ? this.endDate() : '';
    this.status.set('loading');
    try {
      const data = await firstValueFrom(
        this.api
          .map(tenantSlug, establishmentSlug, date, start, end, endDate)
          .pipe(takeUntil(this.cancel), takeUntilDestroyed(this.destroyRef)),
      );
      if (version !== this.version) return;
      if (!matchesPublicMap(data, tenantSlug, establishmentSlug, date, start, end, endDate))
        throw new Error('scope-mismatch');
      this.response.set(data);
      // El mapa trae el perfil vigente (incluida la flag): manda sobre el cargado al entrar.
      this.profile.set(data.vertical);
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
