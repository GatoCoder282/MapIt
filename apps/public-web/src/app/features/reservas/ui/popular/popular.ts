import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';

import { RevealOnScroll } from '@mapit/ui-kit';

// eslint-disable-next-line no-restricted-imports -- UI anidada del mismo feature reservas comparte su ViewModel.
import { CatalogStore } from '../../model/catalog-store';
import { STRINGS } from '../../../../core/strings';

/** Catálogo real; no inventa valoraciones, cupos ni disponibilidad. */
@Component({
  selector: 'mp-reservas-popular',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RevealOnScroll, RouterLink, NgOptimizedImage],
  templateUrl: './popular.html',
  styleUrl: './popular.scss',
})
export class ReservasPopular {
  protected readonly photos: Readonly<Record<string, string>> = {
    RESTAURANT: 'assets/img/reservas/restaurant.webp',
    NIGHTCLUB: 'assets/img/reservas/nightclub.webp',
    EVENT_HALL: 'assets/img/reservas/events.webp',
    HOTEL: 'assets/img/reservas/hotel.webp',
  };
  protected readonly strings = STRINGS;
  protected readonly store = inject(CatalogStore);
}
