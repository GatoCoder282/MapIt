import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Lienzo del sparkline: viewBox fijo y pequeño. El SVG se estira al ancho
 * disponible (`preserveAspectRatio="none"`) y el trazo no escala
 * (`vector-effect: non-scaling-stroke"`), así que la línea se ve igual de fina
 * en una tarjeta estrecha que en una ancha.
 */
export const SPARKLINE_VIEWBOX = { width: 64, height: 24 } as const;

/**
 * Puntos de la polilínea dentro del viewBox, ya normalizados.
 *
 * - Sin datos o con un solo punto: cadena vacía (no se dibuja nada).
 * - Serie plana (todos los valores iguales): línea horizontal en el centro.
 * - El interior del viewBox se respeta con 1px de margen para que el trazo no
 *   se corte en los bordes.
 *
 * Función pura y testeable sin renderizar y sin Angular.
 */
export function buildSparklinePoints(values: readonly number[]): string {
  if (values.length < 2) return '';

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const stepX = SPARKLINE_VIEWBOX.width / (values.length - 1);

  const y = (value: number): number =>
    span === 0
      ? SPARKLINE_VIEWBOX.height / 2
      : SPARKLINE_VIEWBOX.height - 1 - ((value - min) / span) * (SPARKLINE_VIEWBOX.height - 2);

  return values
    .map((value, index) => `${(index * stepX).toFixed(2)},${y(value).toFixed(2)}`)
    .join(' ');
}

/**
 * Sparkline: la tendencia de una serie real dibujada en la esquina de una
 * tarjeta. No es un adorno: **solo se dibuja si hay una serie real**; sin
 * serie, el componente no pinta nada.
 *
 * Es decorativo (`aria-hidden`): el valor numérico ya está en el texto de la
 * tarjeta, así que el lector de pantalla no necesita dos veces el mismo dato.
 */
@Component({
  selector: 'mapit-sparkline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sparkline.html',
  styleUrl: './sparkline.scss',
})
export class Sparkline {
  /** Serie real (números). */
  readonly values = input<readonly number[]>([]);

  protected readonly viewBox = `0 0 ${SPARKLINE_VIEWBOX.width} ${SPARKLINE_VIEWBOX.height}`;

  /** Polilínea lista para el atributo `points`; vacío = no hay nada que dibujar. */
  protected readonly points = computed(() => buildSparklinePoints(this.values()));
}
