import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RevealOnScroll } from '@mapit/ui-kit';

import { STRINGS } from '../../../../core/strings';

/** SecciÃ³n "Reservar es muy fÃ¡cil": proceso en 5 pasos + visual de confirmaciÃ³n. */
@Component({
  selector: 'mp-reservas-steps',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RevealOnScroll],
  templateUrl: './steps.html',
  styleUrl: './steps.scss',
})
export class ReservasSteps {
  protected readonly strings = STRINGS;
  protected readonly steps = STRINGS.reservas.steps.items;
}
