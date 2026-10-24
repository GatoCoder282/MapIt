import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideEchartsCore } from 'ngx-echarts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminDashboard } from './dashboard';
import { DashboardStore } from '../model/dashboard-store';
import { MAPIT_ECHARTS_THEME } from '../../../../core/theme/echarts-theme';
import { STRINGS } from '../../../../core/strings';

/**
 * ECharts necesita un canvas real (jsdom no lo tiene), así que el motor se
 * sustituye por un doble: lo que se verifica aquí son los *datos* que llegan
 * a la pantalla, no el pintado del lienzo.
 */
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

const TENANTS = [
  {
    id: 'a',
    name: 'Restaurante Central',
    slug: 'restaurante-central',
    vertical: 'RESTAURANT',
    status: 'ACTIVE',
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-10-20T10:00:00Z',
  },
  {
    id: 'b',
    name: 'Hotel Plaza',
    slug: 'hotel-plaza',
    vertical: 'HOTEL',
    status: 'SUSPENDED',
    createdAt: '2026-02-01T10:00:00Z',
    updatedAt: '2026-10-01T10:00:00Z',
  },
] as const;

describe('AdminDashboard (panel de control de la plataforma)', () => {
  const store = {
    cargandoResumen: signal(false),
    cargandoLista: signal(false),
    fallandoResumen: signal(false),
    fallandoLista: signal(false),
    totalTenants: signal(35),
    tenantsActivos: signal(32),
    tenantsSuspendidos: signal(3),
    altasSemana: signal(7),
    variacionSemana: signal<number | null>(20),
    repartoVertical: signal([
      { vertical: 'RESTAURANT', count: 12, percent: 34.3 },
      { vertical: 'NIGHTCLUB', count: 8, percent: 22.9 },
      { vertical: 'EVENT_HALL', count: 9, percent: 25.7 },
      { vertical: 'HOTEL', count: 6, percent: 17.1 },
    ]),
    requierenAtencion: signal(5),
    sinCambios: signal(2),
    suspendidosEnAtencion: signal(3),
    serieAltas: signal([
      { label: '01 sep', value: 2 },
      { label: '08 sep', value: 4 },
      { label: '15 sep', value: 1 },
    ]),
    semanas: signal(8),
    tenants: signal([...TENANTS]),
    pagina: signal(0),
    totalPaginas: signal(7),
    totalElementos: signal(35),
    busqueda: signal(''),
    filtroEstado: signal<'TODOS' | 'ACTIVE' | 'SUSPENDED'>('TODOS'),
    hayFiltros: signal(false),
    setSemanas: vi.fn(),
    setBusqueda: vi.fn(),
    setFiltroEstado: vi.fn(),
    irAPagina: vi.fn(),
    exportarCsv: vi.fn(),
    recargar: vi.fn(),
  };

  beforeEach(() => {
    store.cargandoResumen.set(false);
    store.cargandoLista.set(false);
    store.fallandoResumen.set(false);
    store.fallandoLista.set(false);
    store.variacionSemana.set(20);
    store.hayFiltros.set(false);
    store.recargar.mockClear();
    store.irAPagina.mockClear();

    TestBed.configureTestingModule({
      imports: [AdminDashboard],
      providers: [
        provideRouter([]),
        { provide: DashboardStore, useValue: store },
        provideEchartsCore({
          echarts: () => Promise.resolve(echartsStub),
          theme: MAPIT_ECHARTS_THEME,
        }),
      ],
    });
  });

  function render() {
    const fixture = TestBed.createComponent(AdminDashboard);
    fixture.detectChanges();
    return fixture;
  }

  it('las cuatro tarjetas de KPI están en la pantalla con su cifra', () => {
    const fixture = render();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('[data-testid="platform-kpi-total"]')).not.toBeNull();
    expect(compiled.querySelector('[data-testid="platform-kpi-nuevos"]')).not.toBeNull();
    expect(compiled.querySelector('[data-testid="platform-kpi-verticales"]')).not.toBeNull();
    expect(compiled.querySelector('[data-testid="platform-kpi-atencion"]')).not.toBeNull();

    const total = compiled.querySelector('[data-testid="platform-kpi-total"]');
    expect(total?.textContent).toContain('35');
  });

  it('el pie de la tarjeta 1 dice los activos y los suspendidos', () => {
    const fixture = render();
    const compiled = fixture.nativeElement as HTMLElement;

    const total = compiled.querySelector('[data-testid="platform-kpi-total"]');
    expect(total?.textContent).toContain(STRINGS.platformPanel.kpiTotalActive.replace('{n}', '32'));
    expect(total?.textContent).toContain(
      STRINGS.platformPanel.kpiTotalSuspended.replace('{n}', '3'),
    );
  });

  it('el pie de la tarjeta 2 da el porcentaje solo cuando hay base real', () => {
    const fixture = render();
    let compiled = fixture.nativeElement as HTMLElement;

    const nuevos = compiled.querySelector('[data-testid="platform-kpi-nuevos"]');
    expect(nuevos?.textContent).toContain('+20 % vs. semana anterior');

    // Sin semana anterior no se inventa un porcentaje: cuenta los altas.
    store.variacionSemana.set(null);
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;

    const sinBase = compiled.querySelector('[data-testid="platform-kpi-nuevos"]');
    expect(sinBase?.textContent).toContain('7 nuevos esta semana');
    expect(sinBase?.textContent).not.toContain('%');
  });

  it('el pie de la tarjeta 4 nombra los suspendidos y los sin cambios', () => {
    const fixture = render();
    const compiled = fixture.nativeElement as HTMLElement;

    const atencion = compiled.querySelector('[data-testid="platform-kpi-atencion"]');
    expect(atencion?.textContent).toContain(
      STRINGS.platformPanel.kpiAttentionSuspended.replace('{n}', '3'),
    );
    expect(atencion?.textContent).toContain(
      STRINGS.platformPanel.kpiAttentionNoChanges.replace('{n}', '2'),
    );
  });

  it('la tarjeta de verticales lista las cuatro con su conteo', () => {
    const fixture = render();
    const compiled = fixture.nativeElement as HTMLElement;

    const verticales = compiled.querySelector('[data-testid="platform-kpi-verticales"]');
    expect(verticales?.textContent).toContain(STRINGS.verticals.RESTAURANT);
    expect(verticales?.textContent).toContain(STRINGS.verticals.NIGHTCLUB);
    expect(verticales?.textContent).toContain('12');
  });

  it('si la fuente del resumen falla, las cifras muestran "—" y no un 0 medido', () => {
    store.fallandoResumen.set(true);
    const fixture = render();
    const compiled = fixture.nativeElement as HTMLElement;

    const total = compiled.querySelector('[data-testid="platform-kpi-total"]');
    expect(total?.textContent).toContain(STRINGS.platformPanel.noValue);
    expect(total?.textContent).not.toContain(
      STRINGS.platformPanel.kpiTotalActive.replace('{n}', '32'),
    );
  });

  it('los dos gráficos y la tabla están en la pantalla', () => {
    const fixture = render();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('[data-testid="platform-panel-altas"]')).not.toBeNull();
    expect(compiled.querySelector('[data-testid="platform-panel-verticales"]')).not.toBeNull();
    expect(compiled.querySelector('[data-testid="platform-panel-tenants"]')).not.toBeNull();
  });

  it('el selector de rango cambia el periodo del gráfico', () => {
    const fixture = render();
    const compiled = fixture.nativeElement as HTMLElement;

    const select = compiled.querySelector<HTMLSelectElement>('.range-select');
    expect(select).not.toBeNull();
    select!.value = '12';
    select!.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(store.setSemanas).toHaveBeenCalledWith(12);
  });

  it('la tabla recibe los tenants del store', () => {
    const fixture = render();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Restaurante Central');
    expect(compiled.textContent).toContain('Hotel Plaza');
  });

  it('el error del listado reintenta sin tumbar el resto del panel', () => {
    store.fallandoLista.set(true);
    const fixture = render();
    const compiled = fixture.nativeElement as HTMLElement;

    const alerta = compiled.querySelector('[role="alert"]');
    expect(alerta?.textContent).toContain(STRINGS.platformPanel.tableError);

    const boton = compiled.querySelector<HTMLButtonElement>('.state.error button');
    boton?.click();

    expect(store.recargar).toHaveBeenCalled();
  });

  it('si el resumen falla, el gráfico de altas muestra su error y reintenta', () => {
    store.fallandoResumen.set(true);
    const fixture = render();
    const compiled = fixture.nativeElement as HTMLElement;

    const panel = compiled.querySelector('[data-testid="platform-panel-altas"]');
    expect(panel?.querySelector('[role="alert"]')?.textContent).toContain(
      STRINGS.platformPanel.loadError,
    );
    expect(panel?.querySelector('mapit-growth-chart')).toBeNull();

    panel?.querySelector<HTMLButtonElement>('.state.error button')?.click();
    expect(store.recargar).toHaveBeenCalled();
  });

  it('los contadores no viven en una región viva', () => {
    const fixture = render();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('[aria-live]')).toBeNull();
  });
});
