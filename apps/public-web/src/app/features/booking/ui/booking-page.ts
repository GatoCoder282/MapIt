import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { currentLocaleTag } from '@mapit/i18n';
import { SiteFooter, SiteNav } from '@mapit/ui-kit';

import { localizeString, STRINGS } from '../../../core/strings';
import { BookingStore } from '../model/booking-store';

/** Formulario público para reservar un espacio concreto de un establecimiento. */
@Component({
  selector: 'mp-booking-page',
  imports: [RouterLink, SiteNav, SiteFooter],
  providers: [BookingStore],
  templateUrl: './booking-page.html',
  styleUrl: './booking-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingPage {
  protected readonly tenantSlug = input.required<string>();
  protected readonly establishmentSlug = input.required<string>();
  protected readonly elementId = input.required<string>();
  protected readonly date = input('');
  protected readonly store = inject(BookingStore);
  protected readonly strings = STRINGS;
  protected readonly localizeString = localizeString;
  protected readonly minimumDate = new Date().toLocaleDateString('en-CA');

  constructor() {
    effect(() => {
      this.store.reset();
      this.store.initialize(this.date());
    });
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.store.submit(this.tenantSlug(), this.establishmentSlug(), this.elementId());
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected formatWhen(date: string, startTime: string, endTime: string): string {
    const day = new Intl.DateTimeFormat(currentLocaleTag(), {
      dateStyle: 'long',
      timeZone: 'UTC',
    }).format(new Date(`${date}T12:00:00Z`));
    return `${day} · ${startTime}–${endTime}`;
  }
}
