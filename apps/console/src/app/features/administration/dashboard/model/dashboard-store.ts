import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { BusinessVertical, Tenant, TenantStatus } from '@mapit/api-client';
import { currentLocaleTag } from '@mapit/i18n';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

import { DashboardApi } from '../data/dashboard-api';

/**
 * Un cubo semanal del gráfico de altas: valor y etiqueta de la semana
 * (misma forma que `WeeklyPoint` del dashboard de home).
 */
export interface WeeklyPoint {
  readonly label: string;
  readonly value: number;
}

/** Una porción del reparto por vertical: conteo y porcentaje sobre el total. */
export interface VerticalReparto {
  readonly vertical: BusinessVertical;
  readonly count: number;
  readonly percent: number;
}

/** Filtro de estado de la tabla: el vocabulario del contrato más "todos". */
export type PlatformEstadoFiltro = 'TODOS' | 'ACTIVE' | 'SUSPENDED';

/** Filas por página de la tabla (spec del panel de plataforma). */
const FILAS_POR_PAGINA = 5;

/**
 * Días sin modificar (`updatedAt`) a partir de los cuales un tenant activo
 * "requiere atención". El contrato no trae actividad del negocio: `updatedAt`
 * es el sustituto honesto y la UI lo etiqueta "sin cambios en 30+ días".
 */
const DIAS_SIN_CAMBIO = 30;

const DIA_MS = 24 * 60 * 60 * 1000;
const SEMANA_MS = 7 * DIA_MS;

/** Rangos de periodo que ofrece el selector del gráfico (semanas). */
const RANGOS_SEMANA: readonly number[] = [8, 12, 16];

/** Búsqueda con pausa para no golpear la API en cada tecla. */
const PAUSA_BUSQUEDA_MS = 300;

/** Orden estable de las verticales: el del contrato. */
const VERTICALES: readonly BusinessVertical[] = ['RESTAURANT', 'NIGHTCLUB', 'EVENT_HALL', 'HOTEL'];

const etiquetaSemana = (date: Date): string =>
  new Intl.DateTimeFormat(currentLocaleTag(), { day: '2-digit', month: 'short' }).format(date);

/**
 * El único `Date.now()` del store: el "ahora" con el que se mide la vejez de
 * `updatedAt` en el criterio de los 30 días (aqui no hay inyección de reloj;
 * queda aislado aquí para que el día que lo haya, se cambia en un solo sitio).
 */
function ahora(): number {
  return Date.now();
}

/** Lunes 00:00 local de la semana de `value`. */
function inicioDeSemana(value: Date): Date {
  const date = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date;
}

