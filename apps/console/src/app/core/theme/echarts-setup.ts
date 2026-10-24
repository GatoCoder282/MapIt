import { registerTheme, use } from 'echarts/core';
import {
  AriaComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components';
import { LabelLayout, UniversalTransition } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';

import { MAPIT_ECHARTS_THEME, mapitEChartsTheme } from './echarts-theme';

/** Un módulo instalable de ECharts: chart, componente, feature o renderer. */
export type EChartsModule = Extract<Parameters<typeof use>[0], readonly unknown[]>[number];

let configurado = false;

/** Módulos ya registrados: `use()` es aditivo, pero no hace falta repetir. */
const modulosRegistrados = new Set<EChartsModule>();

/**
 * Prepara ECharts para una pantalla: registra el tema propio de MapIt y los
 * módulos de ECharts que esa pantalla usa.
 *
 * Regla 5 del «Flujo especial — Dashboards»: se importa **solo por módulos**
 * (`echarts/core` + los charts, componentes y renderer concretos), nunca el
 * paquete completo. La pantalla pasa sus charts: `setupECharts(BarChart)`.
 *
 * Regla de carga diferida: este módulo importa el motor de ECharts, así que
 * **no** debe llamarse desde `app.config.ts` (metría el motor al bundle
 * inicial). Llámalo desde la ruta lazy que dibuje gráficos; el proveedor
 * `provideEchartsCore` de `app.config.ts` ya carga `echarts/core` de forma
 * diferida la primera vez que se crea un gráfico.
 *
 * Es idempotente **y acumulativo**: llamarla dos veces con charts distintos
 * registra los dos. (Con un `if (configurado) return` a secas, la segunda
 * llamada se perdía y el segundo chart de la pantalla no se pintaba.)
 */
export function setupECharts(...charts: EChartsModule[]): void {
  const nuevos = charts.filter((modulo) => !modulosRegistrados.has(modulo));
  if (configurado && nuevos.length === 0) return;

  use([
    ...(configurado
      ? []
      : [
          GridComponent,
          TooltipComponent,
          LegendComponent,
          TitleComponent,
          // Regla 7 (accesibilidad): el lienzo es un canvas, así que el módulo
          // de aria es el que le pone nombre accesible al gráfico a los lectores
          // de pantalla. Sin él, `aria.description` no se aplica.
          AriaComponent,
          LabelLayout,
          UniversalTransition,
          CanvasRenderer,
        ]),
    ...nuevos,
  ]);

  for (const modulo of nuevos) modulosRegistrados.add(modulo);

  if (!configurado) {
    registerTheme(MAPIT_ECHARTS_THEME, mapitEChartsTheme);
    configurado = true;
  }
}
