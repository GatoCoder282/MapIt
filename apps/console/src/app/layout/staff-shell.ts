import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthSession } from '@mapit/auth';
import { LucideHouse, LucideLayers, LucideLogOut } from '@lucide/angular';

import { STRINGS } from '../core/strings';

interface StaffNavItem {
  label: string;
  route: string;
  icon: 'home' | 'spaces';
  exact?: boolean;
}
/**
 * Chrome de la consola de staff del tenant: sidebar con las secciones
 * operativas (Inicio, Mi negocio) y topbar con el usuario.
 * Es el contenedor de las rutas privadas de staff; la plataforma usa
 * {@link AdminShell}.
 */
@Component({
  selector: 'mapit-staff-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LucideHouse, LucideLayers, LucideLogOut],
  templateUrl: './staff-shell.html',
  styleUrl: './staff-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffShell {
  protected readonly strings = STRINGS;
  protected readonly session = inject(AuthSession);
  protected readonly menuOpen = signal(false);

  protected readonly navItems: readonly StaffNavItem[] = [
    { label: STRINGS.staffShell.nav.home, route: '/home', icon: 'home', exact: true },
    {
      label: STRINGS.staffShell.nav.business,
      route: '/spaces/setup',
      icon: 'spaces',
    },
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
