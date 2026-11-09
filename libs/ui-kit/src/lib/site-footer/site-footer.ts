import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SITE_STRINGS } from '../site-strings';

/**
 * Pie de página público de MapIt (landing + páginas públicas).
 * Vive en ui-kit porque las features no se importan entre sí.
 * Spec: apps/public-web/design/design-components.md (sección "Footer").
 */
@Component({
  selector: 'mapit-ui-site-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './site-footer.html',
  styleUrl: './site-footer.scss',
})
export class SiteFooter {
  readonly compact = input(false);
  protected readonly strings = SITE_STRINGS;
}
