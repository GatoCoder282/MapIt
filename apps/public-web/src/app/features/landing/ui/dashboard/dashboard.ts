import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

import { STRINGS } from '../../../../core/strings';

@Component({
  selector: 'mp-landing-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class LandingDashboard {
  protected readonly strings = STRINGS;
}
