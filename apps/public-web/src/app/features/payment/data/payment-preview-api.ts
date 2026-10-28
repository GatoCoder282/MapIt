import { Injectable, inject, isDevMode } from '@angular/core';
import {
  paymentPreviewAllowed,
  PREVIEW_ESTABLISHMENT_SLUG,
  PREVIEW_RECEIPT_TOKEN,
  PREVIEW_RESERVATION_ID,
  PREVIEW_TENANT_SLUG,
  previewPayment,
  previewReceipt,
  previewReservation,
  type PreviewMethod,
  type PreviewPayment,
  type PreviewPaymentStatus,
  type PreviewReceipt,
  type PreviewReservation,
} from '@mapit/api-client';
import { type Observable, map, throwError, timer } from 'rxjs';

import { PublicRuntimeConfig } from '../../../core/runtime-config';
import { STRINGS } from '../../../core/strings';

export interface CheckoutScope {
  readonly tenantSlug: string;
  readonly establishmentSlug: string;
  readonly reservationId: string;
}

export interface CheckoutPreview {
  readonly reservation: PreviewReservation;
  readonly payment: PreviewPayment;
  readonly methods: readonly PreviewMethod[];
}

export class PaymentPreviewError extends Error {
  constructor(readonly kind: 'unavailable' | 'not-found') {
    super(kind);
  }
}

/** Adaptador de demostración explícita. Nunca reemplaza una API financiera fallida. */
@Injectable({ providedIn: 'root' })
export class PaymentPreviewApi {
  private readonly runtime = inject(PublicRuntimeConfig);

  allowed(): boolean {
    return paymentPreviewAllowed(this.runtime.config(), isDevMode());
  }

  checkout(scope: CheckoutScope, status: PreviewPaymentStatus): Observable<CheckoutPreview> {
    if (!this.allowed()) return throwError(() => new PaymentPreviewError('unavailable'));
    if (
      scope.tenantSlug !== PREVIEW_TENANT_SLUG ||
      scope.establishmentSlug !== PREVIEW_ESTABLISHMENT_SLUG ||
      scope.reservationId !== PREVIEW_RESERVATION_ID
    ) {
      return throwError(() => new PaymentPreviewError('not-found'));
    }
    return timer(240).pipe(
      map((): CheckoutPreview => ({
        reservation: {
          ...previewReservation(),
          status: status === 'CONFIRMED' ? 'CONFIRMED' : 'CREATED',
        },
        payment: previewPayment(status),
        methods: [
          {
            id: 'demo-mock',
            name: STRINGS.payment.methods.mock,
            provider: 'MOCK_GATEWAY',
            verification: 'AUTOMATIC',
            staticQrImage: null,
          },
          {
            id: 'demo-static',
            name: STRINGS.payment.methods.static,
            provider: 'STATIC_BANK_QR',
            verification: 'MANUAL',
            staticQrImage: null,
          },
        ],
      })),
    );
  }

  receipt(token: string): Observable<PreviewReceipt> {
    if (!this.allowed()) return throwError(() => new PaymentPreviewError('unavailable'));
    if (token !== PREVIEW_RECEIPT_TOKEN)
      return throwError(() => new PaymentPreviewError('not-found'));
    return timer(240).pipe(map(() => previewReceipt()));
  }
}
