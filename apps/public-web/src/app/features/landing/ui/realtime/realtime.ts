import { ChangeDetectionStrategy, Component } from '@angular/core';

import { STRINGS } from '../../../../core/strings';

@Component({
  selector: 'mp-landing-realtime',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './realtime.html',
  styleUrl: './realtime.scss',
})
export class LandingRealtime {
  protected readonly strings = STRINGS;
  protected readonly devices = STRINGS.landing.realtime.devices;
}
