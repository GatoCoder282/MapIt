import { ChangeDetectionStrategy, Component } from '@angular/core';
import { STRINGS } from '../../../../core/strings';

@Component({
  selector: 'mp-business-steps',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './business-steps.html',
  styleUrl: './business-steps.scss',
})
export class BusinessSteps {
  protected readonly copy = STRINGS.landing.showcase;
  protected readonly stepIcons = [
    'M3 10h18l-2-7H5l-2 7Zm1 0v11h16V10M9 21v-7h6v7M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0',
    'M12 2 2 7l10 5 10-5-10-5ZM2 12l10 5 10-5M2 17l10 5 10-5',
    'M4 5h16v16H4zM4 10h16M8 2v6m8-6v6m-8 7 2 2 4-4',
    'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM10 7l7 5-7 5Z',
  ];
}
