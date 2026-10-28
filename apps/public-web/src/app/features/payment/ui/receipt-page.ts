import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideArrowLeft,
  LucideCheck,
  LucideClock3,
  LucideQrCode,
  LucideShieldCheck,
} from '@lucide/angular';
import { PREVIEW_RECEIPT_PATH } from '@mapit/api-client';

import { STRINGS } from '../../../core/strings';
import { PublicEstablishmentIdentity } from '../../../core/public-establishment-identity';
import { PublicSpaceSummary } from '../../../core/public-space';
import { ReceiptStore } from '../model/receipt-store';
import { PaymentQrImage } from './payment-qr';

@Component({
  selector: 'mp-receipt-page',
  imports: [
    RouterLink,
    PublicEstablishmentIdentity,
    PublicSpaceSummary,
    PaymentQrImage,
    LucideArrowLeft,
    LucideCheck,
    LucideClock3,
    LucideQrCode,
    LucideShieldCheck,
  ],
  providers: [ReceiptStore],
  templateUrl: './receipt-page.html',
  styleUrls: ['./payment-pages.scss', './receipt-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceiptPage {
  readonly token = input.required<string>();
  readonly tenantSlug = input('');
  readonly establishmentSlug = input('');
  protected readonly store = inject(ReceiptStore);
  protected readonly strings = STRINGS.payment;
  protected readonly receiptPath = computed(() =>
    this.store.previewEnabled()
      ? PREVIEW_RECEIPT_PATH
      : '/comprobante/' +
        this.token() +
        '?' +
        new URLSearchParams({
          tenantSlug: this.tenantSlug(),
          establishmentSlug: this.establishmentSlug(),
        }).toString(),
  );
  protected readonly reservationStatus = computed(() => {
    const labels: Readonly<Record<string, string>> = this.strings.statusLabels;
    const status = this.store.receipt()?.reservation.status ?? '';
    return labels[status] ?? status;
  });

  constructor() {
    effect(() => {
      const token = this.token();
      const tenantSlug = this.tenantSlug();
      const establishmentSlug = this.establishmentSlug();
      this.store.previewEnabled();
      untracked(() => {
        void this.store.load(token, tenantSlug, establishmentSlug);
      });
    });
  }

  protected retry(): void {
    void this.store.load(this.token(), this.tenantSlug(), this.establishmentSlug());
  }
}
