import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { STRINGS } from '../../core/strings';
@Component({
  selector: 'mp-how-phones',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './how-phones.html',
  styleUrl: './how-phones.scss',
})
export class HowPhones {
  readonly kind = input.required<'payment' | 'arrival'>();
  protected readonly copy = STRINGS.howItWorks;
  protected readonly icons = [
    '',
    '',
    'M4 5h16v16H4zM4 10h16M8 2v6m8-6v6m-8 7 2 2 4-4',
    'M3 5h18v14H3zM3 10h18m-14 5h3',
    'M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6M8 8h3v3H8zm5 5h3v3h-3z',
  ];
}
