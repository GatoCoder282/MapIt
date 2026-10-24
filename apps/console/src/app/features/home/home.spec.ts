import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { provideEchartsCore } from 'ngx-echarts';

import { Home } from './ui/home';
import { HomeStore } from './model/home-store';
import { buildChartOptions, chartMax } from '../../core/charts/growth-chart/growth-chart';
import { buildSparklinePoints } from './ui/sparkline/sparkline';
import { MAPIT_ECHARTS_THEME } from '../../core/theme/echarts-theme';
import {
  TenantsService,
  EstablishmentsService,
  OperationsService,
  TemplatesService,
  ReservationsService,
  PeopleService,
} from '@mapit/api-client';
import type {
  ElementStateSummary,
  Establishment,
  EstablishmentType,
  Person,
  Reservation,
  Tenant,
} from '@mapit/api-client';
import {
  RealtimeClient,
  type RealtimeConnectionState,
  type RealtimeEventEnvelope,
  type SpaceElementState,
} from '@mapit/realtime';
import { FeatureFlagService } from '@mapit/feature-flags';
import { AuthSession } from '@mapit/auth';
import { STRINGS } from '../../core/strings';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const tenant = (status: 'ACTIVE' | 'SUSPENDED'): Partial<Tenant> => ({ status });

/** Foto del resumen: base en cero más lo que indique el test. */
const resumen = (
  total: number,
  byState: Partial<Record<SpaceElementState, number>> = {},
): ElementStateSummary => ({
  total,
  byState: {
    AVAILABLE: 0,
    OCCUPIED: 0,
    RESERVED: 0,
    CLEANING: 0,
    OUT_OF_SERVICE: 0,
    ...byState,
  },
});

/** Envelope STOMP real, como el que publica el backend por topic de establecimiento. */
const evento = (
  establishmentId: string,
  payload: {
    spaceElementId: string;
    previousState?: SpaceElementState;
    state: SpaceElementState;
  },
): RealtimeEventEnvelope => ({
  eventId: crypto.randomUUID(),
  eventType: 'space-element.state.changed.v1',
  schemaVersion: 1,
  occurredAt: new Date().toISOString(),
  establishmentId,
  aggregateVersion: 1,
  payload,
});

/**
 * Doble de RealtimeClient: cada suscripción abre un "canal" (Subject) que el
 * test llena a mano; no se abre ningún socket. `canal.observed` permite
 * verificar las bajas (al salir un establecimiento y al destruir el store).
 */
const canalesRealtime = new Map<string, Subject<RealtimeEventEnvelope>>();
const realtimeClient = {
  connectionState: signal<RealtimeConnectionState>('idle'),
  connect: vi.fn(),
  subscribeEstablishment: vi.fn((id: string) => {
    const canal = new Subject<RealtimeEventEnvelope>();
    canalesRealtime.set(id, canal);
    return canal;
  }),
};

const operationsService = { summarizeSpaceElementStates: vi.fn(() => of(resumen(0))) };

const establishment = (
  type: EstablishmentType,
  createdAt = '',
  address = 'Calle 1',
): Partial<Establishment> => ({
  id: crypto.randomUUID(),
  name: 'Negocio',
  type,
  slug: 'negocio',
  address,
  timezone: 'America/La_Paz',
  createdAt,
  updatedAt: '',
});

/**
 * ECharts necesita un canvas real (jsdom no lo tiene), así que el motor se
 * sustituye por un doble: lo que se verifica aquí son las *opciones* del
 * gráfico, no su pintado.
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

const reservation = (createdAt = ''): Partial<Reservation> => ({
  id: crypto.randomUUID(),
  establishmentId: crypto.randomUUID(),
  personId: crypto.randomUUID(),
  spaceElementIds: new Set<string>(),
  startsAt: '',
  endsAt: '',
  status: 'CREATED',
  createdAt,
  createdBy: 'test',
});

const person = (createdAt = ''): Partial<Person> => ({
  id: crypto.randomUUID(),
  fullName: 'Ana Pérez',
  email: 'ana@example.com',
  phone: null,
  createdAt,
  updatedAt: '',
});

/** Mediodía local: evita que la zona horaria cambie el día de la semana. */
const today = (): string => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12).toISOString();
};

/**
 * Mediodía local del lunes de la semana indicada (0 = esta semana, 1 = la
 * anterior). Es la misma ventana lunes→domingo que usa el store.
 */
const inWeek = (weeksAgo: number): string => {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - ((now.getDay() + 6) % 7) - weeksAgo * 7);
  return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 12).toISOString();
};

