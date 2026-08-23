import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { FeatureFlagService } from '@mapit/feature-flags';

/**
 * Portada pública. Se sustituirá por el buscador de disponibilidad (CU-15).
 *
 * Comparte la flag `demo.hello` con la consola a propósito: al apagarla en
 * Unleash, el banner desaparece de AMBAS apps a la vez. Eso demuestra que el
 * toggle es una decisión de servidor, no de cada bundle.
 */
@Component({
  selector: 'mp-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="landing">
      <h1>MapIt</h1>
      <p>Consulta disponibilidad y reserva tu lugar.</p>

      @if (flags.isEnabled('demo.hello')()) {
        <aside class="banner" role="status">El feature toggle también está activo aquí.</aside>
      }
    </section>
  `,
  styles: `
    .landing {
      padding: 4rem 2rem;
      max-width: 40rem;
      margin-inline: auto;
      text-align: center;
    }
    .banner {
      margin-top: 2rem;
      padding: 1rem;
      border-radius: 0.5rem;
      border: 1px solid var(--mapit-color-accent, #3b82f6);
    }
  `,
})
export class Landing {
  protected readonly flags = inject(FeatureFlagService);
}
