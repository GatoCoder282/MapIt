import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { RevealOnScroll } from '@mapit/ui-kit';

// eslint-disable-next-line no-restricted-imports -- UI anidada del mismo feature reservas comparte su ViewModel.
import { CatalogStore } from '../../model/catalog-store';
import { STRINGS } from '../../../../core/strings';

/** Catálogo real; no inventa valoraciones, cupos ni disponibilidad. */
@Component({
  selector: 'mp-reservas-popular',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RevealOnScroll, RouterLink],
  templateUrl: './popular.html',
  styleUrl: './popular.scss',
})
export class ReservasPopular {
  protected readonly strings = STRINGS;
  protected readonly store = inject(CatalogStore);
}
