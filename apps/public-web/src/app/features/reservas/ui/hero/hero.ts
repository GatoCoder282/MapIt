import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

import { RevealOnScroll } from '@mapit/ui-kit';

import { STRINGS } from '../../../../core/strings';
// eslint-disable-next-line no-restricted-imports -- UI anidada del mismo feature reservas comparte su ViewModel.
import { CatalogStore } from '../../model/catalog-store';

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
  protected readonly store = inject(CatalogStore);
}
