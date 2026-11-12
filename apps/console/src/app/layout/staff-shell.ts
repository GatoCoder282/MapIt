import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, map } from 'rxjs';

import { AuthSession } from '@mapit/auth';
import { LanguageSelector } from '@mapit/i18n';
import { Sidebar, type SidebarNavItem } from './sidebar/sidebar';
import { EstablishmentSelector } from './establishment-selector';

import { STRINGS } from '../core/strings';
import { EstablishmentContext } from '../core/establishment-context';

/**
 * Chrome de la consola de staff del tenant: sidebar full-height con las
 * secciones operativas y topbar con el usuario.
 * Es el contenedor de las rutas privadas de staff; la plataforma usa
 * {@link AdminShell}.
 */
@Component({
  selector: 'mapit-staff-shell',
  imports: [RouterOutlet, Sidebar, EstablishmentSelector, LanguageSelector],
  templateUrl: './staff-shell.html',
  styleUrl: './staff-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffShell {
  protected readonly strings = STRINGS;
  protected readonly session = inject(AuthSession);
  protected readonly establishmentContext = inject(EstablishmentContext);
  protected readonly menuOpen = signal(false);
  protected readonly initialEstablishmentsLoaded = signal(false);
  protected readonly selectorRequested = signal(false);
  private readonly previousEstablishmentId = signal<string | null>(null);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private observedIdentity: string | null = null;
  private hasObservedIdentity = false;

  protected readonly canDismissSelector = computed(() => {
    if (!this.selectorRequested() || this.establishmentContext.status() !== 'ready') return false;
    const previousId = this.previousEstablishmentId() ?? this.establishmentContext.active()?.id;
    return (
      !!previousId && this.establishmentContext.establishments().some(({ id }) => id === previousId)
    );
  });

  constructor() {
    effect(() => {
      const user = this.session.user();
      const identity = user ? JSON.stringify([user.tenantId, user.id]) : null;
      const status = this.establishmentContext.status();

      if (!this.hasObservedIdentity) {
        this.hasObservedIdentity = true;
        this.observedIdentity = identity;
        if (identity && (status === 'ready' || status === 'error')) {
          this.initialEstablishmentsLoaded.set(true);
        }
        return;
      }

      if (identity !== this.observedIdentity) {
        this.observedIdentity = identity;
        this.previousEstablishmentId.set(null);
        this.initialEstablishmentsLoaded.set(false);
        return;
      }

      if (identity && (status === 'ready' || status === 'error')) {
        this.initialEstablishmentsLoaded.set(true);
      }
    });

    this.route.queryParamMap
      .pipe(
        map((params) => params.get('selectEstablishment') === '1'),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((requested) => {
        this.selectorRequested.set(requested);
        if (requested) {
          this.previousEstablishmentId.set(
            untracked(() => this.establishmentContext.active()?.id ?? null),
          );
          untracked(() => void this.establishmentContext.load());
        } else {
          this.previousEstablishmentId.set(null);
        }
      });
  }

  protected readonly navItems = computed<readonly SidebarNavItem[]>(() => [
    { label: STRINGS.staffShell.nav.home, route: '/home', icon: 'home', exact: true },
    { label: STRINGS.staffShell.nav.map, route: '/spaces/setup', icon: 'map' },
    { label: STRINGS.staffShell.nav.businesses, route: '/establishments', icon: 'businesses' },
    ...(this.session.user()?.role === 'ADMIN'
      ? [{ label: STRINGS.staffShell.nav.users, route: '/users', icon: 'users' }]
      : []),
    { label: STRINGS.staffShell.nav.reports, route: '/reports', icon: 'reports' },
    ...(['ADMIN', 'STAFF'].includes(this.session.user()?.role ?? '')
      ? [{ label: STRINGS.staffShell.nav.checkIn, route: '/check-in', icon: 'reservations' }]
      : []),
    {
      label: STRINGS.staffShell.nav.settings,
      icon: 'settings',
      dividerBefore: true,
      expandedByDefault: true,
      children: [
        { label: STRINGS.staffShell.nav.templates, route: '/spaces/templates', icon: 'templates' },
        {
          label: STRINGS.staffShell.nav.reservations,
          route: '/reservations/new',
          icon: 'reservations',
        },
        ...(this.session.user()?.role === 'ADMIN'
          ? [
              {
                label: STRINGS.staffShell.nav.payments,
                route: '/administration/settings/payment-methods',
                icon: 'settings',
              },
            ]
          : []),
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

  protected confirmEstablishment(id: string): void {
    if (!this.establishmentContext.confirm(id) || !this.selectorRequested()) return;
    void this.router.navigate(['/home']);
  }

  protected retryEstablishments(): void {
    void this.establishmentContext.load();
  }

  protected dismissSelector(): void {
    if (!this.canDismissSelector()) return;
    const previousId = this.previousEstablishmentId() ?? this.establishmentContext.active()?.id;
    if (!previousId || !this.establishmentContext.confirm(previousId)) return;
    void this.router.navigate(['/home']);
  }

  protected signOut(): void {
    this.session.logout();
  }
}
