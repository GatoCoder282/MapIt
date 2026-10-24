import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import {
  LucideCreditCard,
  LucideInfo,
  LucidePercent,
  LucideQrCode,
  LucideTrendingDown,
  LucideTrendingUp,
  LucideUsers,
  LucideWallet,
} from '@lucide/angular';
import { FeatureFlagService } from '@mapit/feature-flags';

import { STRINGS } from '../../../../core/strings';
import { Sparkline } from '../sparkline/sparkline';

/**
 * Panel "Reservas y pagos" (CU-10). Una sola métrica tiene fuente de datos
 * real (personas registradas); las otras tres muestran "—" y "Sin datos"
 * porque no existe endpoint de pagos, ni tabla de pagos, ni columna de importe
 * en el modelo. La rama con datos reales queda detrás de la flag
 * `payments.qr` (CU-17).
 */
@Component({
  selector: 'mapit-reservations-panel',
  imports: [
    LucideCreditCard,
    LucideInfo,
    LucidePercent,
    LucideQrCode,
    LucideTrendingDown,
    LucideTrendingUp,
    LucideUsers,
    LucideWallet,
    Sparkline,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reservations-panel.html',
  styleUrl: './reservations-panel.scss',
})
export class ReservationsPanel {
  /** Total de personas registradas (ya formateado). */
  readonly peopleTotal = input.required<string>();
  /** Variación semanal de las altas de personas; `null` = no hay base real. */
  readonly peopleDelta = input<number | null>(null);
  /** Altas de personas de la semana actual (cuando no hay porcentaje). */
  readonly peopleNewThisWeek = input(0);
  /**
   * Serie real de altas de personas para el sparkline del slot. Opcional:
   * sin serie real no se dibuja nada.
   */
  readonly peopleSparkline = input<readonly number[]>();
  /**
   * El rol puede leer las personas del tenant. Cuando no puede (SUPER_ADMIN:
   * la API responde 403), el slot dice "Sin datos" en vez de un 0 inventado.
   */
  readonly peopleAvailable = input(true);

  protected readonly strings = STRINGS.adminDashboardHome;
  protected readonly flags = inject(FeatureFlagService);
}
