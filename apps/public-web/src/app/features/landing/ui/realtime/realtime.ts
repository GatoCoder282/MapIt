import { ChangeDetectionStrategy, Component, computed } from '@angular/core';

import { STRINGS } from '../../../../core/strings';

@Component({
  selector: 'mp-landing-realtime',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './realtime.html',
  styleUrl: './realtime.scss',
})
export class LandingRealtime {
  protected readonly strings = STRINGS;
  protected readonly devices = computed(() => STRINGS.landing.realtime.devices);
}
