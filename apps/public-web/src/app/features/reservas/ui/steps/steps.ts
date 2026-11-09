import { ChangeDetectionStrategy, Component, computed } from '@angular/core';

import { RevealOnScroll } from '@mapit/ui-kit';

import { STRINGS } from '../../../../core/strings';

/** Proceso de reserva en tres pasos. */
@Component({
  selector: 'mp-reservas-steps',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RevealOnScroll],
  templateUrl: './steps.html',
  styleUrl: './steps.scss',
})
export class ReservasSteps {
  protected readonly strings = STRINGS;
  protected readonly steps = computed(() => STRINGS.reservas.steps.items);
}
