import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideBuilding2,
  LucideChevronRight,
  LucidePieChart,
  LucideTriangleAlert,
  LucideUserPlus,
} from '@lucide/angular';

import { STRINGS } from '../../../../../core/strings';

/**
 * Iconos de las cuatro tarjetas del panel de plataforma: unión cerrada, una
 * errata no compila. Solo `@lucide/angular` — nunca una segunda familia.
 */
export type PlatformKpiIcon = 'tenants' | 'new' | 'vertical' | 'attention';

/**
 * Tarjeta de métrica del panel de plataforma.
 *
 * Componente presentacional: recibe el dato ya formateado y lo dibuja. El
 * pie de la tarjeta lo proyecta quien la usa (cada tarjeta tiene un pie
 * distinto: dos contadores, un porcentaje o la lista de verticales).
 *
 * Sin movimiento de entrada: es un dashboard de consulta recurrente y la
 * carga no se anima (solo el shimmer del esqueleto, que se respeta con
 * `prefers-reduced-motion`).
 */
@Component({
  selector: 'mapit-platform-kpi',
  imports: [
    RouterLink,
    LucideBuilding2,
    LucideChevronRight,
    LucidePieChart,
    LucideTriangleAlert,
    LucideUserPlus,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './kpi-card.html',
  styleUrl: './kpi-card.scss',
})
export class PlatformKpiCard {
  /** Título de la métrica. */
  readonly label = input.required<string>();
  /** Valor ya formateado en español (`Intl.NumberFormat('es')`). */
  readonly value = input.required<string>();
  /** Icono de la métrica. */
  readonly icon = input.required<PlatformKpiIcon>();
  /** Destino real del chevron: nunca adorno, siempre un enlace. */
  readonly link = input.required<string>();
  /** Nombre accesible del chevron (el icono solo no dice a dónde lleva). */
  readonly linkAria = input.required<string>();
  /** Esqueleto de carga: sustituye el contenido y anuncia el estado. */
  readonly loading = input(false);

  protected readonly strings = STRINGS.platformPanel;
}
