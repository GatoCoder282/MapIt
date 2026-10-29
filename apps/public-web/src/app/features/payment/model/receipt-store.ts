import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, Injector, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { formatDecimalMoney, type PaymentReceipt } from '@mapit/api-client';
import { Subject, firstValueFrom, takeUntil } from 'rxjs';
import { ReservationAccess } from '../../../core/reservation-access';
import { formatReservationDate, formatReservationTime } from '../data/payment-format';
import { PaymentPreviewApi, PaymentPreviewError } from '../data/payment-preview-api';
import { projectReceipt } from '../data/payment-projection';
import { PublicPaymentApi } from '../data/public-payment-api';
import type { PaymentPageStatus } from './payment-store';
@Injectable()
export class ReceiptStore {
  private readonly api = inject(PaymentPreviewApi);
  private readonly injector = inject(Injector);
  private readonly access = inject(ReservationAccess);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cancelled = new Subject<void>();
  private version = 0;
  private refreshVersion = 0;
  private stopWatch: (() => void) | null = null;
  readonly pageStatus = signal<PaymentPageStatus>('loading');
  readonly receipt = signal<(PaymentReceipt & { token: string }) | null>(null);
  readonly previewEnabled = computed(() => this.api.allowed());
  readonly date = computed(() =>
    this.receipt() ? formatReservationDate(this.receipt()!.reservation) : '',
  );
  readonly time = computed(() =>
    this.receipt() ? formatReservationTime(this.receipt()!.reservation) : '',
  );
  readonly paid = computed(() =>
    this.receipt() ? formatDecimalMoney(this.receipt()!.paidAmount, this.receipt()!.currency) : '',
  );
  readonly total = computed(() =>
    this.receipt()?.totalAmount != null
      ? formatDecimalMoney(this.receipt()!.totalAmount!, this.receipt()!.currency)
      : '',
  );
  readonly balance = computed(() =>
    this.receipt()?.balanceAmount != null
      ? formatDecimalMoney(this.receipt()!.balanceAmount!, this.receipt()!.currency)
      : '',
  );
  readonly checkoutPath = computed(() => {
    const reservation = this.receipt()?.reservation;
    if (!reservation) return null;
    const scope = {
      tenantSlug: reservation.tenantSlug,
      establishmentSlug: reservation.establishmentSlug,
      reservationId: reservation.id,
    };
    return this.previewEnabled() || this.access.read(scope) ? this.access.path(scope) : null;
  });
  readonly checkoutFragment = computed(() => {
    const reservation = this.receipt()?.reservation;
    return reservation && !this.previewEnabled()
      ? this.access.fragment({
          tenantSlug: reservation.tenantSlug,
          establishmentSlug: reservation.establishmentSlug,
          reservationId: reservation.id,
        })
      : null;
  });
  constructor() {
    this.destroyRef.onDestroy(() => {
      this.stopWatch?.();
      this.version++;
      this.cancelled.next();
      this.cancelled.complete();
    });
  }
  async load(token: string, tenantSlug = '', establishmentSlug = ''): Promise<void> {
    const version = ++this.version;
    this.stopWatch?.();
    this.stopWatch = null;
    this.cancelled.next();
    this.receipt.set(null);
    this.pageStatus.set('loading');
    try {
      let receipt: PaymentReceipt;
      if (this.previewEnabled()) {
        const preview = await firstValueFrom(
          this.api
            .receipt(token)
            .pipe(takeUntil(this.cancelled), takeUntilDestroyed(this.destroyRef)),
        );
        if (preview.revoked) throw new PaymentPreviewError('not-found');
        receipt = projectReceipt(preview);
      } else {
        if (
          !/^[A-Za-z0-9_-]{43}$/.test(token) ||
          !/^[a-z0-9][a-z0-9-]{1,62}$/.test(tenantSlug) ||
          !/^[a-z0-9][a-z0-9-]{1,62}$/.test(establishmentSlug)
        )
          throw new PaymentPreviewError('not-found');
        receipt = await firstValueFrom(
          this.injector
            .get(PublicPaymentApi)
            .receipt(tenantSlug, establishmentSlug, token)
            .pipe(takeUntil(this.cancelled), takeUntilDestroyed(this.destroyRef)),
        );
      }
      if (version !== this.version) return;
      if (
        (receipt.token && receipt.token !== token) ||
        receipt.payment.status !== 'CONFIRMED' ||
        !['CONFIRMED', 'ACTIVE'].includes(receipt.reservation.status) ||
        (!this.previewEnabled() &&
          (receipt.reservation.tenantSlug !== tenantSlug ||
            receipt.reservation.establishmentSlug !== establishmentSlug))
      ) {
        this.pageStatus.set('not-found');
        return;
      }
      this.receipt.set({ ...receipt, token });
      this.pageStatus.set('loaded');
      if (!this.previewEnabled()) {
        const scope = { tenantSlug, establishmentSlug, reservationId: receipt.reservation.id };
        this.stopWatch = this.injector.get(PublicPaymentApi).watch(
          scope,
          () => {
            void this.refresh(token, tenantSlug, establishmentSlug, version);
          },
          () => undefined,
        );
      }
    } catch (error) {
      if (version !== this.version) return;
      this.pageStatus.set(
        error instanceof PaymentPreviewError
          ? error.kind
          : error instanceof HttpErrorResponse && [403, 404, 410].includes(error.status)
            ? 'not-found'
            : 'error',
      );
    }
  }

  private async refresh(
    token: string,
    tenantSlug: string,
    establishmentSlug: string,
    version: number,
  ): Promise<void> {
    const refresh = ++this.refreshVersion;
    try {
      const receipt = await firstValueFrom(
        this.injector
          .get(PublicPaymentApi)
          .receipt(tenantSlug, establishmentSlug, token)
          .pipe(takeUntil(this.cancelled), takeUntilDestroyed(this.destroyRef)),
      );
      if (version !== this.version || refresh !== this.refreshVersion) return;
      if (
        (receipt.token && receipt.token !== token) ||
        receipt.payment.status !== 'CONFIRMED' ||
        !['CONFIRMED', 'ACTIVE'].includes(receipt.reservation.status) ||
        receipt.reservation.tenantSlug !== tenantSlug ||
        receipt.reservation.establishmentSlug !== establishmentSlug
      ) {
        this.receipt.set(null);
        this.pageStatus.set('not-found');
        return;
      }
      this.receipt.set({ ...receipt, token });
      this.pageStatus.set('loaded');
    } catch (error) {
      if (version !== this.version || refresh !== this.refreshVersion) return;
      this.receipt.set(null);
      this.pageStatus.set(
        error instanceof HttpErrorResponse && [403, 404, 410].includes(error.status)
          ? 'not-found'
          : 'error',
      );
    }
  }
}
