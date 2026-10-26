import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { PageTransitionService } from './page-transition.service';

@Component({
  selector: 'mapit-page-wipe-overlay',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './page-wipe-overlay.html',
  styleUrl: './page-wipe-overlay.scss',
})
export class PageWipeOverlay {
  readonly service = inject(PageTransitionService);
  readonly ariaLabel = input('Transición de página');
}
