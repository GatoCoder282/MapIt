import { DestroyRef, Injectable, computed, inject, signal, type Signal } from '@angular/core';
import { AuthSession } from '@mapit/auth';
import {
  RealtimeClient,
  type RealtimeConnectionState,
  type RealtimeEventEnvelope,
  type SpaceElementState,
} from '@mapit/realtime';
import type {
  ElementStateSummary,
  ElementStateSummaryByState,
  Establishment,
  Person,
  Reservation,
  TenantPage,
} from '@mapit/api-client';
import { forkJoin, of } from 'rxjs';
import type { Subscription } from 'rxjs';

import { HomeData } from '../data/home-data';

/** Los cinco estados del dominio: el conteo vivo tiene siempre estas claves. */
const CONTEO_VACIO: Record<SpaceElementState, number> = {
  AVAILABLE: 0,
  OCCUPIED: 0,
  RESERVED: 0,
  CLEANING: 0,
  OUT_OF_SERVICE: 0,
};

/** Ráfaga de eventos en vivo → un solo refresco del resumen tras este silencio. */
const REFRESCO_REALTIME_MS = 1_000;

/**
 * Cubos semanales disponibles. Es la ventana más larga que se puede pedir con
 * el selector de rango: la serie base se calcula una vez a 12 semanas y de
 * ahí se recorta la ventana visible.
 */
const WINDOW_WEEKS = 12;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Rangos de periodo (en semanas) que ofrece el selector del dashboard. */
export const RANGE_WEEKS = [4, 8, 12] as const;

/** Unión cerrada de los rangos: una errata en el selector no compila. */
export type RangeWeeks = (typeof RANGE_WEEKS)[number];

/** Un cubo semanal: valor y etiqueta de la semana. */
export interface WeeklyPoint {
  readonly label: string;
  readonly value: number;
}

/**
 * Comparación de un periodo contra su propio inicio.
 *
 * `percent` es `null` cuando la primera semana del periodo fue 0: no hay base
 * real, así que no se inventa un porcentaje (misma regla que los KPI). El
 * conteo absoluto (`absolute`) sí es real y sirve de respaldo.
 */
export interface PeriodComparison {
  /** Variación porcentual del último cubo frente al primero; `null` = sin base. */
  readonly percent: number | null;
  /** Variación absoluta (último cubo − primer cubo). */
  readonly absolute: number;
}

/** Los mocks de test traen `createdAt: ''`: una fecha inválida nunca cuenta. */
export function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Lunes 00:00 local de la semana de `value`. */
function startOfWeek(value: Date): Date {
  const date = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date;
}

function weekStart(weeksAgo: number): Date {
  const date = startOfWeek(new Date());
  date.setDate(date.getDate() - weeksAgo * 7);
  return date;
}

const WEEK_LABEL_FORMAT = new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short' });

const RELATIVE_FORMAT = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Reparte fechas de alta en cubos semanales (lunes→domingo, hora local), de la
 * más antigua a la actual. Las fechas inválidas o vacías no cuentan: no se
 * inventan altas.
 *
 * `weeks` es el número de cubos: la serie base se calcula a 12 semanas y el
 * selector de rango recorta la ventana visible.
 */
function weeklySeries(dates: readonly (string | undefined | null)[], weeks: number): WeeklyPoint[] {
  const starts = Array.from({ length: weeks }, (_, index) => weekStart(weeks - 1 - index));
  const counts = new Array<number>(weeks).fill(0);
  const currentStart = weekStart(0).getTime();

  for (const date of dates) {
    const created = parseDate(date);
    if (!created) continue;
    const weeksAgo = Math.round((currentStart - startOfWeek(created).getTime()) / WEEK_MS);
    const index = weeks - 1 - weeksAgo;
    if (index >= 0 && index < weeks) counts[index] = (counts[index] ?? 0) + 1;
  }

  return starts.map((start, index) => ({
    label: WEEK_LABEL_FORMAT.format(start),
    value: counts[index] ?? 0,
  }));
}

