import { TestBed } from '@angular/core/testing';
import { provideEchartsCore } from 'ngx-echarts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VerticalDonut, buildDonutOptions } from './vertical-donut';
import { STRINGS } from '../../../../../core/strings';
import { MAPIT_ECHARTS_THEME, mapitVerticalColors } from '../../../../../core/theme/echarts-theme';

/** ECharts necesita un canvas real (jsdom no lo tiene): el motor se dobla. */
const echartsStub = {
  init: vi.fn(() => ({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
    isDisposed: vi.fn(() => false),
    on: vi.fn(),
    off: vi.fn(),
    showLoading: vi.fn(),
    hideLoading: vi.fn(),
  })),
};

const REPARTO = [
  { vertical: 'RESTAURANT', count: 12, percent: 34.3 },
  { vertical: 'NIGHTCLUB', count: 8, percent: 22.9 },
  { vertical: 'EVENT_HALL', count: 9, percent: 25.7 },
  { vertical: 'HOTEL', count: 6, percent: 17.1 },
] as const;

describe('VerticalDonut (donut de tenants por vertical)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [VerticalDonut],
      providers: [
        provideEchartsCore({
          echarts: () => Promise.resolve(echartsStub),
          theme: MAPIT_ECHARTS_THEME,
        }),
      ],
    });
  });

  it('las opciones no animan la carga y describen el gráfico (aria)', () => {
    const options = buildDonutOptions(
      [...REPARTO],
      STRINGS.platformPanel.donutAria,
      STRINGS.platformPanel.donutTotalLabel,
      STRINGS.verticals,
    );

    expect(options.animation).toBe(false);
    expect(options.aria.enabled).toBe(true);
    expect(options.aria.description).toContain(STRINGS.platformPanel.donutAria);
    expect(options.aria.description).toContain('35');
  });

  it('la serie usa los cuatro colores por vertical, en orden', () => {
    const options = buildDonutOptions(
      [...REPARTO],
      STRINGS.platformPanel.donutAria,
      STRINGS.platformPanel.donutTotalLabel,
      STRINGS.verticals,
    );

    expect(options.series[0]?.type).toBe('pie');
    expect(options.series[0]?.radius).toEqual(['62%', '82%']);
    expect(options.series[0]?.data.map((slice) => slice.itemStyle.color)).toEqual([
      mapitVerticalColors.RESTAURANT,
      mapitVerticalColors.NIGHTCLUB,
      mapitVerticalColors.EVENT_HALL,
      mapitVerticalColors.HOTEL,
    ]);
  });

  it('el centro del anillo totaliza sus propias porciones', () => {
    const fixture = TestBed.createComponent(VerticalDonut);
    fixture.componentRef.setInput('reparto', [...REPARTO]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.donut-total')?.textContent?.trim()).toBe('35');
    expect(compiled.querySelector('.donut-label')?.textContent).toContain(
      STRINGS.platformPanel.donutTotalLabel,
    );
  });

  it('la leyenda nombra cada vertical con su conteo y su porcentaje', () => {
    const fixture = TestBed.createComponent(VerticalDonut);
    fixture.componentRef.setInput('reparto', [...REPARTO]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const items = compiled.querySelectorAll('.legend-item');
    expect(items.length).toBe(4);
    expect(items[0]?.textContent).toContain(STRINGS.verticals.RESTAURANT);
    expect(items[0]?.textContent).toContain('12');
    expect(items[0]?.textContent).toContain('34,3');
  });

  it('el canvas no es la única vía del dato: hay una tabla para lectores de pantalla', () => {
    const fixture = TestBed.createComponent(VerticalDonut);
    fixture.componentRef.setInput('reparto', [...REPARTO]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const tabla = compiled.querySelector('table');
    expect(tabla?.querySelector('caption')?.textContent).toContain(
      STRINGS.platformPanel.donutDataCaption,
    );
    expect(tabla?.querySelectorAll('tbody th[scope="row"]').length).toBe(4);
    expect(tabla?.querySelectorAll('thead th[scope="col"]').length).toBe(3);
  });

  it('sin tenants: estado vacío, no un anillo vacío', () => {
    const fixture = TestBed.createComponent(VerticalDonut);
    fixture.componentRef.setInput('reparto', []);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain(STRINGS.platformPanel.donutEmpty);
    expect(compiled.querySelector('.donut')).toBeNull();
  });

  it('si la fuente falla: error con reintento, no el mensaje de vacío', () => {
    const fixture = TestBed.createComponent(VerticalDonut);
    fixture.componentRef.setInput('reparto', []);
    fixture.componentRef.setInput('failed', true);
    let reintentos = 0;
    fixture.componentRef.instance.reintentar.subscribe(() => reintentos++);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[role="alert"]')?.textContent).toContain(
      STRINGS.platformPanel.loadError,
    );
    expect(compiled.textContent).not.toContain(STRINGS.platformPanel.donutEmpty);

    compiled.querySelector<HTMLButtonElement>('.state.error button')?.click();
    expect(reintentos).toBe(1);
  });

  it('la carga dibuja el esqueleto y anuncia el estado', () => {
    const fixture = TestBed.createComponent(VerticalDonut);
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const esqueleto = compiled.querySelector('[role="status"][aria-busy="true"]');
    expect(esqueleto).not.toBeNull();
    expect(esqueleto?.getAttribute('aria-label')).toBe(STRINGS.platformPanel.loading);
  });
});
