import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  effect,
  inject,
  input,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { currentLocaleTag } from '@mapit/i18n';
import type { CustomerReservationHistoryItem } from '@mapit/api-client';
import { SiteFooter, SiteNav } from '@mapit/ui-kit';
import { filter } from 'rxjs';

import { STRINGS } from '../../../core/strings';
import { CustomerHistoryApi, type HistoryPeriod } from '../data/customer-history-api';
import { CustomerHistoryStore } from '../model/customer-history-store';

@Component({
  selector: 'mp-my-reservations-page',
  imports: [RouterLink, SiteNav, SiteFooter],
  providers: [CustomerHistoryApi, CustomerHistoryStore],
  templateUrl: './my-reservations-page.html',
  styleUrl: './my-reservations-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyReservationsPage {
  protected readonly tenantSlug = input.required<string>();
  protected readonly store = inject(CustomerHistoryStore);
  private readonly router = inject(Router);
  protected readonly strings = STRINGS.myReservations;
  protected readonly periods = ['upcoming', 'past'] as const;
  private incomingToken: string | null = takeLinkToken();
  private justConsumed = this.incomingToken !== null;

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        // Router puede volver a escribir el fragmento al finalizar una navegación.
        // Retirarlo de nuevo, sin canjear dos veces el mismo enlace.
        const token = takeLinkToken();
        if (token && !this.justConsumed) void this.store.exchange(token);
        this.justConsumed = false;
      });
    effect(() => {
      this.store.setTenant(this.tenantSlug());
      const token = this.incomingToken;
      this.incomingToken = null;
      if (token) void this.store.exchange(token);
    });
  }

  protected submit(event: Event): void {
    event.preventDefault();
    void this.store.requestAccess();
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected loadMore(period: HistoryPeriod): void {
    void this.store.load(period, true);
  }

  protected retry(period: HistoryPeriod): void {
    void this.store.load(period, this.section(period).items.length > 0);
  }

  protected section(period: HistoryPeriod) {
    return period === 'upcoming' ? this.store.upcoming() : this.store.past();
  }

  protected formatRange(reservation: CustomerReservationHistoryItem): string {
    const formatter = new Intl.DateTimeFormat(currentLocaleTag(), {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: reservation.timezone,
    });
    return `${formatter.format(new Date(reservation.startsAt))} – ${formatter.format(new Date(reservation.endsAt))}`;
  }

  @HostListener('window:hashchange')
  protected onHashChange(): void {
    const token = takeLinkToken();
    if (token) {
      this.justConsumed = true;
      void this.store.exchange(token);
    }
  }
}

/** El fragmento se retira síncronamente, antes de iniciar cualquier petición de la feature. */
function takeLinkToken(): string | null {
  if (typeof window === 'undefined' || !window.location.hash.startsWith('#token=')) return null;
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
  window.history.replaceState(
    window.history.state,
    '',
    window.location.pathname + window.location.search,
  );
  return token;
}
