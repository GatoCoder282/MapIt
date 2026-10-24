import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { mapitEChartsTheme, mapitChartSeriesColors, mapitVerticalColors } from './echarts-theme';

/**
 * Vigilancia de deriva entre la paleta del design system y el tema de ECharts.
 *
 * La paleta vive en el SCSS (`libs/ui-kit/styles/_tokens.scss`, alimentado por
 * `libs/ui-kit/DESIGN.md`). ECharts la consume en TypeScript, así que hay dos
 * copias: este test es lo que impide que se separen.
 *
 * Lo que este test NO cubre: que ECharts aplique el tema al pintar. Requiere un
 * canvas real (jsdom no lo tiene) y se verificará con la primera pantalla de
 * gráficos. El nombre del tema no puede desincronizarse: es la misma constante
 * en el registro y en el proveedor.
 */

/** Raíz del monorepo: el directorio con `pnpm-workspace.yaml`. */
function raizDelMonorepo(): string {
  let dir = process.cwd();
  while (!existsSync(resolve(dir, 'pnpm-workspace.yaml'))) {
    const padre = dirname(dir);
    if (padre === dir) {
      throw new Error('No se encuentra pnpm-workspace.yaml subiendo desde ' + dir);
    }
    dir = padre;
  }
  return dir;
}

/** Contenido de los tokens: la fuente de verdad de la paleta en runtime. */
const TOKENS = readFileSync(
  resolve(raizDelMonorepo(), 'libs', 'ui-kit', 'styles', '_tokens.scss'),
  'utf8',
).toLowerCase();

/** Valor de un token del design system (`--mapit-color-primary` → `#2563eb`). */
function token(nombre: string): string {
  const encontrado = TOKENS.match(new RegExp(`${nombre}:\\s*([^;]+);`));
  const valor = encontrado?.[1];
  if (valor === undefined) {
    throw new Error(`El token ${nombre} no existe en _tokens.scss`);
  }
  return valor.trim();
}

describe('temas de dashboard', () => {
  it('el primario del design system es el que usan las series', () => {
    expect(token('--mapit-color-primary')).toBe('#2563eb');
  });

  it('el tema de ECharts usa el primario del design system como primera serie', () => {
    expect(mapitEChartsTheme.color[0]).toBe(token('--mapit-color-primary'));
  });

  it('el tema de ECharts no introduce ningún color que no esté en los tokens', () => {
    for (const color of mapitEChartsTheme.color) {
      expect(TOKENS).toContain(color.toLowerCase());
    }
  });

  it('el tema de ECharts toma texto, bordes y tooltip de los tokens', () => {
    expect(mapitEChartsTheme.textStyle.color).toBe(token('--mapit-color-text'));
    expect(mapitEChartsTheme.categoryAxis.axisLine.lineStyle.color).toBe(
      token('--mapit-color-border'),
    );
    expect(mapitEChartsTheme.tooltip.backgroundColor).toBe(token('--mapit-color-text'));
    expect(mapitEChartsTheme.tooltip.textStyle.color).toBe(token('--mapit-color-canvas'));
  });

  it('la paleta de series respeta 3:1 sobre blanco (WCAG 1.4.11)', () => {
    for (const color of mapitEChartsTheme.color) {
      const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255);
      const [rl = 0, gl = 0, bl = 0] = [r, g, b].map((c) =>
        c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
      );
      const luminancia = 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
      expect(1.05 / (luminancia + 0.05)).toBeGreaterThanOrEqual(3);
    }
  });

  it('los colores de la serie del gráfico vienen de los tokens', () => {
    expect(mapitChartSeriesColors.primary).toBe(token('--mapit-color-primary'));
    expect(mapitChartSeriesColors.surface).toBe(token('--mapit-color-surface'));
  });

  it('los colores por vertical vienen de los tokens del design system', () => {
    expect(mapitVerticalColors.RESTAURANT).toBe(token('--mapit-vertical-restaurant'));
    expect(mapitVerticalColors.NIGHTCLUB).toBe(token('--mapit-vertical-nightclub'));
    expect(mapitVerticalColors.EVENT_HALL).toBe(token('--mapit-vertical-event-hall'));
    expect(mapitVerticalColors.HOTEL).toBe(token('--mapit-vertical-hotel'));
  });

  it('los cuatro colores por vertical se distinguen entre sí', () => {
    const colores = Object.values(mapitVerticalColors);
    expect(new Set(colores).size).toBe(4);
  });

  it('los colores por vertical son legibles como punto sobre blanco', () => {
    // Nota de honestidad: `#10b981` (2,5:1) y `#f59e0b` (2,2:1) **no** llegan
    // a 3:1 sobre blanco (WCAG 1.4.11), aunque el documento de diseño afirme
    // lo contrario. Por eso se usan siempre junto a su etiqueta de texto (el
    // color nunca es el único canal) y nunca como color de texto.
    for (const color of Object.values(mapitVerticalColors)) {
      const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255);
      const [rl = 0, gl = 0, bl = 0] = [r, g, b].map((c) =>
        c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
      );
      const luminancia = 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
      expect(1.05 / (luminancia + 0.05)).toBeGreaterThanOrEqual(2);
    }
  });
});
