import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AuthSession } from '@mapit/auth';
import { LanguageSelector } from '@mapit/i18n';
import { Sidebar, type SidebarNavItem } from './sidebar/sidebar';

import { STRINGS } from '../core/strings';

/**
 * Chrome de la consola de staff del tenant: sidebar full-height con las
 * secciones operativas y topbar con el usuario.
 * Es el contenedor de las rutas privadas de staff; la plataforma usa
 * {@link AdminShell}.
 */
@Component({
  selector: 'mapit-staff-shell',
  imports: [RouterOutlet, Sidebar, LanguageSelector],
  templateUrl: './staff-shell.html',
  styleUrl: './staff-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffShell {
  protected readonly strings = STRINGS;
  protected readonly session = inject(AuthSession);
  protected readonly menuOpen = signal(false);

  protected readonly navItems = computed<readonly SidebarNavItem[]>(() => [
    { label: STRINGS.staffShell.nav.home, route: '/home', icon: 'home', exact: true },
    { label: STRINGS.staffShell.nav.map, route: '/spaces/setup', icon: 'map' },
    { label: STRINGS.staffShell.nav.businesses, route: '/establishments', icon: 'businesses' },
    { label: STRINGS.staffShell.nav.users, route: '/users', icon: 'users' },
    { label: STRINGS.staffShell.nav.reports, route: '/reports', icon: 'reports' },
    {
      label: STRINGS.staffShell.nav.settings,
      icon: 'settings',
      dividerBefore: true,
      children: [
        {
          label: STRINGS.staffShell.nav.templates,
          route: '/spaces/templates',
          icon: 'templates',
        },
        {
          label: STRINGS.staffShell.nav.reservations,
          route: '/reservations/new',
          icon: 'reservations',
        },
      ],
    },
  ]);

  protected readonly visibleNavItems = computed(() =>
    this.session.user()?.role === 'ADMIN'
      ? [
          ...this.navItems(),
          { label: STRINGS.staffShell.nav.audit, route: '/audit', icon: 'audit' },
        ]
      : this.navItems(),
  );

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
}
