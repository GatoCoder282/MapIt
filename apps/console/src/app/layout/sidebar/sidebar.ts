import { NgOptimizedImage, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
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
  expandedByDefault?: boolean;
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

  private readonly router = inject(Router);
  private readonly routeUrl = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  protected readonly openGroups = signal<ReadonlyMap<string, boolean>>(new Map());

  protected isGroupOpen(item: SidebarNavItem): boolean {
    return (
      this.openGroups().get(item.label) ??
      (item.expandedByDefault === true || this.containsActiveRoute(item))
    );
  }

  protected toggleGroup(item: SidebarNavItem): void {
    const expanded = this.isGroupOpen(item);
    this.openGroups.update((open) => {
      const next = new Map(open);
      next.set(item.label, !expanded);
      return next;
    });
  }

  private containsActiveRoute(item: SidebarNavItem): boolean {
    const url = this.routeUrl().split(/[?#]/)[0] ?? '';
    return (
      (!!item.route && (url === item.route || (!item.exact && url.startsWith(item.route + '/')))) ||
      !!item.children?.some((child) => this.containsActiveRoute(child))
    );
  }

  protected onLinkClick(): void {
    if (this.drawerOpen()) {
      this.drawerClose.emit();
    }
  }
}
