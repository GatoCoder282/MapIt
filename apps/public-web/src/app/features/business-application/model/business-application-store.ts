import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import type { BusinessVertical } from '@mapit/api-client';
import { FeatureFlagService } from '@mapit/feature-flags';

import { STRINGS } from '../../../core/strings';
import { BusinessApplicationApi } from '../data/business-application-api';

@Injectable()
export class BusinessApplicationStore {
  private readonly api = inject(BusinessApplicationApi);
  private readonly flags = inject(FeatureFlagService);
  private readonly destroyRef = inject(DestroyRef);
  readonly enabled = this.flags.isEnabled('mapit.s6.business-applications');
  readonly businessName = signal('');
  readonly vertical = signal<BusinessVertical | ''>('');
  readonly location = signal('');
  readonly contactName = signal('');
  readonly contactEmail = signal('');
  readonly contactPhone = signal('');
  readonly submitted = signal(false);
  readonly pending = signal(false);
  readonly success = signal(false);
  readonly error = signal('');
  readonly invalid = computed(
    () =>
      this.businessName().trim().length < 2 ||
      this.businessName().trim().length > 120 ||
      !this.vertical() ||
      this.location().trim().length < 2 ||
      this.location().trim().length > 200 ||
      this.contactName().trim().length < 2 ||
      this.contactName().trim().length > 120 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.contactEmail().trim()) ||
      this.contactEmail().trim().length > 254 ||
      (this.contactPhone().trim() !== '' &&
        (this.contactPhone().trim().length < 6 || this.contactPhone().trim().length > 32)),
  );

  submit(): void {
    this.submitted.set(true);
    this.error.set('');
    if (!this.enabled() || this.invalid() || this.pending()) return;
    this.pending.set(true);
    this.api
      .submit({
        businessName: this.businessName().trim(),
        vertical: this.vertical() as BusinessVertical,
        location: this.location().trim(),
        contactName: this.contactName().trim(),
        contactEmail: this.contactEmail().trim(),
        ...(this.contactPhone().trim() ? { contactPhone: this.contactPhone().trim() } : {}),
      })
      .pipe(
        finalize(() => this.pending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.success.set(true),
        error: (failure: unknown) => {
          this.error.set(
            failure instanceof HttpErrorResponse && failure.status === 429
              ? STRINGS.businessApplication.rateLimited
              : STRINGS.businessApplication.failed,
          );
        },
      });
  }
}
