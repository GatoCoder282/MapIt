import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { RevealOnScroll } from '@mapit/ui-kit';

import { DOCUMENT } from '@angular/common';

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
  private readonly document = inject(DOCUMENT);
  protected explore(event: MouseEvent): void {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const catalog = this.document.getElementById('mas-populares');
    catalog?.scrollIntoView();
    catalog?.focus({ preventScroll: true });
  }
}