/**
 * Variación real frente a la semana anterior. `null` cuando la semana previa
 * fue 0: no hay base real, así que no se inventa un porcentaje.
 *
 * Compara los dos últimos cubos, así que no depende del rango elegido.
 */
function weekDelta(series: readonly WeeklyPoint[]): number | null {
  const previous = series[series.length - 2]?.value ?? 0;
  if (previous === 0) return null;
  return Math.round((((series.at(-1)?.value ?? 0) - previous) / previous) * 100);
}

/**
 * Comparación del periodo contra su propio inicio: el último cubo frente al
 * primero de la ventana visible.
 */
function periodComparison(series: readonly WeeklyPoint[]): PeriodComparison {
  const first = series[0]?.value ?? 0;
  const last = series.at(-1)?.value ?? 0;
  return {
    percent: first === 0 ? null : Math.round(((last - first) / first) * 100),
    absolute: last - first,
  };
}

/** Suma de los cubos de una serie: el total del periodo. */
function seriesTotal(series: readonly WeeklyPoint[]): number {
  return series.reduce((sum, point) => sum + point.value, 0);
}

/**
 * Normaliza el `byState` del backend: siempre las cinco claves y ningún
 * negativo, venga lo que venga por el cable.
 */
function normalizarConteo(
  byState: ElementStateSummaryByState | undefined,
): Record<SpaceElementState, number> {
  const valor = (estado: SpaceElementState): number => Math.max(0, byState?.[estado] ?? 0);
  return {
    AVAILABLE: valor('AVAILABLE'),
    OCCUPIED: valor('OCCUPIED'),
    RESERVED: valor('RESERVED'),
    CLEANING: valor('CLEANING'),
    OUT_OF_SERVICE: valor('OUT_OF_SERVICE'),
  };
}

/**
 * ViewModel del dashboard de inicio (CU-10): todo el estado y sus derivados
 * viven aquí como signals/computed, testeable sin renderizar. La capa `ui`
 * solo enlaza; `data` solo llama a la API.
 */
@Injectable({ providedIn: 'root' })
export class HomeStore {
  private readonly session = inject(AuthSession);
  private readonly data = inject(HomeData);
  private readonly realtime = inject(RealtimeClient);

