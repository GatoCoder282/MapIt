import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { STRINGS } from '../../../core/strings';
import { PaymentMethodsStore } from '../model/payment-methods-store';
import { SearchSelect } from './search-select';

@Component({
  selector: 'mapit-payment-methods',
  imports: [SearchSelect],
  providers: [PaymentMethodsStore],
  templateUrl: './payment-methods.html',
  styleUrl: './payment-methods.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentMethods {
  protected readonly strings = STRINGS.paymentMethods;
  protected readonly store = inject(PaymentMethodsStore);
}
