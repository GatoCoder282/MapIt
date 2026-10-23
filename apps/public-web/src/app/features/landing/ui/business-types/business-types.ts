import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

import { STRINGS } from '../../../../core/strings';

@Component({
  selector: 'mp-landing-business-types',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage],
  templateUrl: './business-types.html',
  styleUrl: './business-types.scss',
})
export class LandingBusinessTypes {
  protected readonly strings = STRINGS;
}
