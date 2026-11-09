import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { currentLocaleTag } from '@mapit/i18n';
import { SiteFooter } from '@mapit/ui-kit';
import { localizeString, STRINGS } from '../../../core/strings';
import { PublicEstablishmentIdentity } from '../../../core/public-establishment-identity';
import { PublicSpaceSummary } from '../../../core/public-space';
import { BookingStore } from '../model/booking-store';
import { ReservationHeader } from '../../../core/reservation-header';
import {
  LucideUser,
  LucideCalendarDays,
  LucideCheckCircle2,
  LucidePencil,
  LucideArrowRight,
} from '@lucide/angular';

@Component({
  selector: 'mp-booking-page',
  imports: [
    RouterLink,
    SiteFooter,
    PublicEstablishmentIdentity,
    PublicSpaceSummary,
    ReservationHeader,
    LucideUser,
    LucideCalendarDays,
    LucideCheckCircle2,
    LucidePencil,
    LucideArrowRight,
  ],
  templateUrl: './booking-page.html',
  styleUrl: './booking-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingPage {
  readonly tenantSlug = input.required<string>();
  readonly establishmentSlug = input.required<string>();
  readonly elementId = input.required<string>();
  readonly date = input('');
  readonly startTime = input('');
  readonly endTime = input('');
  readonly reservationId = input('');
  protected readonly store = inject(BookingStore);
  protected readonly strings = STRINGS;
  protected readonly localizeString = localizeString;
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  constructor() {
    effect(() => {
      const values = [
        this.tenantSlug(),
        this.establishmentSlug(),
        this.elementId(),
        this.date(),
        this.startTime(),
        this.endTime(),
        this.reservationId(),
      ] as const;
      untracked(() => {
        void this.store.configure(...values);
      });
    });
    effect(() => {
      const reservation = this.store.reservation();
      const current = this.reservationId();
      if (reservation && reservation.id !== current)
        untracked(() => {
          void this.router.navigate(
            ['/pago', this.tenantSlug(), this.establishmentSlug(), reservation.id],
            {
              fragment: this.store.checkoutFragment() ?? '',
              replaceUrl: true,
            },
          );
        });
    });
  }
  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.store.confirm();
    await this.store.submit();
    afterNextRender(
      () =>
        (
          this.host.nativeElement.querySelector<HTMLElement>('input[aria-invalid="true"]') ??
          this.host.nativeElement.querySelector<HTMLElement>('#booking-success-title')
        )?.focus(),
      { injector: this.injector },
    );
  }
  protected async back(): Promise<void> {
    if (this.store.status() === 'submitting') return;
    await this.router.navigate(['/elegir-espacio', this.tenantSlug(), this.establishmentSlug()], {
      queryParams: {
        date: this.store.date(),
        startTime: this.store.startTime(),
        endTime: this.store.endTime(),
        elementId: this.elementId(),
      },
    });
  }
  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
  protected formatDate(date: string): string {
    return new Intl.DateTimeFormat(currentLocaleTag(), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${date}T12:00:00Z`));
  }
}
