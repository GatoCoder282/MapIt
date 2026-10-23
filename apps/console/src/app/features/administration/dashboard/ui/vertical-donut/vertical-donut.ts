import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  type OnInit,
} from '@angular/core';
import { PieChart } from 'echarts/charts';
import { NgxEchartsDirective } from 'ngx-echarts';

import { STRINGS } from '../../../../../core/strings';
import {
  MAPIT_ECHARTS_THEME,
  mapitChartSeriesColors,
  mapitVerticalColors,
  mapitVerticalVar,
} from '../../../../../core/theme/echarts-theme';
import { setupECharts } from '../../../../../core/theme/echarts-setup';
import type { BusinessVertical } from '@mapit/api-client';

/**
 * Una porción del reparto por vertical.
 *
 * El componente es presentacional: no conoce el store, solo el dato que
 * recibe. La forma es la del contrato (`vertical`, `count`, `percent`).
 */
export interface VerticalSlice {
  readonly vertical: BusinessVertical;
  readonly count: number;
  readonly percent: number;
}

/** Una porción del donut tal como la pinta ECharts. */
interface PieSlice {
  readonly name: string;
  readonly value: number;
  readonly itemStyle: { readonly color: string };
}

/** Porcentajes con coma decimal (español) y un decimal como máximo. */
const PERCENT_FORMAT = new Intl.NumberFormat('es', { maximumFractionDigits: 1 });

/**
 * Opciones de ECharts del donut de tenants por vertical.
 *
 * Función pura y testeable sin renderizar y sin Angular (como
 * `buildChartOptions` del gráfico de crecimiento).
 *
 * - `animation: false`: la carga de un dashboard no se anima.
 * - `aria.enabled`: el lienzo es un canvas y los lectores de pantalla no lo
 *   leen; el módulo de aria le pone la descripción.
 * - La serie usa **los cuatro colores por vertical** (`--mapit-vertical-*`):
 *   son puntos/segmentos, nunca colores de texto.
 */
export function buildDonutOptions(
  reparto: readonly VerticalSlice[],
  ariaLabel: string,
  totalLabel: string,
  labels: Readonly<Record<string, string>>,
) {
  const slices: readonly PieSlice[] = reparto.map((item) => ({
    name: labels[item.vertical] ?? item.vertical,
    value: item.count,
    itemStyle: { color: mapitVerticalColors[item.vertical] },
  }));

  const total = slices.reduce((suma, slice) => suma + slice.value, 0);
  const detalle = slices.map((slice) => `${slice.name} ${slice.value}`).join(', ');

  return {
    animation: false,
    aria: {
      enabled: true,
      description: `${ariaLabel}. ${total} ${totalLabel}. ${detalle}.`,
    },
    tooltip: {
      trigger: 'item',
      formatter: (params: { name?: string; value?: unknown; percent?: number }) => {
        const valor = typeof params.value === 'number' ? params.value : 0;
        const porcentaje = Math.round(params.percent ?? 0);
        return `<b>${params.name ?? ''}</b><br/>${valor} · ${porcentaje} %`;
      },
    },
    series: [
      {
        type: 'pie',
        radius: ['62%', '82%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: { borderColor: mapitChartSeriesColors.surface, borderWidth: 2 },
        data: slices,
      },
    ],
  };
}

/**
 * Donut de tenants por vertical (el primer gráfico circular de la consola).
 *
 * Componente presentacional: recibe el reparto ya calculado y lo dibuja. El
 * total del centro y la leyenda son **texto HTML**, no canvas: se leen, se
 * traducen y no dependen de que el motor de gráficos funcione.
 */
@Component({
  selector: 'mapit-platform-donut',
  imports: [NgxEchartsDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vertical-donut.html',
  styleUrl: './vertical-donut.scss',
})
export class VerticalDonut implements OnInit {
  /** Reparto por vertical (conteo y porcentaje ya calculados). */
  readonly reparto = input<readonly VerticalSlice[]>([]);
  /** Esqueleto de carga: sustituye el gráfico y anuncia el estado. */
  readonly loading = input(false);
  /** La fuente (el resumen) falló: error con reintento, no un "vacío". */
  readonly failed = input(false);
  /** El usuario pide reintentar la carga. */
  readonly reintentar = output<void>();

  protected readonly strings = STRINGS.platformPanel;
  /** Tema propio de MapIt (paleta, tipografía y ejes de `DESIGN.md`). */
  protected readonly theme = MAPIT_ECHARTS_THEME;
  /** El punto de la leyenda se pinta con el token de la vertical. */
  protected readonly mapitVerticalVar = mapitVerticalVar;

  /** El total del centro es la suma de sus propias porciones: el anillo
   *  siempre cuadra con la leyenda que tiene al lado. */
  protected readonly total = computed(() =>
    this.reparto().reduce((suma, item) => suma + item.count, 0),
  );

  /** El donut no pinta nada cuando no hay reparto: un anillo vacío miente. */
  protected readonly isEmpty = computed(() => this.total() === 0);

  protected readonly options = computed(() =>
    buildDonutOptions(
      this.reparto(),
      this.strings.donutAria,
      this.strings.donutTotalLabel,
      STRINGS.verticals,
    ),
  );

  /** Nombre de la vertical (texto de la plataforma, no del contrato). */
  protected verticalLabel(vertical: string): string {
    return STRINGS.verticals[vertical as keyof typeof STRINGS.verticals] ?? vertical;
  }

  /** Porcentaje con coma decimal (español) y un decimal como máximo. */
  protected percent(valor: number): string {
    return PERCENT_FORMAT.format(valor);
  }

  ngOnInit(): void {
    // Regla 5: ECharts entra **por módulos** y desde la pantalla que dibuja
    // gráficos, nunca desde `app.config.ts` (el motor se iría al bundle
    // inicial). `setupECharts` es idempotente y acumulativo: el gráfico de
    // líneas y este pueden convivir en la misma pantalla.
    setupECharts(PieChart);
  }
}
