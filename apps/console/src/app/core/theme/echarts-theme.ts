/**
 * Nombre con el que se registra el tema propio de MapIt en ECharts.
 * Un tema de ECharts no puede ser el de por defecto (Regla 4 del
 * «Flujo especial — Dashboards»).
 */
export const MAPIT_ECHARTS_THEME = 'mapit';

/**
 * Color primario de las series: `--mapit-color-primary` del design system.
 * Vive en TypeScript porque el lienzo de ECharts es un canvas y no puede
 * leer variables CSS. `theme.spec.ts` lo contrasta con el SCSS.
 */
const PRIMARY = '#2563eb';

/**
 * Colores de la serie del gráfico de crecimiento.
 *
 * El lienzo de ECharts es un canvas: no puede consumir `var(--mapit-*)`.
 * Estos dos valores son los tokens `--mapit-color-primary` y
 * `--mapit-color-surface`; `theme.spec.ts` vigila que no se desvíen del SCSS.
 */
export const mapitChartSeriesColors = {
  primary: PRIMARY,
  surface: '#ffffff',
} as const;

/**
 * Colores por vertical de negocio: los tokens `--mapit-vertical-*` de
 * `_tokens.scss`.
 *
 * El lienzo de ECharts es un canvas: no puede consumir `var(--mapit-*)`. Estos
 * cuatro valores son los tokens `--mapit-vertical-restaurant`,
 * `--mapit-vertical-nightclub`, `--mapit-vertical-event-hall` y
 * `--mapit-vertical-hotel`; `theme.spec.ts` vigila que no se desvíen del SCSS.
 *
 * Se usan como **punto o segmento** (donut, lista de distribución), nunca
 * como color de texto: el ámbar sobre blanco no alcanza el contraste AA.
 */
export const mapitVerticalColors = {
  RESTAURANT: '#2563eb',
  NIGHTCLUB: '#7c3aed',
  EVENT_HALL: '#10b981',
  HOTEL: '#f59e0b',
} as const;

/**
 * Sufijo del token CSS de cada vertical: `--mapit-vertical-<sufijo>`.
 *
 * El enum del contrato dice `EVENT_HALL` y el token dice `event-hall`: el
 * mapeo es explícito para que una errata no compile y para que el punto de
 * la leyenda salga del token y no de un hex escrito en la plantilla.
 */
export const mapitVerticalToken = {
  RESTAURANT: 'restaurant',
  NIGHTCLUB: 'nightclub',
  EVENT_HALL: 'event-hall',
  HOTEL: 'hotel',
} as const;

/** Referencia al token CSS del color de una vertical. */
export function mapitVerticalVar(vertical: keyof typeof mapitVerticalToken): string {
  return `var(--mapit-vertical-${mapitVerticalToken[vertical]})`;
}

/**
 * Tema de ECharts para MapIt.
 *
 * Regla 4: paleta, tipografía, grosores y colores de ejes/tooltips tomados de
 * `DESIGN.md` (`libs/ui-kit/DESIGN.md` y `libs/ui-kit/styles/_tokens.scss`).
 *
 * - Colores de series: la paleta aprobada en la excepción de paleta de la
 *   Regla 3. Los cinco hex **ya existen** en los tokens del proyecto
 *   (`--mapit-color-primary`, `--mapit-state-cleaning`,
 *   `--mapit-color-text-muted`, `--mapit-color-primary-hover`,
 *   `--mapit-color-text-variant`), así que no entra ningún color nuevo al
 *   sistema. Todos superan 3:1 sobre blanco (WCAG 1.4.11).
 * - Texto: `--mapit-color-text` (#0f172a) y `--mapit-color-text-muted` (#64748b).
 * - Bordes de eje: `--mapit-color-border` (#e2e8f0).
 * - Tooltip: fondo `--mapit-color-text` con texto `--mapit-color-canvas` (#f8fafc),
 *   radio `--mapit-radius` (8px).
 *
 * Sin anotación de tipo a propósito: TypeScript lo infiere con tipos reales
 * (`string[]`, no `any`) para que el test de deriva no dispare
 * `no-unsafe-member-access`. Este módulo **no importa ECharts en runtime**:
 * es un objeto de datos, así que se puede importar desde donde sea sin
 * arrastrar el motor de gráficos al bundle. El registro ocurre en
 * `echarts-setup.ts`, dentro del chunk lazy de la pantalla que dibuje gráficos.
 */
export const mapitEChartsTheme = {
  color: [PRIMARY, '#3b82f6', '#64748b', '#1d4ed8', '#334155'],
  backgroundColor: 'transparent',
  textStyle: {
    fontFamily:
      "'Inter Variable', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    color: '#0f172a',
  },
  title: {
    textStyle: { color: '#0f172a', fontSize: 14, fontWeight: 600 },
    subtextStyle: { color: '#64748b', fontSize: 12 },
  },
  legend: {
    textStyle: { color: '#64748b', fontSize: 12 },
    inactiveColor: '#cbd5e1',
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#e2e8f0' } },
    axisTick: { show: false },
    axisLabel: { color: '#64748b', fontSize: 11 },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#64748b', fontSize: 11, fontWeight: 600 },
    // Grid punteado: es el patrón del gráfico de crecimiento (design-components.md).
    splitLine: { lineStyle: { color: '#e2e8f0', type: 'dotted' } },
  },
  axisPointer: {
    lineStyle: { color: '#94a3b8' },
    crossStyle: { color: '#94a3b8' },
  },
  tooltip: {
    backgroundColor: '#0f172a',
    borderWidth: 0,
    padding: [8, 12],
    textStyle: { color: '#f8fafc', fontSize: 12 },
    extraCssText: 'border-radius: 8px; box-shadow: 0 4px 12px rgb(0 0 0 / 0.05);',
  },
};
