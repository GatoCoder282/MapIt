import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { RevealOnScroll } from '@mapit/ui-kit';

// eslint-disable-next-line no-restricted-imports -- UI anidada del mismo feature comparte su ViewModel.
import { CatalogStore } from '../../model/catalog-store';

import { STRINGS } from '../../../../core/strings';

/** Categorías del catálogo público. */
@Component({
  selector: 'mp-reservas-categories',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RevealOnScroll],
  templateUrl: './categories.html',
  styleUrl: './categories.scss',
})
export class ReservasCategories {
  protected readonly strings = STRINGS;
  protected readonly store = inject(CatalogStore);
  protected readonly categoryKeys = [
    'restaurante',
    'discoteca',
    'eventos',
    'hotel',
    'salones',
    'otros',
  ];
  protected readonly categories = computed(() => STRINGS.reservas.categories.items);
}
