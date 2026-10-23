import { ChangeDetectionStrategy, Component } from '@angular/core';

import { STRINGS } from '../../../../core/strings';

@Component({
  selector: 'mp-landing-problem',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './problem.html',
  styleUrl: './problem.scss',
})
export class LandingProblem {
  protected readonly strings = STRINGS;
}
