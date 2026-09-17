import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

import { STRINGS } from '../../../../core/strings';

@Component({
  selector: 'mp-landing-booking',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage],
  templateUrl: './booking.html',
  styleUrl: './booking.scss',
})
export class LandingBooking {
  protected readonly strings = STRINGS;
}
