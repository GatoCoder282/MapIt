import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

import { STRINGS } from '../../../../core/strings';

@Component({
  selector: 'mp-landing-product',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage],
  templateUrl: './product.html',
  styleUrl: './product.scss',
})
export class LandingProduct {
  protected readonly strings = STRINGS;
}
