import { ChangeDetectionStrategy, Component, computed, inject, type OnInit } from '@angular/core';
import {
  LucideChartColumn,
  LucidePieChart,
  LucideTrendingDown,
  LucideTrendingUp,
} from '@lucide/angular';

import { GrowthChart } from '../../../../core/charts/growth-chart/growth-chart';
import { STRINGS } from '../../../../core/strings';
import { mapitVerticalVar } from '../../../../core/theme/echarts-theme';
import { DashboardStore } from '../model/dashboard-store';
import { PlatformKpiCard } from './kpi-card/kpi-card';
import { PlatformTenantsTable } from './tenants-table/tenants-table';
import { VerticalDonut } from './vertical-donut/vertical-donut';

/** Cifras en español: separador de miles con punto y decimal con coma. */
const NUMERO_FORMAT = new Intl.NumberFormat('es');

/** Porcentajes con signo explícito ("+20 %", "−20 %") y coma decimal. */
const PORCENTAJE_FORMAT = new Intl.NumberFormat('es', {
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
});

/**
 * Panel de control de la plataforma (SUPER_ADMIN).
 *
 * El shell es el dueño de la pantalla: reparte los datos del store entre los
 * componentes presentacionales (tarjetas de KPI, gráficos y tabla) y conecta
 * los comandos con el store. Los componentes no conocen el store.
 *
 * Sin animación de entrada: es un dashboard de consulta recurrente.
 */
@Component({
  selector: 'mapit-admin-dashboard',
  imports: [
    GrowthChart,
    PlatformKpiCard,
    PlatformTenantsTable,
    VerticalDonut,
    LucideChartColumn,
    LucidePieChart,
    LucideTrendingDown,
    LucideTrendingUp,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class AdminDashboard implements OnInit {
  protected readonly strings = STRINGS.platformPanel;
  protected readonly store = inject(DashboardStore);

  /** Traducciones de las verticales: el texto vive en `STRINGS`. */
  protected readonly verticales = STRINGS.verticals;

  /** El punto de la vertical se pinta con su token CSS. */
  protected readonly mapitVerticalVar = mapitVerticalVar;

  /** Destino real de los chevron de las tarjetas: el listado de tenants. */
  protected readonly rutaTenants = '/admin/tenants';

  /* ── Cifras de las tarjetas ──────────────────────────────── */

  /**
   * Cifra de una tarjeta.
   *
   * Un 0 solo si se midió: si la fuente falló se muestra "—", no un cero
   * que aparente un dato medido.
   */
  private readonly cifra = (valor: number): string =>
    this.store.fallandoResumen() ? this.strings.noValue : NUMERO_FORMAT.format(valor);

  /** Pie de una tarjeta: "Sin datos" si la fuente falló. */
  private readonly pie = (texto: string): string =>
    this.store.fallandoResumen() ? this.strings.noData : texto;

  protected readonly totalTenants = computed(() => this.cifra(this.store.totalTenants()));
  protected readonly activos = computed(() => this.cifra(this.store.tenantsActivos()));
  protected readonly suspendidos = computed(() => this.cifra(this.store.tenantsSuspendidos()));
  protected readonly altasSemana = computed(() => this.cifra(this.store.altasSemana()));
  protected readonly requierenAtencion = computed(() => this.cifra(this.store.requierenAtencion()));
  protected readonly suspendidosEnAtencion = computed(() =>
    this.cifra(this.store.suspendidosEnAtencion()),
  );
  protected readonly sinCambios = computed(() => this.cifra(this.store.sinCambios()));

  /** Pie de la tarjeta 1: "{n} activos". */
  protected readonly pieActivos = computed(() =>
    this.pie(this.strings.kpiTotalActive.replace('{n}', this.activos())),
  );

  /** Pie de la tarjeta 1: "{n} suspendidos". */
  protected readonly pieSuspendidos = computed(() =>
    this.pie(this.strings.kpiTotalSuspended.replace('{n}', this.suspendidos())),
  );

  /** Pie de la tarjeta 4: "{n} suspendidos". */
  protected readonly pieAtencionSuspendidos = computed(() =>
    this.pie(this.strings.kpiAttentionSuspended.replace('{n}', this.suspendidosEnAtencion())),
  );

  /** Pie de la tarjeta 4: "{n} sin cambios en 30+ días". */
  protected readonly pieAtencionSinCambios = computed(() =>
    this.pie(this.strings.kpiAttentionNoChanges.replace('{n}', this.sinCambios())),
  );

  /** Variación real frente a la semana anterior; `null` = no hay base. */
  protected readonly variacion = computed(() => this.store.variacionSemana());

  /**
   * Texto del pie de la tarjeta 2.
   *
   * Con base real, un porcentaje; sin ella (la semana previa fue 0), un conteo
   * absoluto: nunca un porcentaje inventado.
   */
  protected readonly variacionTexto = computed(() => {
    const valor = this.variacion();
    if (valor === null) {
      return this.pie(this.strings.kpiNewNoBase.replace('{n}', this.altasSemana()));
    }
    return this.pie(this.strings.kpiNewVsLastWeek.replace('{n}', PORCENTAJE_FORMAT.format(valor)));
  });

  /** ¿La variación es positiva? (el 0 no es una variación) */
  protected readonly variacionPositiva = computed(() => (this.variacion() ?? 0) > 0);

  /** ¿La variación es negativa? */
  protected readonly variacionNegativa = computed(() => (this.variacion() ?? 0) < 0);

  /* ── Gráfico de altas ────────────────────────────────────── */

  /** Total de altas del periodo visible: la suma de la serie. */
  protected readonly totalAltas = computed(() =>
    this.cifra(this.store.serieAltas().reduce((suma, punto) => suma + punto.value, 0)),
  );

  /** El gráfico no pinta una línea plana: si no hay altas, lo dice. */
  protected readonly serieVacia = computed(() =>
    this.store.serieAltas().every((punto) => punto.value === 0),
  );

  /** Nombre accesible del gráfico: nombra el periodo que se está mirando. */
  protected readonly growthAria = computed(() =>
    this.strings.growthAria.replace('{weeks}', String(this.store.semanas())),
  );

  /* ── Comandos ────────────────────────────────────────────── */

  /** Cambia el periodo del gráfico (semanas). */
  protected setSemanas(valor: number): void {
    this.store.setSemanas(valor);
  }

  /** El selector es un `<select>` nativo: su valor llega como texto. */
  protected setSemanasDesde(valor: string): void {
    this.store.setSemanas(Number(valor));
  }

  /** Vacía los filtros: deja el listado como estaba al entrar. */
  protected limpiarFiltros(): void {
    this.store.setBusqueda('');
    this.store.setFiltroEstado('TODOS');
    this.store.irAPagina(0);
  }

  ngOnInit(): void {
    // La carga la dispara el comando público del store (el mismo del botón
    // "Reintentar"); aquí solo se le pide.
    this.store.recargar();
  }
}
