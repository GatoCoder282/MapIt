import { ChangeDetectionStrategy, Component } from '@angular/core';

import { STRINGS } from '../../../../core/strings';

@Component({
  selector: 'mp-landing-cta-final',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cta-final.html',
  styleUrl: './cta-final.scss',
})
export class LandingCtaFinal {
  protected readonly strings = STRINGS;
}
