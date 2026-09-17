import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthSession } from '@mapit/auth';
import {
  LucideBuilding2,
  LucideLayoutDashboard,
  LucideLogOut,
  LucideSettings,
  LucideUser,
} from '@lucide/angular';

import { STRINGS } from '../core/strings';

interface NavItem {
  label: string;
  route: string;
  icon: unknown;
}

/**
 * Chrome de la consola de administración de plataforma (SUPER_ADMIN).
 *
 * Sidebar fija de 280px (token `--mapit-sidebar-width`), navegación por rol y
 * área de contenido. Es el contenedor reusable de las futuras secciones.
 */
@Component({
  selector: 'mapit-admin-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    LucideLayoutDashboard,
    LucideBuilding2,
    LucideSettings,
    LucideUser,
    LucideLogOut,
  ],
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminShell {
  protected readonly strings = STRINGS;
  protected readonly session = inject(AuthSession);
  protected readonly menuOpen = signal(false);

  protected readonly navItems: readonly NavItem[] = [
    { label: STRINGS.shell.nav.dashboard, route: '/admin/dashboard', icon: 'dashboard' },
    { label: STRINGS.shell.nav.tenants, route: '/admin/tenants', icon: 'tenants' },
    { label: STRINGS.shell.nav.settings, route: '/admin/settings', icon: 'settings' },
    { label: STRINGS.shell.nav.profile, route: '/admin/profile', icon: 'profile' },
  ];

  protected readonly roleLabel = computed(() => {
    const role = this.session.user()?.role;
    return role ? STRINGS.shell.roleLabels[role] : '';
  });

  protected readonly initials = computed(() => {
    const name = this.session.user()?.fullName?.trim() ?? '';
    if (!name) return '?';
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  });

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected logout(): void {
    this.session.logout();
  }
}
