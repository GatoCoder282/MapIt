import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TenantsService } from '@mapit/api-client';
import type { Tenant, TenantPage } from '@mapit/api-client';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DashboardApi, type ResumenTenants } from '../data/dashboard-api';
import { csvDe, DashboardStore } from './dashboard-store';

const DIA_MS = 24 * 60 * 60 * 1000;

const diasAtras = (dias: number): string => new Date(Date.now() - dias * DIA_MS).toISOString();

/**
 * Mediodía local del lunes de la semana indicada (0 = esta semana). Es la
 * misma ventana lunes→domingo que usa el store para la serie semanal.
 */
const inWeek = (weeksAgo: number): string => {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - ((now.getDay() + 6) % 7) - weeksAgo * 7);
  return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 12).toISOString();
};

const tenant = (over: Partial<Tenant>): Tenant => ({
  id: over.id ?? crypto.randomUUID(),
  name: over.name ?? 'Tenant',
  slug: over.slug ?? 'tenant',
  vertical: over.vertical ?? 'RESTAURANT',
  status: over.status ?? 'ACTIVE',
  createdAt: over.createdAt ?? diasAtras(90),
  updatedAt: over.updatedAt ?? diasAtras(1),
});

function paginaDe(content: Tenant[], totalPages = 1, total = content.length): TenantPage {
  return { content, page: 0, size: 5, totalElements: total, totalPages };
}

const CSV_CABECERA = 'nombre,slug,vertical,estado,alta,ultimo_cambio';

