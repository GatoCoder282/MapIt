import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';

import { LanguageSelector } from '@mapit/i18n';
import { SITE_STRINGS } from '../site-strings';

/**
 * Barra de navegación pública de MapIt (landing + páginas públicas).
 * Vive en ui-kit porque las features no se importan entre sí.
 * Spec: apps/public-web/design/design-components.md (sección "Nav bar").
 */
@Component({
  selector: 'mapit-ui-site-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage, RouterLink, RouterLinkActive, LanguageSelector],
  templateUrl: './site-nav.html',
  styleUrl: './site-nav.scss',
  host: { class: 'site-nav-host' },
})
export class SiteNav {
  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  protected readonly bookingFlow = computed(() =>
    /^\/(reservas|disponibilidad|elegir-espacio|reservar|pago|comprobante|mis-reservas|simulacion)(\/|\?|$)/.test(
      this.url(),
    ),
  );
  protected readonly strings = SITE_STRINGS;
  readonly compact = input(false);
  readonly loginHref = input<string | null>(null);
  readonly joinHref = input<string | null>(null);
  readonly requestAccess = input(false);
  protected readonly menuOpen = signal(false);

  protected toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }
}
