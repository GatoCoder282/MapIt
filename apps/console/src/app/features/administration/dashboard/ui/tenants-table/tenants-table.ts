import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideBedDouble,
  LucideCalendarDays,
  LucideChevronLeft,
  LucideChevronRight,
  LucideDownload,
  LucideEllipsis,
  LucideMusic,
  LucidePlus,
  LucideSearch,
  LucideUtensils,
  LucideUsers,
} from '@lucide/angular';
import type { BusinessVertical, Tenant } from '@mapit/api-client';
import { currentLocaleTag } from '@mapit/i18n';

import { STRINGS } from '../../../../../core/strings';
import { mapitVerticalVar } from '../../../../../core/theme/echarts-theme';

/** Filtro de estado del panel: el mismo vocabulario que el contrato. */
export type PlatformEstadoFiltro = 'TODOS' | 'ACTIVE' | 'SUSPENDED';

/** Filas por página del panel (spec del panel de plataforma). */
const FILAS_POR_PAGINA = 5;

/** Días sin modificar a partir de los cuales el tenant "requiere atención". */
const DIAS_SIN_CAMBIO = 30;

const DIA_MS = 24 * 60 * 60 * 1000;

/** Fecha de alta según el idioma activo. */
const formatDate = (date: Date): string =>
  new Intl.DateTimeFormat(currentLocaleTag(), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);

const formatNumber = (value: number): string =>
  new Intl.NumberFormat(currentLocaleTag()).format(value);

/** Diferencia en días de calendario (no en horas: "ayer" es ayer). */
function diasDeCalendario(desde: Date, hasta: Date): number {
  const inicio = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate()).getTime();
  const fin = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate()).getTime();
  return Math.round((fin - inicio) / DIA_MS);
}

/**
 * `true` si el tenant lleva 30+ días sin modificarse.
 *
 * El contrato no trae "actividad del negocio": el criterio honesto es
 * `updatedAt` (cuándo se modificó el registro). Solo cuenta un tenant
 * activo: un tenant suspendido ya está en la lista de suspendidos.
 */
export function sinCambios(tenant: Tenant, ahora: number): boolean {
  if (tenant.status !== 'ACTIVE') return false;
  const actualizado = new Date(tenant.updatedAt).getTime();
  if (Number.isNaN(actualizado)) return false;
  return ahora - actualizado >= DIAS_SIN_CAMBIO * DIA_MS;
}

/**
 * Tiempo relativo del último cambio: "Hace 12 min", "Ayer", "Hace 3 días".
 * Sin fecha válida: "Sin datos" (nunca un 0 inventado).
 */
export function tiempoRelativo(iso: string | undefined | null, ahora: number): string {
  const textos = STRINGS.platformPanel;
  const fecha = iso ? new Date(iso) : null;
  if (!fecha || Number.isNaN(fecha.getTime())) return textos.noData;

  const dias = diasDeCalendario(fecha, new Date(ahora));
  if (dias <= 0) {
    const minutos = Math.floor((ahora - fecha.getTime()) / 60000);
    if (minutos < 1) return textos.relativeNow;
    if (minutos < 60) return textos.relativeMinutes.replace('{n}', String(minutos));
    return textos.relativeHours.replace('{n}', String(Math.floor(minutos / 60)));
  }
  if (dias === 1) return textos.relativeYesterday;
  return textos.relativeDays.replace('{n}', String(dias));
}

/** Fecha de alta en español; sin fecha válida: "Sin datos". */
export function fechaAlta(iso: string | undefined | null): string {
  const fecha = iso ? new Date(iso) : null;
  if (!fecha || Number.isNaN(fecha.getTime())) return STRINGS.platformPanel.noData;
  return formatDate(fecha);
}

/**
 * Panel de tenants del panel de plataforma.
 *
 * Componente presentacional: recibe los datos ya filtrados y paginados y los
 * dibuja; los comandos (buscar, filtrar, paginar, exportar) salen como
 * `output` y el shell los conecta con el store.
 *
 * Tabla HTML semántica: `<caption>` para lectores de pantalla, `<th scope>` en
 * las cabeceras y en la primera celda de cada fila. Nada de PrimeNG.
 */
