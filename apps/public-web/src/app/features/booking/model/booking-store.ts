import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { currentLocaleTag } from '@mapit/i18n';
import type {
  PublicReservation,
  ReservationCheckout,
  PublicEstablishmentSummary,
} from '@mapit/api-client';
import { Subject, firstValueFrom, takeUntil } from 'rxjs';
import { STRINGS } from '../../../core/strings';
import { BookingApi } from '../data/booking-api';
import { ReservationAccess } from '../../../core/reservation-access';
import {
  findPublicSpace,
  matchesPublicMap,
  validPublicInterval,
  type PublicSpaceDescriptor,
} from '../../../core/public-space';

export type BookingStatus = 'idle' | 'submitting' | 'success' | 'error';
@Injectable({ providedIn: 'root' })
export class BookingStore {
  private readonly api = inject(BookingApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly access = inject(ReservationAccess);
  private readonly cancel = new Subject<void>();
  private version = 0;
  private resolutionVersion = 0;
  private routeKey = '';
  private ownId = '';
  private scope = { tenantSlug: '', establishmentSlug: '', elementId: '' };
  readonly checkoutPath = signal<string | null>(null);
  readonly checkoutFragment = signal<string | null>(null);
  readonly status = signal<BookingStatus>('idle');
  readonly step = signal<'confirm' | 'details' | 'done'>('confirm');
  readonly descriptorStatus = signal<'idle' | 'loading' | 'ready' | 'unavailable' | 'error'>(
    'idle',
  );
  readonly descriptor = signal<PublicSpaceDescriptor | null>(null);
  readonly establishmentName = signal('');
  readonly timezone = signal('');
  readonly venue = signal<PublicEstablishmentSummary | null>(null);
  readonly venueStatus = signal<'loading' | 'ready' | 'error'>('loading');
  readonly ownReservation = signal<ReservationCheckout | null>(null);
  readonly ownStatus = signal<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  readonly ownWhen = computed(() => {
    const reservation = this.ownReservation();
    return reservation
      ? new Intl.DateTimeFormat(currentLocaleTag(), {
          dateStyle: 'long',
          timeStyle: 'short',
          hourCycle: 'h23',
          timeZone: reservation.timezone,
        }).formatRange(new Date(reservation.startsAt), new Date(reservation.endsAt))
      : '';
  });
  readonly submitted = signal(false);
  readonly reservation = signal<PublicReservation | null>(null);
  readonly errorMessage = signal('');
  readonly date = signal('');
  readonly startTime = signal('');
  readonly endTime = signal('');
  readonly fullName = signal('');
  readonly email = signal('');
  readonly phoneNumber = signal('');
  readonly phoneCountry = signal('+591');
  readonly phoneCountries = [
    '+591',
    '+54',
    '+55',
    '+56',
    '+57',
    '+51',
    '+598',
    '+595',
    '+593',
    '+52',
    '+1',
    '+34',
    '+81',
  ] as const;
  readonly phone = computed(() => {
    const number = this.phoneNumber().trim();
    return !number || number.startsWith('+') ? number : `${this.phoneCountry()} ${number}`;
  });
  readonly duration = computed(() => {
    if (!this.intervalValid()) return '';
    const [startHour = 0, startMinute = 0] = this.startTime().split(':').map(Number);
    const [endHour = 0, endMinute = 0] = this.endTime().split(':').map(Number);
    const minutes = (endHour - startHour) * 60 + endMinute - startMinute;
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    const locale = currentLocaleTag();
    return [
      hours
        ? new Intl.NumberFormat(locale, {
            style: 'unit',
            unit: 'hour',
            unitDisplay: 'long',
          }).format(hours)
        : '',
      remainder
        ? new Intl.NumberFormat(locale, {
            style: 'unit',
            unit: 'minute',
            unitDisplay: 'long',
          }).format(remainder)
        : '',
    ]
      .filter(Boolean)
      .join(' ');
  });
  readonly intervalValid = computed(() =>
    validPublicInterval(this.date(), this.startTime(), this.endTime()),
  );
  readonly canConfirm = computed(
    () =>
      this.descriptorStatus() === 'ready' &&
      this.intervalValid() &&
      this.descriptor()?.selectable === true &&
      this.descriptor()?.availability === 'AVAILABLE',
  );
  readonly dateError = computed(() =>
    this.submitted() && !/^\d{4}-\d{2}-\d{2}$/.test(this.date()) ? STRINGS.booking.dateInvalid : '',
  );
  readonly timeError = computed(() =>
    this.submitted() && !this.intervalValid() ? STRINGS.booking.timeInvalid : '',
  );
  readonly fullNameError = computed(() =>
    this.submitted() && (this.fullName().trim().length < 2 || this.fullName().trim().length > 120)
      ? STRINGS.booking.fullNameInvalid
      : '',
  );
  readonly emailError = computed(() =>
    this.submitted() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email().trim())
      ? STRINGS.booking.emailInvalid
      : '',
  );
  readonly phoneError = computed(() =>
    this.submitted() && this.phone().trim().length > 32 ? STRINGS.booking.phoneInvalid : '',
  );
  constructor() {
    this.destroyRef.onDestroy(() => {
      this.version++;
      this.cancel.next();
      this.cancel.complete();
    });
  }
  async configure(
    tenantSlug: string,
    establishmentSlug: string,
    elementId: string,
    date: string,
    startTime = '',
    endTime = '',
    reservationId = '',
  ): Promise<void> {
    const key = JSON.stringify([
      tenantSlug,
      establishmentSlug,
      elementId,
      date,
      startTime,
      endTime,
      reservationId,
    ]);
    if (key === this.routeKey) return;
    this.routeKey = key;
    if (
      reservationId &&
      this.reservation()?.id === reservationId &&
      this.scope.tenantSlug === tenantSlug &&
      this.scope.establishmentSlug === establishmentSlug &&
      this.scope.elementId === elementId
    )
      return;
    const differentVenue =
      tenantSlug !== this.scope.tenantSlug || establishmentSlug !== this.scope.establishmentSlug;
    this.version++;
    this.cancel.next();
    this.scope = { tenantSlug, establishmentSlug, elementId };
    this.ownId = reservationId;
    this.scopeEstablishmentId = '';
    this.date.set(date);
    this.startTime.set(startTime);
    this.endTime.set(endTime);
    this.descriptor.set(null);
    this.descriptorStatus.set('idle');
    this.venue.set(null);
    void this.loadVenue();
    this.errorMessage.set('');
    this.submitted.set(false);
    this.reservation.set(null);
    this.ownReservation.set(null);
    this.ownStatus.set('idle');
    this.checkoutPath.set(null);
    this.checkoutFragment.set(null);
    this.status.set('idle');
    this.step.set('confirm');
    if (differentVenue) {
      this.fullName.set('');
      this.email.set('');
      this.phoneNumber.set('');
      this.phoneCountry.set('+591');
    }
    if (reservationId) {
      this.step.set('done');
      await this.loadOwn(reservationId);
      return;
    }
    if (this.intervalValid()) await this.resolve();
  }
  confirm(): void {
    if (this.canConfirm()) this.step.set('details');
  }
  review(): void {
    if (this.status() !== 'submitting') this.step.set('confirm');
  }
  setFullName(value: string): void {
    if (this.status() !== 'submitting') {
      this.fullName.set(value);
      this.clearError();
    }
  }
  setEmail(value: string): void {
    if (this.status() !== 'submitting') {
      this.email.set(value);
      this.clearError();
    }
  }
  setPhone(value: string): void {
    if (this.status() !== 'submitting') {
      this.phoneNumber.set(value);
      this.clearError();
    }
  }
  setPhoneCountry(value: string): void {
    if (
      this.status() !== 'submitting' &&
      this.phoneCountries.some((country) => country === value)
    ) {
      this.phoneCountry.set(value);
      this.clearError();
    }
  }
  async loadVenue(): Promise<void> {
    const version = this.version;
    const { tenantSlug, establishmentSlug } = this.scope;
    this.venueStatus.set('loading');
    try {
      const venue = await firstValueFrom(
        this.api
          .establishment(tenantSlug, establishmentSlug)
          .pipe(takeUntil(this.cancel), takeUntilDestroyed(this.destroyRef)),
      );
      if (version !== this.version) return;
      if (venue.tenantSlug !== tenantSlug || venue.establishmentSlug !== establishmentSlug)
        throw new Error('venue-scope-mismatch');
      this.venue.set(venue);
      this.venueStatus.set('ready');
    } catch {
      if (version === this.version) this.venueStatus.set('error');
    }
  }
  private clearError(): void {
    if (this.status() === 'error') {
      this.status.set('idle');
      this.errorMessage.set('');
    }
  }
  async resolve(keepError = false): Promise<boolean> {
    if (!this.intervalValid() || this.step() === 'done') return false;
    const version = this.version;
    const resolution = ++this.resolutionVersion;
    const { tenantSlug, establishmentSlug, elementId } = this.scope;
    const date = this.date(),
      start = this.startTime(),
      end = this.endTime();
    this.descriptor.set(null);
    this.descriptorStatus.set('loading');
    if (!keepError) this.errorMessage.set('');
    try {
      const data = await firstValueFrom(
        this.api
          .map(tenantSlug, establishmentSlug, date, start, end)
          .pipe(takeUntil(this.cancel), takeUntilDestroyed(this.destroyRef)),
      );
      if (version !== this.version || resolution !== this.resolutionVersion) return false;
      if (!matchesPublicMap(data, tenantSlug, establishmentSlug, date, start, end))
        throw new Error('scope-mismatch');
      this.scopeEstablishmentId = data.establishmentId;
      const descriptor = findPublicSpace(data, elementId);
      this.descriptor.set(descriptor);
      this.establishmentName.set(data.establishmentName);
      this.timezone.set(data.timezone);
      const available = descriptor?.selectable === true && descriptor.availability === 'AVAILABLE';
      this.descriptorStatus.set(available ? 'ready' : 'unavailable');
      return available;
    } catch {
      if (version === this.version && resolution === this.resolutionVersion) {
        this.descriptor.set(null);
        this.descriptorStatus.set('error');
      }
      return false;
    }
  }
  async submit(): Promise<void> {
    if (this.status() === 'submitting' || this.step() !== 'details' || !this.canConfirm()) return;
    this.submitted.set(true);
    this.errorMessage.set('');
    if (!this.intervalValid() || this.fullNameError() || this.emailError() || this.phoneError())
      return;
    const version = this.version;
    const { tenantSlug, establishmentSlug, elementId } = this.scope;
    this.status.set('submitting');
    if (!(await this.resolve())) {
      if (version === this.version) {
        this.status.set('error');
        this.step.set('confirm');
        this.errorMessage.set(STRINGS.booking.errors.unavailable);
      }
      return;
    }
    if (version !== this.version) return;
    try {
      const reservation = await firstValueFrom(
        this.api
          .create(tenantSlug, establishmentSlug, {
            date: this.date(),
            startTime: this.startTime(),
            endTime: this.endTime(),
            spaceElementIds: new Set([elementId]),
            customer: {
              fullName: this.fullName().trim(),
              email: this.email().trim(),
              phone: this.phone().trim() || null,
            },
          })
          .pipe(takeUntil(this.cancel), takeUntilDestroyed(this.destroyRef)),
      );
      if (version !== this.version) return;
      if (
        reservation.establishmentId !== this.scopeEstablishmentId ||
        ![...reservation.spaceElementIds].includes(elementId)
      )
        throw new Error('reservation-scope-mismatch');
      this.reservation.set(reservation);
      this.ownId = reservation.id;
      const scope = { tenantSlug, establishmentSlug, reservationId: reservation.id };
      if (this.access.save(scope, reservation.accessToken, reservation.accessExpiresAt))
        this.setCheckout(scope);
      this.step.set('done');
      this.status.set('success');
      this.descriptor.set(null);
      await this.loadOwn(reservation.id);
    } catch (error) {
      if (version !== this.version) return;
      this.status.set('error');
      this.errorMessage.set(this.describe(error));
      if (error instanceof HttpErrorResponse && error.status === 409) {
        this.step.set('confirm');
        await this.resolve(true);
      }
    }
  }
  private scopeEstablishmentId = '';
  async loadOwn(reservationId = this.ownId): Promise<void> {
    if (!reservationId) return;
    const version = this.version;
    const scope = {
      tenantSlug: this.scope.tenantSlug,
      establishmentSlug: this.scope.establishmentSlug,
      reservationId,
    };
    this.ownStatus.set('loading');
    try {
      const checkout = await firstValueFrom(
        this.api.checkout(scope).pipe(takeUntil(this.cancel), takeUntilDestroyed(this.destroyRef)),
      );
      if (version !== this.version) return;
      const reservation = checkout.reservation;
      if (
        reservation.id !== reservationId ||
        reservation.tenantSlug !== scope.tenantSlug ||
        reservation.establishmentSlug !== scope.establishmentSlug ||
        !reservation.spaces.some((space) => space.id === this.scope.elementId)
      )
        throw new Error('reservation-scope-mismatch');
      this.ownReservation.set(reservation);
      this.ownStatus.set('loaded');
      this.status.set('success');
      this.setCheckout(scope);
    } catch {
      if (version === this.version) this.ownStatus.set('error');
    }
  }
  private setCheckout(scope: {
    tenantSlug: string;
    establishmentSlug: string;
    reservationId: string;
  }): void {
    this.checkoutPath.set(this.access.path(scope));
    this.checkoutFragment.set(this.access.fragment(scope));
  }
  private describe(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 409) return STRINGS.booking.errors.unavailable;
      if (error.status === 404) return STRINGS.booking.errors.notFound;
      if (error.status === 400) return STRINGS.booking.errors.invalid;
    }
    return STRINGS.booking.errors.generic;
  }
}