describe('DashboardStore (panel de plataforma)', () => {
  const api = { todos: vi.fn(), pagina: vi.fn() };
  let store: DashboardStore;

  beforeEach(() => {
    api.todos.mockReset();
    api.todos.mockReturnValue(of({ tenants: [], total: 0 }));
    api.pagina.mockReset();
    api.pagina.mockReturnValue(of(paginaDe([])));
    TestBed.configureTestingModule({
      providers: [DashboardStore, { provide: DashboardApi, useValue: api }],
    });
    store = TestBed.inject(DashboardStore);
  });

  it('los totales y los conteos por estado vienen del resumen, no de la página visible', () => {
    api.todos.mockReturnValue(
      of({
        tenants: [
          tenant({ id: '1', status: 'ACTIVE', vertical: 'RESTAURANT', createdAt: inWeek(0) }),
          tenant({ id: '2', status: 'ACTIVE', vertical: 'RESTAURANT', createdAt: inWeek(1) }),
          tenant({ id: '3', status: 'SUSPENDED', vertical: 'HOTEL', createdAt: inWeek(1) }),
        ],
        total: 35, // más tenants de los que trae el array (páginas no pedidas)
      }),
    );
    api.pagina.mockReturnValue(of(paginaDe([tenant({ id: '1' })])));

    store.recargar();

    expect(store.totalTenants()).toBe(35);
    expect(store.tenantsActivos()).toBe(2);
    expect(store.tenantsSuspendidos()).toBe(1);
    // La tabla sí es la página visible: una fila, no tres.
    expect(store.tenants()).toHaveLength(1);
    expect(store.totalElementos()).toBe(1);
  });

  it('el reparto por vertical cuenta las cuatro, con su porcentaje', () => {
    api.todos.mockReturnValue(
      of({
        tenants: [
          tenant({ id: '1', vertical: 'RESTAURANT' }),
          tenant({ id: '2', vertical: 'RESTAURANT' }),
          tenant({ id: '3', vertical: 'HOTEL' }),
        ],
        total: 3,
      }),
    );

    store.recargar();

    expect(store.repartoVertical()).toEqual([
      { vertical: 'RESTAURANT', count: 2, percent: 66.7 },
      { vertical: 'NIGHTCLUB', count: 0, percent: 0 },
      { vertical: 'EVENT_HALL', count: 0, percent: 0 },
      { vertical: 'HOTEL', count: 1, percent: 33.3 },
    ]);
  });

  it('la serie semanal cuenta las altas de esta y la semana anterior', () => {
    api.todos.mockReturnValue(
      of({
        tenants: [
          tenant({ id: '1', createdAt: inWeek(0) }),
          tenant({ id: '2', createdAt: inWeek(0) }),
          tenant({ id: '3', createdAt: inWeek(1) }),
          tenant({ id: '4', createdAt: '' }), // fecha inválida: no se inventa alta
        ],
        total: 4,
      }),
    );

    store.recargar();

    const serie = store.serieAltas();
    expect(serie).toHaveLength(8); // el rango por defecto
    expect(serie[7]?.value).toBe(2);
    expect(serie[6]?.value).toBe(1);
    expect(serie.every((punto) => punto.label.length > 0)).toBe(true);
    expect(store.altasSemana()).toBe(2);
    expect(store.variacionSemana()).toBe(100); // 1 → 2
  });

  it('sin semana anterior no inventa porcentaje: variacionSemana es null', () => {
    api.todos.mockReturnValue(
      of({
        tenants: [tenant({ id: '1', createdAt: inWeek(0) })],
        total: 1,
      }),
    );

    store.recargar();

    expect(store.altasSemana()).toBe(1);
    expect(store.variacionSemana()).toBeNull();
  });

  it('setSemanas cambia el periodo y ignora un valor fuera del catálogo', () => {
    store.recargar();
    expect(store.serieAltas()).toHaveLength(8);

    store.setSemanas(16);
    expect(store.semanas()).toBe(16);
    expect(store.serieAltas()).toHaveLength(16);

    store.setSemanas(9);
    expect(store.semanas()).toBe(16);
  });

  it('requierenAtencion son los suspendidos más los activos con 30+ días sin cambios', () => {
    api.todos.mockReturnValue(
      of({
        tenants: [
          tenant({ id: 's1', status: 'SUSPENDED', updatedAt: diasAtras(1) }),
          tenant({ id: 'v1', status: 'ACTIVE', updatedAt: diasAtras(31) }),
          tenant({ id: 'v2', status: 'ACTIVE', updatedAt: diasAtras(31) }),
          tenant({ id: 'r1', status: 'ACTIVE', updatedAt: diasAtras(2) }),
        ],
        total: 4,
      }),
    );

    store.recargar();

    expect(store.suspendidosEnAtencion()).toBe(1);
    expect(store.sinCambios()).toBe(2);
    expect(store.requierenAtencion()).toBe(3);
  });

  it('el umbral de los 30 días se respeta: un activo con cambios recientes no cuenta', () => {
    api.todos.mockReturnValue(
      of({
        tenants: [
          tenant({ id: 'casi', status: 'ACTIVE', updatedAt: diasAtras(29) }),
          tenant({ id: 'justo', status: 'ACTIVE', updatedAt: diasAtras(31) }),
          tenant({ id: 'suspendido', status: 'SUSPENDED', updatedAt: diasAtras(29) }),
        ],
        total: 3,
      }),
    );

    store.recargar();

    expect(store.sinCambios()).toBe(1); // solo el de 31 días
    expect(store.requierenAtencion()).toBe(2); // + el suspendido
  });

  it('el filtro de estado cambia los parámetros y vuelve a la primera página', () => {
    store.setFiltroEstado('SUSPENDED');

    expect(api.pagina).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'SUSPENDED', page: 0, size: 5 }),
    );
    expect(store.hayFiltros()).toBe(true);

    store.setFiltroEstado('TODOS');
    const llamada = api.pagina.mock.lastCall?.[0] as { status?: string };
    expect(llamada.status).toBeUndefined();
    expect(store.hayFiltros()).toBe(false);
  });

  it('la búsqueda espera su pausa y viaja en los parámetros', () => {
    // Ojo: debounceTime de RxJS solo dispara con fake timers si el reloj
    // (`Date`) también es falso; el `toFake` parcial se queda corto.
    vi.useFakeTimers();
    try {
      api.pagina.mockClear();
      store.setBusqueda('hotel');
      expect(api.pagina).not.toHaveBeenCalled(); // aún en pausa

      vi.advanceTimersByTime(300);

      expect(api.pagina).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'hotel', page: 0, size: 5 }),
      );
      expect(store.hayFiltros()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('una búsqueda de espacios no cuenta como filtro', () => {
    expect(store.hayFiltros()).toBe(false);

    vi.useFakeTimers();
    try {
      store.setBusqueda('   ');
      vi.advanceTimersByTime(300);
      expect(store.hayFiltros()).toBe(false); // se recorta: no hay texto real
    } finally {
      vi.useRealTimers();
    }
  });

  it('irAPagina se acota al rango válido y no repite la página actual', () => {
    // El backend responde con la página pedida: el doble la hace eco.
    api.pagina.mockImplementation(({ page }: { page: number }) =>
      of({ ...paginaDe([tenant({ id: '1' })], 3), page }),
    );
    store.recargar();
    expect(store.totalPaginas()).toBe(3);

    api.pagina.mockClear();
    store.irAPagina(99);
    expect(store.pagina()).toBe(2);
    expect(api.pagina).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));

    store.irAPagina(-5);
    expect(store.pagina()).toBe(0);

    store.irAPagina(0); // ya está ahí: no vuelve a pedir
    expect(api.pagina).toHaveBeenCalledTimes(2);
  });

  it('csvDe arma la cabecera y una fila por tenant, con comillas escapadas', () => {
    const csv = csvDe([
      tenant({
        id: '1',
        name: 'Bar "El Sur"',
        slug: 'bar-el-sur',
        vertical: 'RESTAURANT',
        status: 'ACTIVE',
        createdAt: '2026-01-15T10:00:00Z',
        updatedAt: '2026-10-20T10:00:00Z',
      }),
    ]);

    expect(csv.split('\n')).toEqual([
      CSV_CABECERA,
      '"Bar ""El Sur""","bar-el-sur","RESTAURANT","ACTIVE","2026-01-15T10:00:00Z","2026-10-20T10:00:00Z"',
    ]);
  });

  it('csvDe sin filas exporta solo la cabecera', () => {
    expect(csvDe([])).toBe(CSV_CABECERA);
  });

  it('exportarCsv descarga las filas visibles y libera el objeto', () => {
    api.pagina.mockReturnValue(of(paginaDe([tenant({ id: '1' })])));
    store.recargar();

    const crear = vi.fn((_blob: Blob) => 'blob:prueba');
    const revocar = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      value: crear,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: revocar,
      configurable: true,
      writable: true,
    });
    // jsdom no navega: el click del enlace de descarga se intercepta.
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    store.exportarCsv();

    expect(crear).toHaveBeenCalledTimes(1);
    expect(crear.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
    expect(revocar).toHaveBeenCalledWith('blob:prueba');
  });

  it('un fallo del resumen marca fallandoResumen y conserva la lista', () => {
    api.todos.mockReturnValue(of(null));
    api.pagina.mockReturnValue(of(paginaDe([tenant({ id: '1' })])));

    store.recargar();

    expect(store.fallandoResumen()).toBe(true);
    expect(store.fallandoLista()).toBe(false);
    expect(store.tenants()).toHaveLength(1);
    expect(store.totalTenants()).toBe(0); // el dato no llegó: no se inventa
  });

  it('un fallo de la lista conserva las filas que ya se veían', () => {
    api.pagina.mockReturnValue(of(paginaDe([tenant({ id: '1' })])));
    store.recargar();
    expect(store.tenants()).toHaveLength(1);

    api.pagina.mockReturnValue(of(null));
    store.recargar();

    expect(store.fallandoLista()).toBe(true);
    expect(store.fallandoResumen()).toBe(false);
    expect(store.tenants()).toHaveLength(1);
  });

  it('una recarga con éxito limpia el fallo', () => {
    api.todos.mockReturnValue(of(null));
    store.recargar();
    expect(store.fallandoResumen()).toBe(true);

    api.todos.mockReturnValue(of({ tenants: [], total: 0 }));
    store.recargar();
    expect(store.fallandoResumen()).toBe(false);
  });

  it('la carga es por fuente: la lista asienta y el resumen sigue en curso', () => {
    const resumenPendiente = new Subject<ResumenTenants>();
    api.todos.mockReturnValue(resumenPendiente);

    store.recargar();
    expect(store.cargandoResumen()).toBe(true);
    expect(store.cargandoLista()).toBe(false); // la lista ya asentó

    resumenPendiente.next({ tenants: [], total: 0 });
    resumenPendiente.complete();
    expect(store.cargandoResumen()).toBe(false);
  });

  it('paginar la lista no re-esqueletiza el resumen', () => {
    api.pagina.mockImplementation(({ page }: { page: number }) =>
      of({ ...paginaDe([tenant({ id: '1' })], 3), page }),
    );
    store.recargar();
    expect(store.cargandoResumen()).toBe(false);

    api.pagina.mockReturnValue(new Subject()); // la página siguiente nunca llega
    store.irAPagina(1);

    expect(store.cargandoLista()).toBe(true);
    expect(store.cargandoResumen()).toBe(false);
  });

  it('fallar solo la lista deja las cifras del resumen intactas', () => {
    api.todos.mockReturnValue(of({ tenants: [tenant({ id: '1' })], total: 35 }));
    store.recargar();
    expect(store.totalTenants()).toBe(35);

    api.pagina.mockReturnValue(of(null));
    store.recargar();

    expect(store.fallandoLista()).toBe(true);
    expect(store.fallandoResumen()).toBe(false);
    expect(store.totalTenants()).toBe(35); // la cifra no se borra por un fallo ajeno
  });

  it('fallar solo el resumen deja la tabla viva', () => {
    api.pagina.mockReturnValue(of(paginaDe([tenant({ id: '1' })])));
    store.recargar();

    api.todos.mockReturnValue(of(null));
    store.recargar();

    expect(store.fallandoResumen()).toBe(true);
    expect(store.fallandoLista()).toBe(false);
    expect(store.tenants()).toHaveLength(1);
  });

  it('al destruirse el store, una búsqueda pendiente ya no dispara la petición', () => {
    @Component({ standalone: true, template: '', providers: [DashboardStore] })
    class Anfitrion {}

    const anfitrion = TestBed.createComponent(Anfitrion);
    const storeLocal = anfitrion.debugElement.injector.get(DashboardStore);

    vi.useFakeTimers();
    try {
      api.pagina.mockClear();
      storeLocal.setBusqueda('x');
      anfitrion.destroy();

      vi.advanceTimersByTime(300);

      expect(api.pagina).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('DashboardApi (todas las páginas del resumen)', () => {
  const listTenants = vi.fn();
  let api: DashboardApi;

  beforeEach(() => {
    listTenants.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: TenantsService, useValue: { listTenants } }],
    });
    api = TestBed.inject(DashboardApi);
  });

  it('hasta 100 tenants hace una sola petición de 100', () => {
    listTenants.mockReturnValue(of(paginaDe([tenant({ id: '1' })], 1, 1)));
    let resumen: ResumenTenants | null | undefined;

    api.todos().subscribe((valor) => (resumen = valor));

    expect(listTenants).toHaveBeenCalledTimes(1);
    expect(listTenants).toHaveBeenCalledWith({ page: 0, size: 100 });
    expect(resumen?.total).toBe(1);
    expect(resumen?.tenants).toHaveLength(1);
  });

  it('con más de 100 pide las páginas restantes y concatena todo', () => {
    const paginas = [
      paginaDe(
        Array.from({ length: 100 }, (_, i) => tenant({ id: `a${i}` })),
        3,
        250,
      ),
      paginaDe(
        Array.from({ length: 100 }, (_, i) => tenant({ id: `b${i}` })),
        3,
        250,
      ),
      paginaDe(
        Array.from({ length: 50 }, (_, i) => tenant({ id: `c${i}` })),
        3,
        250,
      ),
    ];
    listTenants.mockImplementation(({ page }: { page: number }) => of(paginas[page]!));
    let resumen: ResumenTenants | null | undefined;

    api.todos().subscribe((valor) => (resumen = valor));

    expect(listTenants).toHaveBeenCalledTimes(3);
    expect(listTenants).toHaveBeenCalledWith({ page: 1, size: 100 });
    expect(listTenants).toHaveBeenCalledWith({ page: 2, size: 100 });
    expect(resumen?.tenants).toHaveLength(250);
    expect(resumen?.total).toBe(250); // el que declara el servidor, no la suma de filas
  });

  it('un fallo de la primera o de una página restante entrega null', () => {
    listTenants.mockReturnValue(throwError(() => new Error('caída')));
    let resumen: ResumenTenants | null | undefined;

    api.todos().subscribe((valor) => (resumen = valor));

    expect(resumen).toBeNull();
  });
});