describe('Home (dashboard de administrador)', () => {
  let fixture: ComponentFixture<Home>;
  let flagEnabled = false;

  const tenantsService = { listTenants: vi.fn() };
  const establishmentsService = { listEstablishments: vi.fn() };
  const templatesService = { listElementTemplates: vi.fn(() => of([])) };
  const reservationsService = { listReservations: vi.fn() };
  const peopleService = { searchPeople: vi.fn() };
  const authSession = { user: vi.fn(() => ({ fullName: 'Matias', role: 'ADMIN' })) };
  const flagsService = {
    isEnabled: vi.fn(() => signal(flagEnabled)),
    isEnabledNow: vi.fn(() => flagEnabled),
  };

  beforeEach(() => {
    flagEnabled = false;
    // Cada test parte de la misma base: un ADMIN de tenant. Los mocks no se
    // limpian solos entre tests, así que el rol y cada fuente se restauran
    // aquí (si no, el test de SUPER_ADMIN se filtra a los siguientes).
    authSession.user.mockReturnValue({ fullName: 'Matias', role: 'ADMIN' });
    tenantsService.listTenants.mockReturnValue(of(null));
    establishmentsService.listEstablishments.mockReturnValue(of([]));
    reservationsService.listReservations.mockReturnValue(of([]));
    peopleService.searchPeople.mockReturnValue(of([]));
    canalesRealtime.clear();
    realtimeClient.connect.mockClear();
    realtimeClient.subscribeEstablishment.mockClear();
    operationsService.summarizeSpaceElementStates.mockClear();
    operationsService.summarizeSpaceElementStates.mockReturnValue(of(resumen(0)));
    TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        { provide: TenantsService, useValue: tenantsService },
        { provide: EstablishmentsService, useValue: establishmentsService },
        { provide: TemplatesService, useValue: templatesService },
        { provide: ReservationsService, useValue: reservationsService },
        { provide: PeopleService, useValue: peopleService },
        { provide: OperationsService, useValue: operationsService },
        { provide: RealtimeClient, useValue: realtimeClient },
        { provide: FeatureFlagService, useValue: flagsService },
        { provide: AuthSession, useValue: authSession },
        provideEchartsCore({
          echarts: () => Promise.resolve(echartsStub),
          theme: MAPIT_ECHARTS_THEME,
        }),
      ],
    });
    fixture = TestBed.createComponent(Home);
  });

  it('un ADMIN de tenant ve sus negocios sin llamar a /tenants (CA-1, CA-2)', () => {
    establishmentsService.listEstablishments.mockReturnValue(
      of([establishment('RESTAURANT'), establishment('RESTAURANT'), establishment('HOTEL')]),
    );

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('3'); // total negocios
    expect(compiled.textContent).toContain(STRINGS.adminDashboardHome.kpiBusinesses);
    expect(tenantsService.listTenants).not.toHaveBeenCalled();
  });

  it('un 403 de /tenants no tumba el dashboard del ADMIN (tolerancia por fuente)', () => {
    establishmentsService.listEstablishments.mockReturnValue(of([establishment('NIGHTCLUB')]));
    // Aunque el servicio llegara a llamarse y el backend devolviera 403:
    tenantsService.listTenants.mockReturnValue(throwError(() => new Error('403')));

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('1'); // su negocio
    expect(compiled.textContent).not.toContain(STRINGS.adminDashboardHome.loadError);
  });

  it('un SUPER_ADMIN ve además los KPIs de tenants (CA-1)', () => {
    authSession.user.mockReturnValue({ fullName: 'Super', role: 'SUPER_ADMIN' });
    tenantsService.listTenants.mockReturnValue(
      of({
        content: [tenant('ACTIVE'), tenant('ACTIVE'), tenant('SUSPENDED')],
        page: 0,
        size: 1,
        totalElements: 3,
        totalPages: 1,
      }),
    );
    establishmentsService.listEstablishments.mockReturnValue(of([]));

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('3'); // total tenants
  });

  it('si los negocios fallan, muestra error con reintento que recupera (CA-3)', () => {
    establishmentsService.listEstablishments.mockReturnValue(throwError(() => new Error('caída')));

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain(STRINGS.adminDashboardHome.loadError);
    const button = compiled.querySelector('button');
    expect(button).not.toBeNull();

    establishmentsService.listEstablishments.mockReturnValue(of([]));
    button!.click();
    fixture.detectChanges();

    expect(compiled.textContent).not.toContain(STRINGS.adminDashboardHome.loadError);
  });

  // Los tests de `leadingVertical` y `configuredCount` se fueron con la v7:
  // los KPI "Vertical principal" y "Perfiles completos" salieron del dashboard
  // y sus derivados con ellos.

  it('sortedEstablishments conserva todos los negocios', () => {
    establishmentsService.listEstablishments.mockReturnValue(
      of(Array.from({ length: 8 }, () => establishment('RESTAURANT'))),
    );

    fixture.detectChanges();

    const store = TestBed.inject(HomeStore);
    expect(store.sortedEstablishments()).toHaveLength(8);
    expect(store.recentEstablishments()).toHaveLength(6);
  });

  it('growthSeries devuelve 8 puntos y cuenta el alta de hoy', () => {
    establishmentsService.listEstablishments.mockReturnValue(
      of([establishment('HOTEL', today()), establishment('RESTAURANT')]),
    );

    fixture.detectChanges();

    const store = TestBed.inject(HomeStore);
    const series = store.growthSeries();
    expect(series).toHaveLength(8);
    expect(series[7]?.value).toBe(1);
    expect(store.newThisWeek()).toBe(1);
    expect(store.growthMax()).toBe(1);
    expect(series.every((point) => point.label.length > 0)).toBe(true);
  });

  it('ignora createdAt vacío y growthMax nunca es 0', () => {
    establishmentsService.listEstablishments.mockReturnValue(
      of([establishment('RESTAURANT'), establishment('NIGHTCLUB')]),
    );

    fixture.detectChanges();

    const store = TestBed.inject(HomeStore);
    expect(store.growthSeries().every((point) => point.value === 0)).toBe(true);
    expect(store.growthMax()).toBe(1);
    expect(store.newThisWeek()).toBe(0);
    expect(store.activityItems()).toHaveLength(0);
  });

  it('newThisWeek cuenta solo las altas de la semana actual', () => {
    establishmentsService.listEstablishments.mockReturnValue(
      of([establishment('RESTAURANT', today()), establishment('HOTEL', today())]),
    );

    fixture.detectChanges();

    const store = TestBed.inject(HomeStore);
    expect(store.newThisWeek()).toBe(2);
  });

  it('las reservas y las personas tienen su propia serie de 8 semanas', () => {
    reservationsService.listReservations.mockReturnValue(
      of([reservation(inWeek(0)), reservation(inWeek(1)), reservation('')]),
    );
    peopleService.searchPeople.mockReturnValue(of([person(inWeek(0))]));

    fixture.detectChanges();

    const store = TestBed.inject(HomeStore);
    const series = store.reservationsGrowthSeries();
    expect(series).toHaveLength(8);
    expect(series[7]?.value).toBe(1); // la de esta semana
    expect(series[6]?.value).toBe(1); // la de la semana anterior
    expect(series.every((point) => point.label.length > 0)).toBe(true);
    expect(store.totalReservations()).toBe(3);
    expect(store.totalPeople()).toBe(1);
    expect(store.peopleGrowthSeries()).toHaveLength(8);
  });

  it('el delta semanal compara con la semana anterior real', () => {
    reservationsService.listReservations.mockReturnValue(
      of([
        reservation(inWeek(0)),
        reservation(inWeek(0)),
        reservation(inWeek(0)),
        reservation(inWeek(1)),
        reservation(inWeek(1)),
      ]),
    );
    peopleService.searchPeople.mockReturnValue(
      of([person(inWeek(1)), person(inWeek(1)), person(inWeek(0))]),
    );

    fixture.detectChanges();

    const store = TestBed.inject(HomeStore);
    expect(store.reservationsWeekGrowthPercent()).toBe(50); // 2 -> 3
    expect(store.newReservationsThisWeek()).toBe(3);
    expect(store.peopleWeekGrowthPercent()).toBe(-50); // 2 -> 1
    expect(store.newPeopleThisWeek()).toBe(1);
  });

  it('sin semana anterior no inventa porcentaje: cuenta "N nuevas esta semana"', () => {
    reservationsService.listReservations.mockReturnValue(of([reservation(inWeek(0))]));
    peopleService.searchPeople.mockReturnValue(of([person(inWeek(0))]));

    fixture.detectChanges();

    const store = TestBed.inject(HomeStore);
    expect(store.reservationsWeekGrowthPercent()).toBeNull();
    expect(store.newReservationsThisWeek()).toBe(1);
    expect(store.peopleWeekGrowthPercent()).toBeNull();
    expect(store.newPeopleThisWeek()).toBe(1);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('1 nueva esta semana');
    expect(compiled.textContent).not.toContain('+100%');
  });

  it('un 0% real se muestra como 0%, no como "Sin datos"', () => {
    reservationsService.listReservations.mockReturnValue(
      of([reservation(inWeek(0)), reservation(inWeek(1))]),
    );

    fixture.detectChanges();

    const store = TestBed.inject(HomeStore);
    expect(store.reservationsWeekGrowthPercent()).toBe(0);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('0%');
  });

  it('las métricas sin fuente de datos muestran "—" y "Sin datos"', () => {
    establishmentsService.listEstablishments.mockReturnValue(of([]));

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain(STRINGS.adminDashboardHome.noValue);
    expect(compiled.textContent).toContain(STRINGS.adminDashboardHome.noData);
    expect(compiled.textContent).toContain(STRINGS.adminDashboardHome.paymentsQrLabel);
    expect(compiled.textContent).toContain(STRINGS.adminDashboardHome.paymentsRevenueLabel);
    expect(compiled.textContent).toContain(STRINGS.adminDashboardHome.paymentsConversionLabel);
  });

  it('la nota del panel de pagos cambia con la flag payments.qr', () => {
    establishmentsService.listEstablishments.mockReturnValue(of([]));

    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain(STRINGS.adminDashboardHome.paymentsPendingNote);

    flagEnabled = true;
    fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      STRINGS.adminDashboardHome.paymentsEnabledNote,
    );
  });

  it('un fallo de /reservations o /people no tumba el dashboard', () => {
    establishmentsService.listEstablishments.mockReturnValue(of([establishment('HOTEL')]));
    reservationsService.listReservations.mockReturnValue(
      throwError(() => new Error('caída de reservas')),
    );
    peopleService.searchPeople.mockReturnValue(throwError(() => new Error('caída de personas')));

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).not.toContain(STRINGS.adminDashboardHome.loadError);
    expect(compiled.textContent).toContain('1'); // su negocio
  });

  it('el gráfico nunca divide por cero y aplana la serie vacía', () => {
    const options = buildChartOptions(
      [
        { value: 0, label: 'a' },
        { value: 0, label: 'b' },
      ],
      'Gráfico de prueba',
      'Altas por semana',
    );

    // El eje nunca vale 0: con todo en cero vale 1 y la línea queda plana.
    expect(options.yAxis.max).toBe(1);
    expect(options.yAxis.interval).toBe(1);
    expect(options.series[0]?.data).toEqual([0, 0]);
    // Con max = 1 el intervalo es 1 (si fuera la mitad se repetiría la etiqueta).
    expect(options.yAxis.axisLabel.formatter(0.5)).toBe('1');
    expect(options.yAxis.axisLabel.formatter(1)).toBe('1');
    expect(options.yAxis.axisLabel.formatter(0)).toBe('0');
  });

  it('el gráfico escala la serie contra su máximo', () => {
    const options = buildChartOptions(
      [
        { value: 0, label: 'a' },
        { value: 4, label: 'b' },
        { value: 2, label: 'c' },
      ],
      'Gráfico de prueba',
      'Altas por semana',
    );

    expect(options.yAxis.max).toBe(4);
    expect(options.yAxis.interval).toBe(2);
    expect(options.series[0]?.data).toEqual([0, 4, 2]);
    expect(options.xAxis.data).toEqual(['a', 'b', 'c']);
  });

  it('el máximo del eje nunca es 0, ni con la serie vacía', () => {
    expect(chartMax([])).toBe(1);
    expect(chartMax([{ value: 0, label: 'a' }])).toBe(1);
    expect(chartMax([{ value: 7, label: 'a' }])).toBe(7);
  });

  it('las opciones del gráfico reproducen la spec (área, línea y puntos)', () => {
    const options = buildChartOptions(
      [{ value: 3, label: '05 oct' }],
      'Gráfico de prueba',
      'Altas por semana',
    );
    const serie = options.series[0];

    expect(serie?.type).toBe('line');
    expect(serie?.smooth).toBe(false);
    expect(serie?.symbol).toBe('circle');
    expect(serie?.symbolSize).toBe(7);
    expect(serie?.lineStyle.width).toBe(2.5);
    expect(serie?.lineStyle.cap).toBe('round');
    expect(serie?.lineStyle.join).toBe('round');
    expect(serie?.areaStyle.opacity).toBe(0.12);
    expect(serie?.itemStyle.borderWidth).toBe(2);
  });

  it('el gráfico no anima la carga inicial (Regla 6 de dashboards)', () => {
    const options = buildChartOptions([{ value: 1, label: 'a' }], 'Gráfico', undefined);
    expect(options.animation).toBe(false);
  });

  it('el gráfico se describe a los lectores de pantalla (aria)', () => {
    const options = buildChartOptions(
      [
        { value: 0, label: 'a' },
        { value: 4, label: 'b' },
      ],
      'Gráfico de crecimiento de negocios, últimas 8 semanas',
      'Altas por semana',
    );

    expect(options.aria.enabled).toBe(true);
    expect(options.aria.description).toContain(
      'Gráfico de crecimiento de negocios, últimas 8 semanas',
    );
    expect(options.aria.description).toContain('Máximo 4');
    expect(options.aria.description).toContain('mínimo 0');
    expect(options.aria.description).toContain('total 4');
  });

  it('el tooltip del gráfico enseña la semana, el valor y la unidad', () => {
    const options = buildChartOptions(
      [{ value: 3, label: '05 oct' }],
      'Gráfico de prueba',
      'Altas por semana',
    );
    const html = options.tooltip.formatter([{ axisValueLabel: '05 oct', value: 3 }]);

    expect(html).toContain('05 oct');
    expect(html).toContain('3');
    expect(html).toContain('Altas por semana');
  });

  /* ── Rango del periodo ─────────────────────────────────────── */

  it('la serie sigue el rango seleccionado y las dos series reaccionan', () => {
    establishmentsService.listEstablishments.mockReturnValue(of([establishment('HOTEL', today())]));
    reservationsService.listReservations.mockReturnValue(of([reservation(inWeek(0))]));

    fixture.detectChanges();

    const store = TestBed.inject(HomeStore);
    expect(store.rangeWeeks()).toBe(8);
    expect(store.growthSeries()).toHaveLength(8);
    expect(store.reservationsGrowthSeries()).toHaveLength(8);

    store.setRangeFromValue('4');
    fixture.detectChanges();
    expect(store.growthSeries()).toHaveLength(4);
    expect(store.reservationsGrowthSeries()).toHaveLength(4);
    expect(store.growthSeriesValues()).toHaveLength(4);

    store.setRangeFromValue('12');
    fixture.detectChanges();
    expect(store.growthSeries()).toHaveLength(12);
    expect(store.reservationsGrowthSeries()).toHaveLength(12);

    // Un rango que no existe se ignora: el signal no sale de la unión cerrada.
    store.setRangeFromValue('99');
    fixture.detectChanges();
    expect(store.rangeWeeks()).toBe(12);
  });

  it('el selector del panel cambia el periodo de los dos gráficos', () => {
    establishmentsService.listEstablishments.mockReturnValue(of([establishment('HOTEL', today())]));
    reservationsService.listReservations.mockReturnValue(of([reservation(inWeek(0))]));

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const selects = compiled.querySelectorAll<HTMLSelectElement>('select.range-select');
    expect(selects.length).toBe(2);

    const select = selects[0];
    expect(select).toBeDefined();
    select!.value = '4';
    select!.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const store = TestBed.inject(HomeStore);
    expect(store.rangeWeeks()).toBe(4);
    expect(store.growthSeries()).toHaveLength(4);
    expect(store.reservationsGrowthSeries()).toHaveLength(4);
    // Los dos selectores están enlazados al mismo periodo.
    expect(selects[0]?.value).toBe('4');
    expect(selects[1]?.value).toBe('4');
  });

  it('el total del periodo es la suma de la serie visible', () => {
    establishmentsService.listEstablishments.mockReturnValue(
      of([
        establishment('HOTEL', inWeek(0)),
        establishment('HOTEL', inWeek(0)),
        establishment('HOTEL', inWeek(1)),
      ]),
    );

    fixture.detectChanges();

    const store = TestBed.inject(HomeStore);
    expect(store.growthPeriodTotal()).toBe(3);

    const compiled = fixture.nativeElement as HTMLElement;
    // El total del panel de crecimiento: el de ocupación también lleva un
    // `.panel-total` (el patrón 2 del kit), así que la búsqueda va acotada.
    const total = compiled.querySelector('[data-testid="home-panel-crecimiento"] .panel-total');
    expect(total?.textContent).toContain('3');
    expect(total?.textContent).toContain(STRINGS.adminDashboardHome.periodTotalAltas);
  });

  it('el pie compara el periodo contra su primera semana', () => {
    establishmentsService.listEstablishments.mockReturnValue(
      of([
        establishment('HOTEL', inWeek(0)),
        establishment('HOTEL', inWeek(0)),
        establishment('HOTEL', inWeek(7)),
      ]),
    );

    fixture.detectChanges();

    const store = TestBed.inject(HomeStore);
    const comparison = store.growthPeriodDelta();
    // La primera semana visible (hace 7 semanas) tiene 1 alta y la última 2.
    expect(comparison.percent).toBe(100);
    expect(comparison.absolute).toBe(1);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('+100%');
    expect(compiled.textContent).toContain(STRINGS.adminDashboardHome.periodDeltaVsFirst);
  });

  it('sin base real el pie no inventa porcentaje: muestra el conteo', () => {
    establishmentsService.listEstablishments.mockReturnValue(
      of([establishment('HOTEL', inWeek(0)), establishment('HOTEL', inWeek(0))]),
    );

    fixture.detectChanges();

    const store = TestBed.inject(HomeStore);
    const comparison = store.growthPeriodDelta();
    expect(comparison.percent).toBeNull(); // la primera semana del periodo fue 0
    expect(comparison.absolute).toBe(2);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('+2 ' + STRINGS.adminDashboardHome.periodTotalAltas);
    expect(compiled.textContent).not.toContain('+100%');
  });

  it('el delta de los KPI sigue siendo semanal aunque cambie el rango', () => {
    reservationsService.listReservations.mockReturnValue(
      of([reservation(inWeek(0)), reservation(inWeek(0)), reservation(inWeek(1))]),
    );

    fixture.detectChanges();

    const store = TestBed.inject(HomeStore);
    expect(store.reservationsWeekGrowthPercent()).toBe(100); // 1 -> 2

    store.setRangeFromValue('12');
    fixture.detectChanges();

    expect(store.reservationsWeekGrowthPercent()).toBe(100);
    expect(store.reservationsGrowthSeries()).toHaveLength(12);
  });

  /* ── Sparkline ─────────────────────────────────────────────── */

  it('el sparkline se dibuja con serie real y no se dibuja sin ella', () => {
    establishmentsService.listEstablishments.mockReturnValue(of([establishment('HOTEL', today())]));

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    // El KPI de negocios tiene serie real: hay sparkline.
    const conSerie = compiled.querySelector('[data-testid="home-kpi-negocios"]');
    expect(conSerie?.querySelector('mapit-sparkline polyline')).not.toBeNull();
    // El sparkline vive en la fila del valor y es uno solo: si saliera de ahí,
    // ocuparía sitio en la línea flex de la tarjeta, aplastaría el cuerpo y el
    // label se iría a tres líneas (la fila de valores dejaría de compartir
    // línea base).
    expect(conSerie?.querySelectorAll('mapit-sparkline')).toHaveLength(1);
    expect(conSerie?.querySelector('.value-row mapit-sparkline polyline')).not.toBeNull();
    // El KPI de ocupación no tiene serie: no hay sparkline (no hay dato
    // inventado). El histórico de ocupación todavía no existe.
    const sinSerie = compiled.querySelector('[data-testid="home-kpi-ocupacion"]');
    expect(sinSerie?.querySelector('mapit-sparkline')).toBeNull();
  });

  it('la fila de KPIs solo muestra los KPI con sentido (v7)', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    // Se quedan: negocios, reservas y ocupación (más tenants para el
    // SUPER_ADMIN). Salen: plantillas, perfiles completos y vertical
    // principal, que no eran métricas del negocio.
    expect(compiled.querySelector('[data-testid="home-kpi-negocios"]')).not.toBeNull();
    expect(compiled.querySelector('[data-testid="home-kpi-reservas"]')).not.toBeNull();
    expect(compiled.querySelector('[data-testid="home-kpi-ocupacion"]')).not.toBeNull();
    expect(compiled.querySelector('[data-testid="home-kpi-perfiles"]')).toBeNull();
    expect(compiled.querySelector('[data-testid="home-kpi-vertical"]')).toBeNull();
  });

  it('sin acceso a las reservas y las personas (SUPER_ADMIN) no se inventa un 0: "Sin datos"', () => {
    authSession.user.mockReturnValue({ fullName: 'Super', role: 'SUPER_ADMIN' });

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const reservas = compiled.querySelector('[data-testid="home-kpi-reservas"]');
    expect(reservas?.textContent).toContain(STRINGS.adminDashboardHome.noValue);
    expect(reservas?.textContent).toContain(STRINGS.adminDashboardHome.noData);
    expect(reservas?.textContent).not.toContain(STRINGS.adminDashboardHome.kpiNewThisWeek);

    const personas = compiled.querySelector('[data-testid="home-kpi-personas"]');
    expect(personas?.textContent).toContain(STRINGS.adminDashboardHome.noData);
  });

  it('el panel de ocupación está en la pantalla, con el KPI que lo resume', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="home-panel-ocupacion"]')).not.toBeNull();
    expect(compiled.textContent).toContain(STRINGS.adminDashboardHome.occupancyPanelTitle);
    expect(compiled.textContent).toContain(STRINGS.adminDashboardHome.kpiOccupancy);
  });

  it('el sparkline normaliza la serie y no dibuja nada sin datos', () => {
    expect(buildSparklinePoints([])).toBe('');
    expect(buildSparklinePoints([3])).toBe('');
    expect(buildSparklinePoints([1, 2, 3])).toBe('0.00,23.00 32.00,12.00 64.00,1.00');
    // Serie plana: línea horizontal en el centro.
    expect(buildSparklinePoints([2, 2, 2])).toBe('0.00,12.00 32.00,12.00 64.00,12.00');
  });
});

