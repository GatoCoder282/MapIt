import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RevealOnScroll } from '@mapit/ui-kit';

import { STRINGS } from '../../../../core/strings';

/** SecciÃ³n "Explora nuestros establecimientos": navegaciÃ³n por categorÃ­a. */
@Component({
  selector: 'mp-reservas-categories',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RevealOnScroll],
  templateUrl: './categories.html',
  styleUrl: './categories.scss',
})
export class ReservasCategories {
  protected readonly strings = STRINGS;
  protected readonly categories = STRINGS.reservas.categories.items;
}
