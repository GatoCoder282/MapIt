import { NgOptimizedImage, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  LucideBuilding2,
  LucideCalendarPlus,
  LucideChartColumn,
  LucideChevronDown,
  LucideComponent,
  LucideHouse,
  LucideHistory,
  LucideLayers,
  LucideLayoutDashboard,
  LucideMap,
  LucideSettings,
  LucideStore,
  LucideUser,
  LucideUsers,
} from '@lucide/angular';

import { STRINGS } from '../../core/strings';

export interface SidebarNavItem {
  label: string;
  route?: string;
  icon: string;
  exact?: boolean;
  dividerBefore?: boolean;
  children?: readonly SidebarNavItem[];
}

/**
 * Rail del sidebar: logo arriba, navegación por rol al medio y el ornamento
 * de referencia al pie (igual en todos los shells).
 */
@Component({
  selector: 'mapit-sidebar',
  imports: [
    NgOptimizedImage,
    NgTemplateOutlet,
    RouterLink,
    RouterLinkActive,
    LucideLayoutDashboard,
    LucideBuilding2,
    LucideSettings,
    LucideUser,
    LucideHouse,
    LucideHistory,
    LucideLayers,
    LucideComponent,
    LucideCalendarPlus,
    LucideMap,
    LucideStore,
    LucideUsers,
    LucideChartColumn,
    LucideChevronDown,
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sidebar {
  protected readonly strings = STRINGS;
  readonly nav = input.required<readonly SidebarNavItem[]>();
  readonly navLabel = input.required<string>();
  /**
   * Nombre accesible del landmark `<nav>` del rail.
   *
   * Antes el `aria-label` estaba en el `<aside>` y el `<nav>` se quedaba sin
   * nombre: un landmark sin nombre no se puede alcanzar por rol.
   */
  readonly navAriaLabel = input.required<string>();
  readonly drawerOpen = input<boolean>(false);
  readonly drawerClose = output<void>();
  readonly closeLabel = input.required<string>();

  protected readonly openGroups = signal<ReadonlySet<string>>(new Set());

  protected isGroupOpen(label: string): boolean {
    return this.openGroups().has(label);
  }

  protected toggleGroup(label: string): void {
    this.openGroups.update((open) => {
      const next = new Set(open);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }

  protected onLinkClick(): void {
    if (this.drawerOpen()) {
      this.drawerClose.emit();
    }
  }
}
