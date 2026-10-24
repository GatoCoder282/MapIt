import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  LucideBuilding2,
  LucideCalendarDays,
  LucideCheckCircle2,
  LucideLandmark,
  LucideLayers,
  LucidePercent,
  LucidePieChart,
  LucideQrCode,
  LucideTrendingDown,
  LucideTrendingUp,
  LucideUsers,
  LucideWallet,
} from '@lucide/angular';

import { STRINGS } from '../../../../core/strings';
import { Sparkline } from '../sparkline/sparkline';

/**
 * Iconos del dashboard: unión cerrada, una errata no compila.
 * Solo `@lucide/angular` — nunca una segunda familia de iconos.
 */
export type KpiIcon =
  | 'building'
  | 'landmark'
  | 'layers'
  | 'check-circle'
  | 'pie-chart'
  | 'calendar'
  | 'users'
  | 'qr-code'
  | 'wallet'
  | 'percent';

/** Dirección del icono de tendencia de una línea de contexto. */
export type KpiTrend = 'up' | 'down';

/**
 * Tarjeta de métrica del dashboard (CU-10). Componente presentacional: recibe
 * los datos ya calculados por el store y solo los dibuja.
 *
 * El delta sigue la regla de `design-guidelines.md`: positivo en
 * `--mapit-color-primary` con icono `--mapit-state-available`, negativo en
 * `--mapit-color-error` y neutro en `--mapit-color-text-muted`. El verde claro
 * nunca se usa como texto (no alcanza AA a 12px).
 */
@Component({
  selector: 'mapit-kpi-card',
  imports: [
    LucideBuilding2,
    LucideCalendarDays,
    LucideCheckCircle2,
    LucideLandmark,
    LucideLayers,
    LucidePercent,
    LucidePieChart,
    LucideQrCode,
    LucideTrendingDown,
    LucideTrendingUp,
    LucideUsers,
    LucideWallet,
    Sparkline,
  ],
  host: { class: 'kpi' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './kpi-card.html',
  styleUrl: './kpi-card.scss',
})
export class KpiCard {
  /** Nombre de la métrica. */
  readonly label = input.required<string>();
  /** Valor ya formateado (el store decide el formato). */
  readonly value = input.required<string>();
  /** Icono de la métrica. */
  readonly icon = input.required<KpiIcon>();
  /** Línea de contexto cuando no hay delta (p. ej. "Sin datos"). */
  readonly context = input<string>();
  /** Variación porcentual; `null` = no hay periodo anterior con el que comparar. */
  readonly delta = input<number | null>(null);
  /** Detalle bajo el delta (p. ej. "altas vs. semana anterior"). */
  readonly deltaLabel = input<string>();
  /** Flecha de la línea de contexto (KPI con conteo, no con porcentaje). */
  readonly contextTrend = input<KpiTrend | null>(null);
  /** Esqueleto de carga: sustituye el contenido y anuncia el estado. */
  readonly loading = input(false);
  /** Valor de texto largo (vertical): 1.25rem y truncado. */
  readonly compact = input(false);
  /**
   * Serie real para el sparkline de la esquina. Opcional a propósito: sin
   * serie real **no** se dibuja nada (no hay datos inventados).
   */
  readonly sparkline = input<readonly number[]>();

  protected readonly strings = STRINGS.adminDashboardHome;
}