/** Una fecha ISO; vacía o inválida → `null`: nunca se cuenta una fecha inventada. */
function parseFecha(value: string | undefined | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Reparte fechas de alta en cubos semanales (lunes→domingo, hora local), de la
 * más antigua a la actual. Es la misma ventana y las mismas etiquetas que el
 * gráfico de crecimiento del dashboard de home (`WEEK_LABEL_FORMAT`).
 */
function serieSemanal(
  fechas: readonly (string | undefined | null)[],
  semanas: number,
): WeeklyPoint[] {
  const inicios = Array.from({ length: semanas }, (_, indice) => {
    const inicio = inicioDeSemana(new Date());
    inicio.setDate(inicio.getDate() - (semanas - 1 - indice) * 7);
    return inicio;
  });
  const conteo = new Array<number>(semanas).fill(0);
  const inicioActual = inicioDeSemana(new Date()).getTime();

  for (const fecha of fechas) {
    const alta = parseFecha(fecha);
    if (!alta) continue;
    const semanasAtras = Math.round((inicioActual - inicioDeSemana(alta).getTime()) / SEMANA_MS);
    const indice = semanas - 1 - semanasAtras;
    if (indice >= 0 && indice < semanas) conteo[indice] = (conteo[indice] ?? 0) + 1;
  }

  return inicios.map((inicio, indice) => ({
    label: etiquetaSemana(inicio),
    value: conteo[indice] ?? 0,
  }));
}

/**
 * Variación real de la última semana contra la anterior. `null` cuando la
 * semana previa fue 0: no hay base real, así que no se inventa un porcentaje
 * (misma regla que los KPI del dashboard de home).
 */
function variacionSemanal(serie: readonly WeeklyPoint[]): number | null {
  const anterior = serie[serie.length - 2]?.value ?? 0;
  if (anterior === 0) return null;
  const actual = serie.at(-1)?.value ?? 0;
  return Math.round(((actual - anterior) / anterior) * 100);
}

/**
 * ¿Lleva el tenant `DIAS_SIN_CAMBIO` días o más sin modificarse? Solo cuentan
 * los activos: un suspendido ya requiere atención por sí solo.
 */
function sinCambios30Dias(tenant: Tenant, ahoraMs: number): boolean {
  if (tenant.status !== 'ACTIVE') return false;
  const actualizado = parseFecha(tenant.updatedAt);
  if (!actualizado) return false;
  return ahoraMs - actualizado.getTime() >= DIAS_SIN_CAMBIO * DIA_MS;
}

/** Cabecera del CSV de exportación: las columnas de la tabla. */
const CSV_CABECERA = 'nombre,slug,vertical,estado,alta,ultimo_cambio';

/** Nombre del archivo que descarga "Exportar". */
const CSV_NOMBRE = 'tenants.csv';

/**
 * El CSV de las filas visibles: cabecera más una fila por tenant, con los
 * valores entre comillas y las comillas interiores duplicadas. Sin filas
 * exporta solo la cabecera: no se cuelga ni descarga vacío.
 */
export function csvDe(tenants: readonly Tenant[]): string {
  const filas = tenants.map((tenant) =>
    [tenant.name, tenant.slug, tenant.vertical, tenant.status, tenant.createdAt, tenant.updatedAt]
      .map((campo) => `"${String(campo).replaceAll('"', '""')}"`)
      .join(','),
  );
  return [CSV_CABECERA, ...filas].join('\n');
}

/**
 * ViewModel del panel de control de la plataforma (SUPER_ADMIN).
 *
 * Dos fuentes, deliberadamente: el **resumen** (totales, altas por semana y
 * reparto por vertical) se calcula sobre todos los tenants de la plataforma,
 * y la **lista** de la tabla se pide paginada y con los filtros aplicados.
 * Cada fuente carga y falla por su lado — `cargandoResumen`/`cargandoLista`,
 * `fallandoResumen`/`fallandoLista` —: paginar la tabla no re-esqueletiza los
 * KPI, y un fallo de la lista conserva las cifras del resumen.
 */
@Injectable({ providedIn: 'root' })
export class DashboardStore {
  private readonly data = inject(DashboardApi);
  private readonly destroyRef = inject(DestroyRef);

  /** Búsqueda con pausa: la señal se actualiza al toque, la petición espera. */
  private readonly busquedaPendiente = new Subject<string>();
  /** Versiones de cada carga: la respuesta de una petición vieja no escribe. */
  private versionResumen = 0;
  private versionLista = 0;

  constructor() {
    this.busquedaPendiente
      .pipe(
        debounceTime(PAUSA_BUSQUEDA_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.cargarLista());
  }

  /* ── Estado de carga, por fuente ───────────────────────────
     Cada bloque de la pantalla lee SU par (carga + fallo): la tabla tiene
     esqueleto y error propios, y los KPI, el donut y el gráfico de altas
     comparten los del resumen. */

  private readonly resumenEnCurso = signal(true);
  private readonly listaEnCurso = signal(true);
  private readonly resumenCaido = signal(false);
  private readonly listaCaida = signal(false);

  /** Carga del resumen en curso: esqueletos de KPI, donut y gráfico de altas. */
  readonly cargandoResumen = computed(() => this.resumenEnCurso());

  /** Carga de la lista en curso: esqueleto de la tabla. */
  readonly cargandoLista = computed(() => this.listaEnCurso());

  /** El resumen falló en su última carga: sus bloques muestran su error. */
  readonly fallandoResumen = computed(() => this.resumenCaido());

  /** La lista falló en su última carga: la tabla muestra su error. */
  readonly fallandoLista = computed(() => this.listaCaida());

  /* ── Resumen (todos los tenants) ─────────────────────────── */

  /** Todos los tenants de la plataforma: la base de las métricas. */
  private readonly todos = signal<readonly Tenant[]>([]);

  readonly totalTenants = signal(0);
  readonly tenantsActivos = signal(0);
  readonly tenantsSuspendidos = signal(0);

  /** Periodo visible del gráfico, en semanas (8 | 12 | 16). */
  readonly semanas = signal(RANGOS_SEMANA[0] ?? 8);

  /** Altas por semana del periodo visible, de la más antigua a la actual. */
  readonly serieAltas = computed<readonly WeeklyPoint[]>(() =>
    serieSemanal(
      this.todos().map((tenant) => tenant.createdAt),
      this.semanas(),
    ),
  );

  /** Altas de la semana en curso (el último cubo de la serie). */
  readonly altasSemana = computed(() => this.serieAltas().at(-1)?.value ?? 0);

  /**
   * Variación real frente a la semana anterior; `null` cuando la semana
   * previa fue 0: no hay base, y un porcentaje inventado no se muestra.
   */
  readonly variacionSemana = computed<number | null>(() => variacionSemanal(this.serieAltas()));

  /** Reparto por vertical: siempre las cuatro, con conteo y porcentaje. */
  readonly repartoVertical = computed<readonly VerticalReparto[]>(() => {
    const tenants = this.todos();
    const total = tenants.length;
    return VERTICALES.map((vertical) => {
      const count = tenants.filter((tenant) => tenant.vertical === vertical).length;
      return {
        vertical,
        count,
        percent: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
      };
    });
  });

  /** Tenants activos que llevan 30+ días sin modificarse (`updatedAt`). */
  readonly sinCambios = computed(() => {
    const ahoraMs = ahora();
    return this.todos().filter((tenant) => sinCambios30Dias(tenant, ahoraMs)).length;
  });

  /** Los suspendidos: requieren atención por sí solos (pie de la tarjeta 4). */
  readonly suspendidosEnAtencion = computed(
    () => this.todos().filter((tenant) => tenant.status === 'SUSPENDED').length,
  );

  /** Los que requieren atención: suspendidos + activos sin cambios 30+ días. */
  readonly requierenAtencion = computed(() => this.suspendidosEnAtencion() + this.sinCambios());

  /* ── Lista paginada de la tabla ──────────────────────────── */

  /** La página visible de la tabla, ya filtrada por el backend. */
  readonly tenants = signal<readonly Tenant[]>([]);
  readonly pagina = signal(0);
  readonly totalPaginas = signal(0);
  readonly totalElementos = signal(0);
  readonly busqueda = signal('');
  readonly filtroEstado = signal<PlatformEstadoFiltro>('TODOS');

  /** ¿Hay algún filtro activo? (habilita el botón "Limpiar filtros"). */
  readonly hayFiltros = computed(
    () => this.busqueda().trim() !== '' || this.filtroEstado() !== 'TODOS',
  );

  /* ── Comandos ────────────────────────────────────────────── */

  /** Cambia el periodo del gráfico. Un valor fuera del catálogo se ignora. */
  setSemanas(valor: number): void {
    if (!RANGOS_SEMANA.includes(valor)) return;
    this.semanas.set(valor);
  }

  /** Aplica la búsqueda: vuelve a la primera página y espera la pausa. */
  setBusqueda(texto: string): void {
    if (texto === this.busqueda()) return;
    this.busqueda.set(texto);
    this.pagina.set(0);
    this.busquedaPendiente.next(texto);
  }

  /** Aplica el filtro de estado: vuelve a la primera página y recarga. */
  setFiltroEstado(estado: PlatformEstadoFiltro): void {
    if (estado === this.filtroEstado()) return;
    this.filtroEstado.set(estado);
    this.pagina.set(0);
    this.cargarLista();
  }

  /** Cambia de página (base 0), acotada al rango válido. */
  irAPagina(pagina: number): void {
    if (!Number.isFinite(pagina)) return;
    const maxima = Math.max(0, this.totalPaginas() - 1);
    const destino = Math.min(Math.max(0, Math.trunc(pagina)), maxima);
    if (destino === this.pagina()) return;
    this.pagina.set(destino);
    this.cargarLista();
  }

  /** Descarga el CSV de las filas que se están viendo. */
  exportarCsv(): void {
    const csv = csvDe(this.tenants());
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = CSV_NOMBRE;
    enlace.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Carga (o recarga) el panel: el resumen de todos los tenants más la página
   * de la tabla con los filtros actuales. Es el comando único del arranque de
   * la pantalla y de los botones "Reintentar".
   */
  recargar(): void {
    this.resumenCaido.set(false);
    this.listaCaida.set(false);
    this.cargarResumen();
    this.cargarLista();
  }

  /* ── Carga de cada fuente ────────────────────────────────── */

  private cargarResumen(): void {
    const version = ++this.versionResumen;
    this.resumenEnCurso.set(true);
    this.data
      .todos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resumen) => {
        if (version !== this.versionResumen) return;
        this.resumenEnCurso.set(false);
        if (resumen === null) {
          this.resumenCaido.set(true);
          return;
        }
        this.todos.set(resumen.tenants);
        this.totalTenants.set(resumen.total);
        this.tenantsActivos.set(resumen.tenants.filter((t) => t.status === 'ACTIVE').length);
        this.tenantsSuspendidos.set(resumen.tenants.filter((t) => t.status === 'SUSPENDED').length);
      });
  }

  private cargarLista(): void {
    const version = ++this.versionLista;
    this.listaEnCurso.set(true);

    const params: { page: number; size: number; search?: string; status?: TenantStatus } = {
      page: this.pagina(),
      size: FILAS_POR_PAGINA,
    };
    const texto = this.busqueda().trim();
    if (texto) params.search = texto;
    const filtro = this.filtroEstado();
    if (filtro !== 'TODOS') params.status = filtro;

    this.data
      .pagina(params)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((pagina) => {
        if (version !== this.versionLista) return;
        this.listaEnCurso.set(false);
        if (pagina === null) {
          this.listaCaida.set(true);
          return;
        }
        this.tenants.set(pagina.content);
        this.pagina.set(pagina.page);
        this.totalPaginas.set(pagina.totalPages);
        this.totalElementos.set(pagina.totalElements);
      });
  }
}
