import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

import { RevealOnScroll } from '@mapit/ui-kit';

import { ESTABLISHMENTS } from '../../establishments.data';
import { STRINGS } from '../../../../core/strings';

/** Grid de establecimientos populares con datos mock (ver establishments.data.ts). */
@Component({
  selector: 'mp-reservas-popular',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage, RevealOnScroll],
  templateUrl: './popular.html',
  styleUrl: './popular.scss',
})
export class ReservasPopular {
  protected readonly strings = STRINGS;
  protected readonly establishments = ESTABLISHMENTS;
}
