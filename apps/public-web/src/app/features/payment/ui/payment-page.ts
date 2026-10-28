import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  LucideArrowLeft,
  LucideCheck,
  LucideChevronDown,
  LucideClock3,
  LucideCreditCard,
  LucideQrCode,
  LucideShieldCheck,
  LucideWifi,
} from '@lucide/angular';
import { ReservationAccess } from '../../../core/reservation-access';

import { STRINGS } from '../../../core/strings';
import { PublicEstablishmentIdentity } from '../../../core/public-establishment-identity';
import { PublicSpaceSummary } from '../../../core/public-space';
import { PaymentStore } from '../model/payment-store';
import { PaymentQrImage } from './payment-qr';

@Component({
  selector: 'mp-payment-page',
  imports: [
    RouterLink,
    PublicEstablishmentIdentity,
    PublicSpaceSummary,
    PaymentQrImage,
    LucideArrowLeft,
    LucideCheck,
    LucideChevronDown,
    LucideClock3,
    LucideCreditCard,
    LucideQrCode,
    LucideShieldCheck,
    LucideWifi,
  ],
  providers: [PaymentStore],
  templateUrl: './payment-page.html',
  styleUrls: ['./payment-pages.scss', './checkout-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentPage {
  readonly tenantSlug = input.required<string>();
  readonly establishmentSlug = input.required<string>();
  readonly reservationId = input.required<string>();
  protected readonly store = inject(PaymentStore);
  protected readonly strings = STRINGS.payment;
  private readonly access = inject(ReservationAccess);
  private readonly fragment = toSignal(inject(ActivatedRoute).fragment, { initialValue: null });
  protected readonly shareOpen = signal(false);
  protected readonly scenarios = Object.entries(this.strings.scenarios).map(([value, label]) => ({
    value,
    label,
  }));

  constructor() {
    effect(() => {
      const scope = {
        tenantSlug: this.tenantSlug(),
        establishmentSlug: this.establishmentSlug(),
        reservationId: this.reservationId(),
      };
      this.store.previewEnabled();
      const fragment = this.fragment();
      untracked(() => {
        if (fragment) this.access.capture(scope, fragment);
        void this.store.load(scope);
      });
    });
  }

  protected changeScenario(event: Event): void {
    this.store.chooseScenario((event.target as HTMLSelectElement).value);
  }

  protected toggleShare(event: Event): void {
    this.shareOpen.set((event.target as HTMLDetailsElement).open);
  }
}