  /** Suscripción STOMP viva por establecimiento, para darlas de baja al salir. */
  private readonly suscripcionesRealtime = new Map<string, Subscription>();
  private temporizadorRefresco: ReturnType<typeof setTimeout> | undefined;
  private destruido = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destruido = true;
      clearTimeout(this.temporizadorRefresco);
      for (const suscripcion of this.suscripcionesRealtime.values()) suscripcion.unsubscribe();
      this.suscripcionesRealtime.clear();
    });
  }

  /** El rol decide si se piden KPIs de plataforma (GET /tenants exige SUPER_ADMIN). */
  readonly isSuperAdmin = computed(() => this.session.user()?.role === 'SUPER_ADMIN');

  /**
   * ¿El usuario puede leer los datos del tenant (reservas y personas)?
   *
   * El backend restringe `GET /reservations` y `GET /people` a ADMIN, MANAGER y
   * STAFF: pedírselas a un SUPER_ADMIN solo produciría un 403 por petición
   * (y un error en la consola del navegador). Los slots afectados muestran
   * "Sin datos", que es lo mismo que ya se veía, pero sin ruido.
   */
  readonly tieneAccesoADatosDelTenant = computed(() => {
    const rol = this.session.user()?.role;
    return rol === 'ADMIN' || rol === 'MANAGER' || rol === 'STAFF';
  });

  /** null = error de carga; [] = sin datos. Cada fuente falla por separado. */
  readonly establishments = signal<Establishment[] | null>(null);
  readonly tenantPage = signal<TenantPage | null>(null);
  readonly reservations = signal<Reservation[] | null>(null);
  readonly people = signal<Person[] | null>(null);
  readonly loading = signal(true);

  readonly totalEstablishments = computed(() => this.establishments()?.length ?? 0);
  readonly totalReservations = computed(() => this.reservations()?.length ?? 0);
  readonly totalPeople = computed(() => this.people()?.length ?? 0);

  /* ── Ocupación en vivo ───────────────────────────────────── */

  /**
   * Foto del resumen (`GET /element-states/summary`): `null` mientras carga o
   * si la llamada falla — el panel muestra su estado vacío y el dashboard
   * sigue en pie.
   */
  readonly resumenEstados = signal<ElementStateSummary | null>(null);

  /**
   * El resumen está en vuelo **y no hay nada que mostrar todavía**: el panel
   * dibuja su esqueleto. Con datos ya cargados, un refresco en vuelo no
   * eclipsa los datos (el vivo se sigue viendo, y el refresco solo reconcilia).
   */
  readonly resumenCargando = signal(false);

  /**
   * El resumen falló **y no hay nada que mostrar**: el panel muestra el error
   * con su reintento. Un refresco que falle con datos ya en pantalla no borra
   * lo que se ve.
   */
  readonly resumenError = signal(false);

  /**
   * Conteo vivo por estado: parte en 0 y lo alimentan la foto y los eventos
   * STOMP. Siempre con las cinco claves y nunca en negativo.
   */
  readonly conteoPorEstado = signal<Record<SpaceElementState, number>>({ ...CONTEO_VACIO });

  /** Total de la foto; los eventos de estado no lo mueven, un refresco sí. */
  readonly totalElementos = computed(() => this.resumenEstados()?.total ?? 0);

  /** Elementos operables: el total menos los fuera de servicio. */
  readonly elementosOperativos = computed(() =>
    Math.max(0, this.totalElementos() - this.conteoPorEstado().OUT_OF_SERVICE),
  );

  /**
   * Ocupación real: solo `OCCUPIED` es "en uso ahora" (`RESERVED` es reserva
   * todavía no ocupada y no hay modelo de turnos). `null` = nada operable
   * que medir; nunca NaN ni Infinity.
   */
  readonly porcentajeOcupacion = computed<number | null>(() => {
    const operativos = this.elementosOperativos();
    if (operativos === 0) return null;
    return Math.min(100, Math.round((this.conteoPorEstado().OCCUPIED / operativos) * 1000) / 10);
  });

  /** Estado del socket, tal cual lo publica `RealtimeClient` (kill switch incluido). */
  readonly conexionRealtime: Signal<RealtimeConnectionState> = this.realtime.connectionState;

  /** Re-pide la foto del resumen (botón del panel, corrección de deriva). */
  refrescarResumenEstados(): void {
    this.cargarResumen();
  }

  private cargarResumen(): void {
    const sinDatos = this.resumenEstados() === null;
    if (sinDatos) {
      this.resumenCargando.set(true);
      this.resumenError.set(false);
    }
    this.data.summarizeElementStates().subscribe((resumen) => {
      if (this.destruido) return;
      if (sinDatos) this.resumenCargando.set(false);
      if (resumen === null) {
        if (sinDatos) this.resumenError.set(true);
        return;
      }
      this.resumenEstados.set(resumen);
      this.conteoPorEstado.set(normalizarConteo(resumen.byState));
    });
  }

  /**
   * Una suscripción STOMP por establecimiento del tenant: los topics van por
   * establecimiento (`/topic/establishments/{id}`), no hay uno de tenant.
   * La lista de negocios solo la escribe `reload`, así que llamar aquí desde
   * su callback cubre "lista conocida" y "lista cambió": baja lo que salió,
   * alta lo que entró, sin tumbar las suscripciones que siguen vivas.
   *
   * ponytail: una suscripción por establecimiento es el techo actual; si un
   * tenant llegara a cientos de locales, el backend debería publicar un topic
   * de tenant y este store suscribirse a uno solo.
   */
  private sincronizarRealtime(establishments: readonly Establishment[]): void {
    if (this.destruido) return;
    this.realtime.connect();
    const vivos = new Set(establishments.map((establishment) => establishment.id));
    for (const [id, suscripcion] of this.suscripcionesRealtime) {
      if (!vivos.has(id)) {
        suscripcion.unsubscribe();
        this.suscripcionesRealtime.delete(id);
      }
    }
    for (const id of vivos) {
      if (!this.suscripcionesRealtime.has(id)) {
        this.suscripcionesRealtime.set(
          id,
          this.realtime.subscribeEstablishment(id).subscribe((evento) => this.alEvento(evento)),
        );
      }
    }
  }

  /**
   * Evento de cambio de estado: con `previousState` el delta local es fiable
   * (baja el previo, sube el nuevo; el total no cambia). Sin él —p. ej. un
   * elemento creado tras la foto— el conteo local no sirve: refresco ya.
   */
  private alEvento(evento: RealtimeEventEnvelope): void {
    const { previousState, state } = evento.payload;
    if (previousState) {
      if (this.resumenEstados() !== null) {
        this.conteoPorEstado.update((conteo) => {
          const siguiente = { ...conteo };
          siguiente[previousState] = Math.max(0, (siguiente[previousState] ?? 0) - 1);
          siguiente[state] = (siguiente[state] ?? 0) + 1;
          return siguiente;
        });
      }
    } else {
      this.cargarResumen();
    }
    this.programarRefrescoPorDeriva();
  }

  /**
   * Corrección de deriva: cualquier ráfaga de eventos termina en UN refresco
   * del resumen (1 s de calma), por si el conteo local quedó desfasado.
   */
  private programarRefrescoPorDeriva(): void {
    if (this.destruido) return;
    clearTimeout(this.temporizadorRefresco);
    this.temporizadorRefresco = setTimeout(() => {
      this.temporizadorRefresco = undefined;
      this.cargarResumen();
    }, REFRESCO_REALTIME_MS);
  }

  /**
   * Rango del periodo visible, en semanas. Lo eligen los dos selectores de
   * rango de los paneles de crecimiento (uno por gráfico) y **las dos series
   * reaccionan**: un solo signal gobierna la ventana de toda la pantalla.
   */
  readonly rangeWeeks = signal<RangeWeeks>(8);

  /**
   * Fija el rango desde el valor de un `<select>` ("4" | "8" | "12").
   * Un valor que no está en la lista se ignora: el signal nunca sale de la
   * unión cerrada.
   */
  setRangeFromValue(value: string): void {
    const weeks = RANGE_WEEKS.find((option) => String(option) === value);
    if (weeks !== undefined) this.rangeWeeks.set(weeks);
  }

  /**
   * Serie base de 12 semanas: se calcula una vez y de aquí se recorta la
   * ventana que pide el selector de rango.
   */
  private readonly growthWindow = computed(() =>
    weeklySeries(
      (this.establishments() ?? []).map((establishment) => establishment.createdAt),
      WINDOW_WEEKS,
    ),
  );

  /**
   * Altas de negocios del periodo visible, de la más antigua a la actual.
   */
  readonly growthSeries = computed(() => this.growthWindow().slice(-this.rangeWeeks()));

  /** Los mismos cubos, como números: es lo que dibuja el sparkline. */
  readonly growthSeriesValues = computed(() => this.growthSeries().map((point) => point.value));

  /** Total de altas del periodo visible. */
  readonly growthPeriodTotal = computed(() => seriesTotal(this.growthSeries()));

  /** Comparación del periodo contra su primera semana. */
  readonly growthPeriodDelta = computed(() => periodComparison(this.growthSeries()));

  readonly newThisWeek = computed(() => this.growthSeries().at(-1)?.value ?? 0);

  /** Variación real frente a la semana anterior; null si no había base. */
  readonly weekGrowthPercent = computed(() => weekDelta(this.growthSeries()));

  readonly growthMax = computed(() =>
    Math.max(1, ...this.growthSeries().map((point) => point.value)),
  );

  readonly growthIsEmpty = computed(() => this.growthSeries().every((point) => point.value === 0));

  /**
   * Reservas del periodo visible, con la misma ventana (lunes→domingo) y las
   * mismas etiquetas que el gráfico de negocios.
   */
  readonly reservationsGrowthSeries = computed(() =>
    weeklySeries(
      (this.reservations() ?? []).map((reservation) => reservation.createdAt),
      WINDOW_WEEKS,
    ).slice(-this.rangeWeeks()),
  );

  /** Los mismos cubos, como números: es lo que dibuja el sparkline. */
  readonly reservationsGrowthSeriesValues = computed(() =>
    this.reservationsGrowthSeries().map((point) => point.value),
  );

  /** Total de reservas del periodo visible. */
  readonly reservationsPeriodTotal = computed(() => seriesTotal(this.reservationsGrowthSeries()));

  /** Comparación del periodo contra su primera semana. */
  readonly reservationsPeriodDelta = computed(() =>
    periodComparison(this.reservationsGrowthSeries()),
  );

  readonly reservationsIsEmpty = computed(() =>
    this.reservationsGrowthSeries().every((point) => point.value === 0),
  );

  readonly newReservationsThisWeek = computed(
    () => this.reservationsGrowthSeries().at(-1)?.value ?? 0,
  );

  readonly reservationsWeekGrowthPercent = computed(() =>
    weekDelta(this.reservationsGrowthSeries()),
  );

  /**
   * Altas de personas del periodo visible, para el delta y el sparkline de
   * "Personas registradas" del panel de reservas y pagos.
   */
  readonly peopleGrowthSeries = computed(() =>
    weeklySeries(
      (this.people() ?? []).map((person) => person.createdAt),
      WINDOW_WEEKS,
    ).slice(-this.rangeWeeks()),
  );

  /** Los mismos cubos, como números: es lo que dibuja el sparkline. */
  readonly peopleGrowthSeriesValues = computed(() =>
    this.peopleGrowthSeries().map((point) => point.value),
  );

  readonly newPeopleThisWeek = computed(() => this.peopleGrowthSeries().at(-1)?.value ?? 0);

  readonly peopleWeekGrowthPercent = computed(() => weekDelta(this.peopleGrowthSeries()));

  /**
   * Establecimientos ordenados por fecha de alta real (más recientes primero).
   * Los que no tienen `createdAt` válido quedan al final en vez de desaparecer.
   */
  readonly sortedEstablishments = computed(() => {
    return [...(this.establishments() ?? [])]
      .map((establishment) => ({
        establishment,
        time: parseDate(establishment.createdAt)?.getTime() ?? null,
      }))
      .sort((a, b) => (b.time ?? -1) - (a.time ?? -1))
      .map((entry) => entry.establishment);
  });

  /** Últimos seis para la actividad. */
  readonly recentEstablishments = computed(() => this.sortedEstablishments().slice(0, 6));

  /**
   * Actividad derivada de `createdAt`; sin eventos inventados.
   */
  readonly activityItems = computed(() => {
    return this.recentEstablishments()
      .map((establishment) => ({ establishment, date: parseDate(establishment.createdAt) }))
      .filter((item): item is { establishment: Establishment; date: Date } => item.date !== null)
      .slice(0, 5)
      .map((item) => ({
        id: item.establishment.id,
        name: item.establishment.name,
        relative: RELATIVE_FORMAT.format(
          Math.round((item.date.getTime() - Date.now()) / DAY_MS),
          'day',
        ),
      }));
  });

  reload(): void {
    this.loading.set(true);
    this.cargarResumen();
    forkJoin({
      establishments: this.data.listEstablishments(),
      tenants: this.isSuperAdmin() ? this.data.listTenants() : of(null),
      reservations: this.tieneAccesoADatosDelTenant() ? this.data.listReservations() : of(null),
      people: this.tieneAccesoADatosDelTenant() ? this.data.searchPeople() : of(null),
    }).subscribe(({ establishments, tenants, reservations, people }) => {
      this.establishments.set(establishments);
      this.tenantPage.set(tenants);
      this.reservations.set(reservations);
      this.people.set(people);
      this.loading.set(false);
      if (establishments !== null) this.sincronizarRealtime(establishments);
    });
  }
}
