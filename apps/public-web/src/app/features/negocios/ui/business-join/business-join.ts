import { ChangeDetectionStrategy, Component } from '@angular/core';
import { STRINGS } from '../../../../core/strings';
@Component({
  selector: 'mp-business-join',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './business-join.html',
  styleUrl: './business-join.scss',
})
export class BusinessJoin {
  protected readonly copy = STRINGS.landing.showcase;
}
