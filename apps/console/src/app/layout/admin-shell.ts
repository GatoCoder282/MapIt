import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AuthSession } from '@mapit/auth';
import { LanguageSelector } from '@mapit/i18n';
import { Sidebar } from './sidebar/sidebar';
import { LucideBell, LucideLogOut } from '@lucide/angular';

import { STRINGS } from '../core/strings';

interface NavItem {
  label: string;
  route: string;
  icon: string;
}

/** Enfocables dentro del drawer móvil (para el foco inicial y la trampa de Tab). */
const ENFOCABLES_DRAWER = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Chrome de la consola de administración de plataforma (SUPER_ADMIN).
 *
 * Sidebar fija de 280px (token `--mapit-sidebar-width`), navegación por rol y
 * área de contenido. Es el contenedor reusable de las futuras secciones.
 */
@Component({
  selector: 'mapit-admin-shell',
  imports: [RouterOutlet, LucideLogOut, LucideBell, Sidebar, LanguageSelector],
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminShell {
  protected readonly strings = STRINGS;
  protected readonly session = inject(AuthSession);
  protected readonly menuOpen = signal(false);

  protected readonly navItems = computed<readonly NavItem[]>(() => [
    { label: STRINGS.shell.nav.dashboard, route: '/admin/dashboard', icon: 'dashboard' },
    { label: STRINGS.shell.nav.tenants, route: '/admin/tenants', icon: 'tenants' },
    { label: STRINGS.shell.nav.settings, route: '/admin/settings', icon: 'settings' },
    { label: STRINGS.shell.nav.profile, route: '/admin/profile', icon: 'profile' },
  ]);

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
    const abriendo = !this.menuOpen();
    this.menuOpen.set(abriendo);
    if (abriendo) this.enfocarDrawer();
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  /**
   * El drawer móvil vive dentro de `mapit-sidebar` (el rail es un componente
   * cerrado): el shell lo alcanza por el DOM para darle el foco y atrapar el
   * Tab mientras está abierto. El `[attr.inert]` del drawer ya apaga lo de
   * fuera, así que la trampa solo necesita ciclar los enfocables de dentro.
   */
  private drawer(): HTMLElement | null {
    return document.querySelector<HTMLElement>('mapit-sidebar .drawer');
  }

  /**
   * Al abrir, el foco entra al drawer (su primer enfocable, el botón de
   * cerrar). Va diferido: el `inert` se quita con la detección de cambios y
   * un elemento inerte no recibe foco.
   */
  private enfocarDrawer(): void {
    setTimeout(() => {
      const primero = this.drawer()?.querySelector<HTMLElement>(ENFOCABLES_DRAWER);
      primero?.focus();
    });
  }

  /** Escape cierra el drawer móvil (solo si está abierto). */
  @HostListener('document:keydown.escape')
  protected cerrarConEscape(): void {
    if (this.menuOpen()) this.closeMenu();
  }

  /**
   * Mientras el drawer está abierto, el Tab queda atrapado dentro: del último
   * enfocable se vuelve al primero, y del primero (con Shift) al último.
   * Es la trampa que exige la spec del drawer móvil.
   */
  @HostListener('document:keydown.tab', ['$event'])
  protected atraparTab(event: Event): void {
    if (!(event instanceof KeyboardEvent)) return;
    if (!this.menuOpen()) return;
    const drawer = this.drawer();
    if (!drawer) return;
    const enfocables = Array.from(drawer.querySelectorAll<HTMLElement>(ENFOCABLES_DRAWER));
    if (enfocables.length === 0) return;
    const primero = enfocables[0]!;
    const ultimo = enfocables[enfocables.length - 1]!;
    const activo = document.activeElement;
    const dentro = drawer.contains(activo);
    if (!event.shiftKey && (!dentro || activo === ultimo)) {
      event.preventDefault();
      primero.focus();
    } else if (event.shiftKey && (!dentro || activo === primero)) {
      event.preventDefault();
      ultimo.focus();
    }
  }

  protected logout(): void {
    this.session.logout();
  }
}