/* ── Ocupación en vivo: el store sin renderizar ──────────────── */

describe('HomeStore — ocupación en vivo', () => {
  const establishmentsService = { listEstablishments: vi.fn() };
  const tenantsService = { listTenants: vi.fn() };
  const templatesService = { listElementTemplates: vi.fn() };
  const reservationsService = { listReservations: vi.fn() };
  const peopleService = { searchPeople: vi.fn() };
  const authSession = { user: vi.fn(() => ({ fullName: 'Matias', role: 'ADMIN' })) };
  let store: HomeStore;

  /**
   * Carga el panel con un establecimiento y una foto conocida: 3 elementos,
   * 2 disponibles y 1 ocupado.
   */
  const cargarEscenario = (): string => {
    const id = crypto.randomUUID();
    establishmentsService.listEstablishments.mockReturnValue(
      of([{ ...establishment('RESTAURANT'), id }]),
    );
    operationsService.summarizeSpaceElementStates.mockReturnValue(
      of(resumen(3, { AVAILABLE: 2, OCCUPIED: 1 })),
    );
    store.reload();
    return id;
  };

  beforeEach(() => {
    canalesRealtime.clear();
    realtimeClient.connectionState.set('idle');
    realtimeClient.connect.mockClear();
    realtimeClient.subscribeEstablishment.mockClear();
    operationsService.summarizeSpaceElementStates.mockClear();
    operationsService.summarizeSpaceElementStates.mockReturnValue(of(resumen(0)));
    establishmentsService.listEstablishments.mockReturnValue(of([]));
    tenantsService.listTenants.mockReturnValue(of(null));
    reservationsService.listReservations.mockReturnValue(of([]));
    peopleService.searchPeople.mockReturnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        { provide: TenantsService, useValue: tenantsService },
        { provide: EstablishmentsService, useValue: establishmentsService },
        { provide: TemplatesService, useValue: templatesService },
        { provide: ReservationsService, useValue: reservationsService },
        { provide: PeopleService, useValue: peopleService },
        { provide: OperationsService, useValue: operationsService },
        { provide: RealtimeClient, useValue: realtimeClient },
        { provide: AuthSession, useValue: authSession },
      ],
    });
    store = TestBed.inject(HomeStore);
  });

  it('el resumen carga y el conteo tiene siempre las cinco claves', () => {
    expect(store.conteoPorEstado()).toEqual(resumen(0).byState); // antes de cargar: todo 0
    expect(store.totalElementos()).toBe(0);

    operationsService.summarizeSpaceElementStates.mockReturnValue(
      of(resumen(6, { AVAILABLE: 2, OCCUPIED: 1, RESERVED: 1, CLEANING: 1, OUT_OF_SERVICE: 1 })),
    );
    store.reload();

    expect(store.resumenEstados()).not.toBeNull();
    expect(store.totalElementos()).toBe(6);
    expect(Object.keys(store.conteoPorEstado()).sort()).toEqual([
      'AVAILABLE',
      'CLEANING',
      'OCCUPIED',
      'OUT_OF_SERVICE',
      'RESERVED',
    ]);
    expect(store.elementosOperativos()).toBe(5); // 6 − 1 fuera de servicio
  });

  it('el panel distingue "cargando" de "fallido": con el resumen en vuelo no muestra error', () => {
    const pendiente = new Subject<ElementStateSummary>();
    operationsService.summarizeSpaceElementStates.mockReturnValue(pendiente);

    store.reload();
    expect(store.resumenCargando()).toBe(true);
    expect(store.resumenError()).toBe(false);

    pendiente.next(resumen(4, { AVAILABLE: 4 }));
    pendiente.complete();
    expect(store.resumenCargando()).toBe(false);
    expect(store.resumenError()).toBe(false);
    expect(store.totalElementos()).toBe(4);
  });

  it('el resumen fallido marca error; con datos en pantalla un refresco fallido no borra lo que se ve', () => {
    operationsService.summarizeSpaceElementStates.mockReturnValue(
      throwError(() => new Error('fallo de red')),
    );
    store.reload();
    expect(store.resumenCargando()).toBe(false);
    expect(store.resumenError()).toBe(true);

    operationsService.summarizeSpaceElementStates.mockReturnValue(of(resumen(3, { AVAILABLE: 3 })));
    store.refrescarResumenEstados();
    expect(store.resumenError()).toBe(false);
    expect(store.totalElementos()).toBe(3);

    // Un refresco que falla con datos ya en pantalla no eclipsa el vivo.
    operationsService.summarizeSpaceElementStates.mockReturnValue(
      throwError(() => new Error('fallo de red')),
    );
    store.refrescarResumenEstados();
    expect(store.resumenError()).toBe(false);
    expect(store.totalElementos()).toBe(3);
  });

  it('porcentajeOcupacion es ocupadas entre operables, con un decimal', () => {
    operationsService.summarizeSpaceElementStates.mockReturnValue(of(resumen(3, { OCCUPIED: 1 })));
    store.reload();

    expect(store.porcentajeOcupacion()).toBe(33.3); // 1 de 3 = 33.33… → 33.3
  });

  it('porcentajeOcupacion es 0 real con operables libres y null sin nada operable', () => {
    expect(store.porcentajeOcupacion()).toBeNull(); // aún sin foto: nada que medir

    operationsService.summarizeSpaceElementStates.mockReturnValue(of(resumen(1, { AVAILABLE: 1 })));
    store.reload();
    expect(store.porcentajeOcupacion()).toBe(0);

    // Todo fuera de servicio: no hay operables entre los que medir ocupación.
    operationsService.summarizeSpaceElementStates.mockReturnValue(
      of(resumen(1, { OUT_OF_SERVICE: 1 })),
    );
    store.refrescarResumenEstados();
    expect(store.porcentajeOcupacion()).toBeNull();
  });

  it('un evento con previousState mueve los conteos: baja el previo, sube el nuevo, total igual', () => {
    const id = cargarEscenario();

    canalesRealtime
      .get(id)
      ?.next(
        evento(id, { spaceElementId: 'mesa-1', previousState: 'AVAILABLE', state: 'OCCUPIED' }),
      );

    expect(store.conteoPorEstado()).toEqual({
      AVAILABLE: 1,
      OCCUPIED: 2,
      RESERVED: 0,
      CLEANING: 0,
      OUT_OF_SERVICE: 0,
    });
    expect(store.totalElementos()).toBe(3); // el total no lo mueven los eventos

    // Un estado previo que ya estaba a 0 no genera negativos.
    canalesRealtime
      .get(id)
      ?.next(
        evento(id, { spaceElementId: 'mesa-2', previousState: 'CLEANING', state: 'OCCUPIED' }),
      );
    expect(store.conteoPorEstado().CLEANING).toBe(0);
    expect(store.conteoPorEstado().OCCUPIED).toBe(3);
  });

  it('un evento sin previousState no se aplica a mano: refresca el resumen', () => {
    const id = cargarEscenario();
    expect(operationsService.summarizeSpaceElementStates).toHaveBeenCalledTimes(1);

    operationsService.summarizeSpaceElementStates.mockReturnValue(
      of(resumen(4, { AVAILABLE: 4 })), // llegó una mesa nueva
    );
    canalesRealtime.get(id)?.next(evento(id, { spaceElementId: 'mesa-nueva', state: 'AVAILABLE' }));

    expect(operationsService.summarizeSpaceElementStates).toHaveBeenCalledTimes(2);
    expect(store.totalElementos()).toBe(4); // la foto nueva mandó
  });

  it('una ráfaga de eventos deriva en un solo refresco del resumen (corrección de deriva)', () => {
    vi.useFakeTimers();
    try {
      const id = cargarEscenario();
      expect(operationsService.summarizeSpaceElementStates).toHaveBeenCalledTimes(1);

      for (let i = 0; i < 5; i++) {
        canalesRealtime.get(id)?.next(
          evento(id, {
            spaceElementId: `mesa-${i}`,
            previousState: 'AVAILABLE',
            state: 'OCCUPIED',
          }),
        );
      }

      // El delta es local: ningún GET durante la ráfaga.
      expect(operationsService.summarizeSpaceElementStates).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(999);
      expect(operationsService.summarizeSpaceElementStates).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1);
      expect(operationsService.summarizeSpaceElementStates).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('se suscribe por establecimiento al conocerse la lista y re-sincroniza si cambia', () => {
    const idA = crypto.randomUUID();
    const idB = crypto.randomUUID();
    establishmentsService.listEstablishments.mockReturnValue(
      of([
        { ...establishment('RESTAURANT'), id: idA },
        { ...establishment('HOTEL'), id: idB },
      ]),
    );
    store.reload();

    expect(realtimeClient.connect).toHaveBeenCalled();
    expect(realtimeClient.subscribeEstablishment).toHaveBeenCalledTimes(2);
    expect(canalesRealtime.get(idA)?.observed).toBe(true);
    expect(canalesRealtime.get(idB)?.observed).toBe(true);

    // Cambia la lista: A sale (se da de baja), C entra; B no se re-suscribe.
    const idC = crypto.randomUUID();
    realtimeClient.subscribeEstablishment.mockClear();
    establishmentsService.listEstablishments.mockReturnValue(
      of([
        { ...establishment('HOTEL'), id: idB },
        { ...establishment('RESTAURANT'), id: idC },
      ]),
    );
    store.reload();

    expect(realtimeClient.subscribeEstablishment).toHaveBeenCalledTimes(1);
    expect(canalesRealtime.get(idB)?.observed).toBe(true);
    expect(canalesRealtime.get(idA)?.observed).toBe(false);
    expect(canalesRealtime.get(idC)?.observed).toBe(true);
  });

  it('al destruirse el store se dan de baja sus suscripciones (sin fugas)', () => {
    @Component({ standalone: true, template: '', providers: [HomeStore] })
    class Anfitrion {}

    const anfitrion = TestBed.createComponent(Anfitrion);
    const storeLocal = anfitrion.debugElement.injector.get(HomeStore);
    const id = crypto.randomUUID();
    establishmentsService.listEstablishments.mockReturnValue(
      of([{ ...establishment('RESTAURANT'), id }]),
    );
    storeLocal.reload();
    expect(canalesRealtime.get(id)?.observed).toBe(true);

    anfitrion.destroy();

    expect(canalesRealtime.get(id)?.observed).toBe(false);
  });

  it('con el kill switch (conexión disabled) el panel sigue funcionando con la foto', () => {
    realtimeClient.connectionState.set('disabled');

    const id = cargarEscenario();
    canalesRealtime
      .get(id)
      ?.next(
        evento(id, { spaceElementId: 'mesa-1', previousState: 'AVAILABLE', state: 'OCCUPIED' }),
      );

    expect(store.conexionRealtime()).toBe('disabled');
    expect(store.resumenEstados()).not.toBeNull();
    expect(store.totalElementos()).toBe(3);
  });

  it('los tres KPIs muertos ya no existen en el store y no se piden plantillas', () => {
    const superficie = store as unknown as Record<string, unknown>;

    expect(superficie['leadingVertical']).toBeUndefined();
    expect(superficie['configuredCount']).toBeUndefined();
    expect(superficie['configuredPercent']).toBeUndefined();
    expect(superficie['totalTemplates']).toBeUndefined();
    expect(superficie['templatesThisWeek']).toBeUndefined();

    store.reload();

    expect(templatesService.listElementTemplates).not.toHaveBeenCalled();
  });
});
