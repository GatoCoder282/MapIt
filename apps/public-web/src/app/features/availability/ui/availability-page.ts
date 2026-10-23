import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SiteFooter, SiteNav } from '@mapit/ui-kit';
import type { PublicAvailabilityElement } from '@mapit/api-client';

import { STRINGS } from '../../../core/strings';
import { AvailabilityStore } from '../model/availability-store';

/** Búsqueda pública por fecha para un establecimiento identificado por sus slugs. */
@Component({
  selector: 'mp-availability-page',
  imports: [RouterLink, SiteNav, SiteFooter],
  providers: [AvailabilityStore],
  templateUrl: './availability-page.html',
  styleUrl: './availability-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvailabilityPage {
  protected readonly tenantSlug = input.required<string>();
  protected readonly establishmentSlug = input.required<string>();
  protected readonly store = inject(AvailabilityStore);
  protected readonly strings = STRINGS;
  protected readonly date = signal(new Date().toLocaleDateString('en-CA'));
  protected readonly minimumDate = this.date();

  constructor() {
    effect(() => {
      this.tenantSlug();
      this.establishmentSlug();
      this.store.reset();
    });
  }

  protected setDate(event: Event): void {
    this.date.set((event.target as HTMLInputElement).value);
  }

  protected submit(event: Event): void {
    event.preventDefault();
    void this.search();
  }

  protected retry(): void {
    void this.search();
  }

  protected typeLabel(type: PublicAvailabilityElement['type']): string {
    return this.strings.availability.types[type];
  }

  protected formatDate(date: string): string {
    return new Intl.DateTimeFormat('es-BO', { dateStyle: 'long', timeZone: 'UTC' }).format(
      new Date(`${date}T12:00:00Z`),
    );
  }

  private search(): Promise<void> {
    return this.store.search(this.tenantSlug(), this.establishmentSlug(), this.date());
  }
}
