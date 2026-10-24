import { ChangeDetectionStrategy, Component, computed, input, type OnInit } from '@angular/core';
import { LineChart } from 'echarts/charts';
import { NgxEchartsDirective } from 'ngx-echarts';

import { STRINGS } from '../../strings';
import { MAPIT_ECHARTS_THEME, mapitChartSeriesColors } from '../../theme/echarts-theme';
import { setupECharts } from '../../theme/echarts-setup';

/** Un cubo semanal del gráfico: valor y etiqueta de la semana. */
export interface ChartPoint {
  readonly value: number;
  readonly label: string;
}

/** Lo que ECharts entrega al formateador del tooltip. */
export interface TooltipParam {
  readonly axisValue?: string;
  readonly axisValueLabel?: string;
  readonly value?: unknown;
}

/**
 * Máximo del eje de valores: **nunca 0**. Con la serie entera en cero el eje
 * no divide por cero y la línea queda plana sobre la base.
 */
export function chartMax(series: readonly ChartPoint[]): number {
  return Math.max(1, ...series.map((point) => point.value));
}

/** Resumen numérico del gráfico para el nombre accesible (aria). */
function chartSummary(max: number, min: number, total: number): string {
  return STRINGS.adminDashboardHome.chartAriaSummary
    .replace('{max}', String(max))
    .replace('{min}', String(min))
    .replace('{total}', String(total));
}

/**
 * Opciones de ECharts del gráfico de crecimiento.
 *
 * Reproduce la spec del SVG inline (`design-components.md`): grid horizontal
 * punteado, ticks en máximo / mitad / cero, área al 12% del primario, línea
 * de 2.5px con uniones redondeadas, puntos redondos con relleno de superficie
 * y trazo primario, y las proporciones del `viewBox` original (720 × 200).
 *
 * Función pura y testeable sin renderizar y sin Angular.
 */
export function buildChartOptions(
  series: readonly ChartPoint[],
  ariaLabel: string,
  periodLabel: string | undefined,
) {
  const max = chartMax(series);
  const values = series.map((point) => point.value);
  const total = values.reduce((sum, value) => sum + value, 0);
  const min = values.length > 0 ? Math.min(...values) : 0;

  return {
    /**
     * Regla 6 (motion): un dashboard se consulta una y otra vez; la animación
     * de la carga inicial solo añade ruido. Se mantiene el feedback de
     * tooltip/hover, que sí informa.
     */
    animation: false,
    /**
     * Regla 7 (accesibilidad): el lienzo es un canvas y los lectores de
     * pantalla no lo leen. El módulo de aria (registrado en
     * `core/theme/echarts-setup.ts`) le pone esta descripción al gráfico.
     */
    aria: {
      enabled: true,
      description: `${ariaLabel}. ${chartSummary(max, min, total)}`,
    },
    /** Márgenes del `viewBox` original: 34 de inset lateral, 16 arriba, 24 abajo. */
    grid: { left: 34, right: 34, top: 16, bottom: 24 },
    tooltip: {
      trigger: 'axis',
      formatter: (params: TooltipParam | TooltipParam[]): string => {
        const items: readonly TooltipParam[] = Array.isArray(params) ? params : [params];
        const first = items[0];
        const week = first?.axisValueLabel ?? first?.axisValue ?? '';
        const unit = periodLabel ? ` · ${periodLabel}` : '';
        const valor = typeof first?.value === 'number' ? first.value : 0;
        return `<b>${week}</b><br/>${valor}${unit}`;
      },
    },
    xAxis: {
      type: 'category',
      data: series.map((point) => point.label),
      /** Los puntos caen en los extremos del área de trazado, como en el SVG. */
      boundaryGap: false,
      axisLine: { show: false },
      axisTick: { show: false },
      /** Las etiquetas de semana son una fila HTML debajo del gráfico. */
      axisLabel: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max,
      /**
       * Ticks en máximo / mitad / cero. Con `max = 1` el intervalo es 1 (si
       * fuera la mitad saldrían dos etiquetas "1"); con `max >= 2` es la mitad.
       */
      interval: max >= 2 ? max / 2 : max,
      axisLine: { show: false },
      axisTick: { show: false },
      /** Los ticks del SVG eran enteros: se redondean hacia arriba. */
      axisLabel: { formatter: (value: number): string => String(Math.ceil(value)) },
      splitLine: { show: true },
    },
    series: [
      {
        type: 'line',
        name: periodLabel ?? ariaLabel,
        data: values,
        /** Línea recta: el SVG no interpolaba. */
        smooth: false,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: {
          width: 2.5,
          color: mapitChartSeriesColors.primary,
          cap: 'round',
          join: 'round',
        },
        itemStyle: {
          color: mapitChartSeriesColors.surface,
          borderColor: mapitChartSeriesColors.primary,
          borderWidth: 2,
        },
        areaStyle: { color: mapitChartSeriesColors.primary, opacity: 0.12 },
      },
    ],
  };
}

/**
 * Gráfico de área + línea sobre ECharts (CU-10). Componente presentacional:
 * la geometría sale de `series` y el motor de gráficos se registra aquí, en
 * el chunk lazy de la pantalla, para no meterlo en el bundle inicial.
 */
@Component({
  selector: 'mapit-growth-chart',
  imports: [NgxEchartsDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './growth-chart.html',
  styleUrl: './growth-chart.scss',
})
export class GrowthChart implements OnInit {
  /** Cubos semanales visibles (4, 8 o 12): valor y etiqueta. */
  readonly series = input.required<readonly ChartPoint[]>();
  /** Descripción del gráfico para lectores de pantalla. */
  readonly ariaLabel = input.required<string>();
  /** Unidad de la serie (p. ej. "Altas por semana"). */
  readonly periodLabel = input<string>();
  /** Fuerza el estado "sin datos" (si no, se deduce de la serie). */
  readonly empty = input(false);
  /** Semanas del periodo visible: solo nombra el estado "sin datos". */
  readonly rangeWeeks = input(8);

  protected readonly strings = STRINGS.adminDashboardHome;
  /** Tema propio de MapIt (paleta, tipografía y ejes de `DESIGN.md`). */
  protected readonly theme = MAPIT_ECHARTS_THEME;

  protected readonly options = computed(() =>
    buildChartOptions(this.series(), this.ariaLabel(), this.periodLabel()),
  );

  /** Vacío si la serie viene vacía o todos sus valores son 0. */
  protected readonly isEmpty = computed(
    () => this.empty() || this.series().every((point) => point.value === 0),
  );

  /** El mensaje "sin datos" nombra el periodo que se está mirando. */
  protected readonly emptyText = computed(() =>
    this.strings.chartEmpty.replace('{weeks}', String(this.rangeWeeks())),
  );

  /** Con 12 cubos las etiquetas de semana no caben: se muestran de dos en dos. */
  protected readonly dense = computed(() => this.series().length > 8);

  ngOnInit(): void {
    // Regla 5: ECharts entra **por módulos** y desde la pantalla que dibuja
    // gráficos, nunca desde `app.config.ts` (el motor se iría al bundle
    // inicial). `setupECharts` es idempotente.
    setupECharts(LineChart);
  }
}
