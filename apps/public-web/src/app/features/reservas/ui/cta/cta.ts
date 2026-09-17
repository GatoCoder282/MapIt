import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RevealOnScroll } from '@mapit/ui-kit';

import { STRINGS } from '../../../../core/strings';

/** Banner final: "Explora, descubre y reserva." */
@Component({
  selector: 'mp-reservas-cta',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RevealOnScroll],
  templateUrl: './cta.html',
  styleUrl: './cta.scss',
})
export class ReservasCta {
  protected readonly strings = STRINGS;
}
