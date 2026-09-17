import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { AuthSession } from '@mapit/auth';
import { FeatureFlagService, FeatureFlagDirective } from '@mapit/feature-flags';
import { STRINGS } from '../../core/strings';

/**
 * Pantalla de arranque de la consola.
 *
 * Existe para verificar el andamiaje de punta a punta; se sustituirá por el
 * dashboard real en CU-10. El banner de abajo es la prueba visible de que los
 * feature toggles funcionan: apágalo en http://localhost:4242 y desaparece
 * SIN recompilar ni recargar la app.
 */
@Component({
  selector: 'mapit-home',
  imports: [FeatureFlagDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="home">
      <h1>{{ strings.home.title }}</h1>
      <p class="sub">{{ strings.home.sub }}</p>

      @if (session.user(); as user) {
        <p>{{ strings.home.welcome }} {{ user.fullName }}.</p>
        <p>
          {{ user.email }} · {{ strings.home.tenantLabel }} {{ user.tenantId }} ·
          {{ strings.home.roleLabel }} {{ user.role }}
        </p>
        <button type="button" (click)="session.logout()">{{ strings.home.logout }}</button>
      }
      @if (session.warning()) {
        <p role="status">{{ session.warning() }}</p>
      }

      @if (flags.isEnabled('demo.hello')()) {
        <aside class="banner" role="status">
          <strong>{{ strings.home.flagBannerTitle }}</strong>
          {{ strings.home.flagBannerBody }}
        </aside>
      }

      <!-- Misma flag con la directiva, que es lo habitual en plantillas grandes -->
      <p *featureFlag="'payments.qr'">{{ strings.home.paymentsQrEnabled }}</p>
    </section>
  `,
  styles: `
    .home {
      padding: 3rem 2rem;
      max-width: 48rem;
      margin-inline: auto;
    }
    h1 {
      margin: 0 0 0.25rem;
      font-size: 2rem;
    }
    .sub {
      margin: 0 0 2rem;
      opacity: 0.7;
    }
    .banner {
      padding: 1rem 1.25rem;
      border-radius: 0.5rem;
      border: 1px solid var(--mapit-color-accent, #3b82f6);
      background: color-mix(in srgb, var(--mapit-color-accent, #3b82f6) 8%, transparent);
    }
  `,
})
export class Home {
  protected readonly session = inject(AuthSession);
  protected readonly flags = inject(FeatureFlagService);
  protected readonly strings = STRINGS;
}
