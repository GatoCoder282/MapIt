import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { PublicReservation, PublicReservationCreateRequest } from '@mapit/api-client';
import { finalize } from 'rxjs';

import { STRINGS } from '../../../core/strings';
import { BookingApi } from '../data/booking-api';

export type BookingStatus = 'idle' | 'submitting' | 'success' | 'error';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Estado del formulario público de reserva, aislado de la vista. */
@Injectable()
export class BookingStore {
  private readonly api = inject(BookingApi);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<BookingStatus>('idle');
  readonly submitted = signal(false);
  readonly reservation = signal<PublicReservation | null>(null);
  readonly errorMessage = signal('');

  readonly date = signal('');
  readonly startTime = signal('19:00');
  readonly endTime = signal('21:00');
  readonly fullName = signal('');
  readonly email = signal('');
  readonly phone = signal('');

  readonly dateError = computed(() => {
    if (!this.submitted()) return '';
    const value = this.date();
    if (!DATE_PATTERN.test(value) || Number.isNaN(Date.parse(`${value}T12:00:00Z`))) {
      return STRINGS.booking.dateInvalid;
    }
    return '';
  });

  readonly timeError = computed(() => {
    if (!this.submitted()) return '';
    const start = this.startTime();
    const end = this.endTime();
    if (!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end) || start >= end) {
      return STRINGS.booking.timeInvalid;
    }
    return '';
  });

  readonly fullNameError = computed(() => {
    if (!this.submitted()) return '';
    return this.fullName().trim().length >= 2 ? '' : STRINGS.booking.fullNameInvalid;
  });

  readonly emailError = computed(() => {
    if (!this.submitted()) return '';
    return EMAIL_PATTERN.test(this.email().trim()) ? '' : STRINGS.booking.emailInvalid;
  });

  readonly phoneError = computed(() => {
    if (!this.submitted()) return '';
    return this.phone().trim().length <= 32 ? '' : STRINGS.booking.phoneInvalid;
  });

  readonly valid = computed(
    () =>
      this.dateError() === '' &&
      this.timeError() === '' &&
      this.fullNameError() === '' &&
      this.emailError() === '' &&
      this.phoneError() === '',
  );

  initialize(date: string): void {
    if (this.date() !== '') return;
    this.date.set(DATE_PATTERN.test(date) ? date : today());
  }

  setDate(value: string): void {
    this.date.set(value);
    this.clearError();
  }

  setStartTime(value: string): void {
    this.startTime.set(value);
    this.clearError();
  }

  setEndTime(value: string): void {
    this.endTime.set(value);
    this.clearError();
  }

  setFullName(value: string): void {
    this.fullName.set(value);
    this.clearError();
  }

  setEmail(value: string): void {
    this.email.set(value);
    this.clearError();
  }

  setPhone(value: string): void {
    this.phone.set(value);
    this.clearError();
  }

  submit(tenantSlug: string, establishmentSlug: string, elementId: string): void {
    if (this.status() === 'submitting') return;
    this.submitted.set(true);
    this.errorMessage.set('');
    if (!this.valid()) return;

    const request: PublicReservationCreateRequest = {
      date: this.date(),
      startTime: this.startTime(),
      endTime: this.endTime(),
      spaceElementIds: new Set([elementId]),
      customer: {
        fullName: this.fullName().trim(),
        email: this.email().trim(),
        phone: this.phone().trim() || null,
      },
    };

    this.status.set('submitting');
    this.api
      .create(tenantSlug, establishmentSlug, request)
      .pipe(
        finalize(() => {
          if (this.status() === 'submitting') this.status.set('error');
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (reservation) => {
          this.reservation.set(reservation);
          this.status.set('success');
        },
        error: (error: unknown) => {
          this.reservation.set(null);
          this.errorMessage.set(this.describe(error));
          this.status.set('error');
        },
      });
  }

  reset(): void {
    this.status.set('idle');
    this.submitted.set(false);
    this.reservation.set(null);
    this.errorMessage.set('');
  }

  private clearError(): void {
    if (this.status() === 'error') {
      this.errorMessage.set('');
      this.status.set('idle');
    }
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

function today(): string {
  return new Date().toLocaleDateString('en-CA');
}
