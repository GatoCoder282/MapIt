import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

import { STRINGS } from '../../../../core/strings';

@Component({
  selector: 'mp-landing-problem',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage],
  templateUrl: './problem.html',
  styleUrl: './problem.scss',
})
export class LandingProblem {
  protected readonly strings = STRINGS;
}
