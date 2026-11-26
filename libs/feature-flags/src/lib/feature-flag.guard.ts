import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

import { FeatureFlagService } from './feature-flag.service';
import { type FeatureFlagKey } from './feature-flag.catalog';

/**
 * Protege una ruta entera con una feature flag.
 *
 *     {
 *       path: 'pagos',
 *       canActivate: [featureFlagGuard('payments.qr')],
 *       loadComponent: () => import('./payment/payment').then((m) => m.Payment),
 *     }
 *
 * Comprueba el estado actual al navegar. Es UX, no autorización de operaciones.
 */
export function featureFlagGuard(flag: FeatureFlagKey, redirigirA = '/'): CanActivateFn {
  return () => {
    const flags = inject(FeatureFlagService);
    const router = inject(Router);
    return flags.isEnabledNow(flag) ? true : router.createUrlTree([redirigirA]);
  };
}