@Component({
  selector: 'mapit-platform-tenants',
  imports: [
    RouterLink,
    LucideBedDouble,
    LucideCalendarDays,
    LucideChevronLeft,
    LucideChevronRight,
    LucideDownload,
    LucideEllipsis,
    LucideMusic,
    LucidePlus,
    LucideSearch,
    LucideUtensils,
    LucideUsers,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tenants-table.html',
  styleUrl: './tenants-table.scss',
})
export class PlatformTenantsTable {
  /** Filas de la página actual. */
  readonly tenants = input<readonly Tenant[]>([]);
  /** Página actual (base 0, como el resto de la consola). */
  readonly pagina = input(0);
  /** Número total de páginas. */
  readonly totalPaginas = input(0);
  /** Total de tenants que casa con los filtros. */
  readonly totalElementos = input(0);
  /** Texto de la búsqueda aplicada. */
  readonly busqueda = input('');
  /** Filtro de estado aplicado. */
  readonly filtroEstado = input<PlatformEstadoFiltro>('TODOS');
  /** ¿Hay algún filtro activo? (habilita el botón "Limpiar filtros"). */
  readonly hayFiltros = input(false);
  /** Esqueleto de carga. */
  readonly loading = input(false);
  /** La fuente falló: el error va en este bloque, no tumba el panel. */
  readonly failed = input(false);

  /** El usuario escribe una búsqueda. */
  readonly busquedaCambiada = output<string>();
  /** El usuario cambia el filtro de estado. */
  readonly filtroCambiado = output<PlatformEstadoFiltro>();
  /** El usuario pide otra página. */
  readonly cambioPagina = output<number>();
  /** El usuario pide el CSV. */
  readonly exportar = output<void>();
  /** El usuario reintenta la carga. */
  readonly reintentar = output<void>();
  /** El usuario limpia los filtros. */
  readonly limpiarFiltros = output<void>();

  protected readonly strings = STRINGS.platformPanel;

  /** Filas del esqueleto de carga: una por fila de la página. */
  protected readonly filasEsqueleto = Array.from(
    { length: FILAS_POR_PAGINA },
    (_, indice) => indice,
  );

  /** Filtro de estado: las tres opciones del contrato. */
  protected readonly estadoFiltros = computed<
    readonly { value: PlatformEstadoFiltro; label: string }[]
  >(() => [
    { value: 'TODOS', label: this.strings.filterAll },
    { value: 'ACTIVE', label: this.strings.filterActive },
    { value: 'SUSPENDED', label: this.strings.filterSuspended },
  ]);

  /** Índice de la primera fila que se ve (base 1). */
  protected readonly desde = computed(() => this.pagina() * FILAS_POR_PAGINA + 1);

  /** Índice de la última fila que se ve (base 1). */
  protected readonly hasta = computed(() => this.desde() + this.tenants().length - 1);

  /** "Mostrando 1–5 de 35 tenants". */
  protected readonly rango = computed(() =>
    this.strings.showing
      .replace('{from}', String(this.desde()))
      .replace('{to}', String(Math.max(this.desde(), this.hasta())))
      .replace('{total}', formatNumber(this.totalElementos())),
  );

  /**
   * Ventana de páginas: como mucho cinco botones, centrados en la actual.
   * Con miles de tenants el listado de páginas no cabría en la barra.
   */
  protected readonly paginas = computed(() => {
    const total = this.totalPaginas();
    if (total <= 0) return [];
    const inicio = Math.max(0, Math.min(this.pagina() - 2, total - 5));
    const fin = Math.min(total, inicio + 5);
    return Array.from({ length: fin - inicio }, (_, indice) => inicio + indice);
  });

  /** ¿Hay una página anterior? */
  protected readonly hayAnterior = computed(() => this.pagina() > 0);

  /** ¿Hay una página siguiente? */
  protected readonly haySiguiente = computed(() => this.pagina() + 1 < this.totalPaginas());

  /** Nombre de la vertical (texto de la plataforma, no del contrato). */
  protected verticalLabel(vertical: BusinessVertical): string {
    return STRINGS.verticals[vertical] ?? vertical;
  }

  /** El punto de la vertical se pinta con su token CSS. */
  protected readonly mapitVerticalVar = mapitVerticalVar;

  /** Fecha de alta en español. */
  protected alta(tenant: Tenant): string {
    return fechaAlta(tenant.createdAt);
  }

  /** "Últ. cambio": tiempo relativo derivado de `updatedAt`. */
  protected ultimoCambio(tenant: Tenant): string {
    return tiempoRelativo(tenant.updatedAt, Date.now());
  }

  /** ¿Este tenant lleva 30+ días sin modificarse? */
  protected requiereCambio(tenant: Tenant): boolean {
    return sinCambios(tenant, Date.now());
  }

  /** Nombre accesible de la acción de la fila: nombra al tenant. */
  protected detalleAria(tenant: Tenant): string {
    return this.strings.detailFor.replace('{name}', tenant.name);
  }
}
