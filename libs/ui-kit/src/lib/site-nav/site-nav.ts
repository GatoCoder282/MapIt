import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { SITE_STRINGS } from '../site-strings';

/**
 * Barra de navegación pública de MapIt (landing + páginas públicas).
 * Vive en ui-kit porque las features no se importan entre sí.
 * Spec: apps/public-web/design/design-components.md (sección "Nav bar").
 */
@Component({
  selector: 'mapit-ui-site-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage, RouterLink, RouterLinkActive],
  templateUrl: './site-nav.html',
  styleUrl: './site-nav.scss',
  host: { class: 'site-nav-host' },
})
export class SiteNav {
  protected readonly strings = SITE_STRINGS;
  protected readonly menuOpen = signal(false);

  protected toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }
}
