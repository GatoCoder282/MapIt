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
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SiteFooter, SiteNav } from '@mapit/ui-kit';
import { STRINGS } from '../../../core/strings';
import { PublicEstablishmentIdentity } from '../../../core/public-establishment-identity';
import { PublicSpaceSummary } from '../../../core/public-space';
import { BookingStore } from '../model/booking-store';

@Component({
  selector: 'mp-booking-page',
  imports: [RouterLink, SiteNav, SiteFooter, PublicEstablishmentIdentity, PublicSpaceSummary],
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
  readonly endDate = input('');
  readonly reservationId = input('');
  protected readonly store = inject(BookingStore);
  protected readonly strings = STRINGS;
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');
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
        this.endDate(),
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
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParamsHandling: 'merge',
            queryParams: { reservationId: reservation.id },
            replaceUrl: true,
          });
        });
    });
  }
  protected confirm(): void {
    this.store.confirm();
    afterNextRender(() => this.heading()?.nativeElement.focus(), { injector: this.injector });
  }
  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    await this.store.submit();
    afterNextRender(
      () =>
        this.host.nativeElement
          .querySelector<HTMLInputElement>('input[aria-invalid="true"]')
          ?.focus(),
      { injector: this.injector },
    );
  }
  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
