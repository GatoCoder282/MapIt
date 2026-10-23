import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

import { RevealOnScroll } from '@mapit/ui-kit';

import { STRINGS } from '../../../../core/strings';

/** Hero de la página Reservas: buscador y visual de referencia. */
@Component({
  selector: 'mp-reservas-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage, RevealOnScroll],
  templateUrl: './hero.html',
  styleUrl: './hero.scss',
})
export class ReservasHero {
  protected readonly strings = STRINGS;
}
