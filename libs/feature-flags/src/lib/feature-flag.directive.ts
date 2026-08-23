import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';

import { FeatureFlagService } from './feature-flag.service';
import { type FeatureFlagKey } from './feature-flag.catalog';

/**
 * Muestra u oculta un bloque según una feature flag.
 *
 *     <p *featureFlag="'payments.qr'">Pagar con QR</p>
 *
 * Alternativa a `@if (flags.isEnabled('x')())`. La directiva es más cómoda
 * cuando la condición se repite mucho; el `@if` es más explícito. Ambas valen.
 */
@Directive({ selector: '[featureFlag]' })
export class FeatureFlagDirective {
  private readonly plantilla = inject(TemplateRef<unknown>);
  private readonly contenedor = inject(ViewContainerRef);
  private readonly flags = inject(FeatureFlagService);

  /** Clave de la flag. Tipada: una errata no compila. */
  readonly featureFlag = input.required<FeatureFlagKey>();

  /** Invierte la condición: renderiza cuando la flag está APAGADA. */
  readonly featureFlagElse = input(false);

  private visible = false;

  constructor() {
    effect(() => {
      const activa = this.flags.isEnabled(this.featureFlag())();
      const debeMostrarse = this.featureFlagElse() ? !activa : activa;

      if (debeMostrarse && !this.visible) {
        this.contenedor.createEmbeddedView(this.plantilla);
        this.visible = true;
      } else if (!debeMostrarse && this.visible) {
        this.contenedor.clear();
        this.visible = false;
      }
    });
  }
}
