import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { SiteFooter, SiteNav } from '@mapit/ui-kit';
import { STRINGS } from '../../../core/strings';
import { PublicEstablishmentIdentity } from '../../../core/public-establishment-identity';
import { PublicSpaceSummary } from '../../../core/public-space';
import { AvailabilityStore } from '../model/availability-store';
import { PublicMap } from './public-map';

@Component({
  selector: 'mp-availability-page',
  imports: [
    RouterLink,
    SiteNav,
    SiteFooter,
    PublicEstablishmentIdentity,
    PublicMap,
    PublicSpaceSummary,
  ],
  providers: [AvailabilityStore],
  templateUrl: './availability-page.html',
  styleUrl: './availability-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvailabilityPage {
  readonly tenantSlug = input.required<string>();
  readonly establishmentSlug = input.required<string>();
  readonly date = input('');
  readonly startTime = input('');
  readonly endTime = input('');
  readonly endDate = input('');
  protected readonly store = inject(AvailabilityStore);
  protected readonly strings = STRINGS;
  protected readonly states = ['AVAILABLE', 'RESERVED', 'UNAVAILABLE'] as const;
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  constructor() {
    effect(() => {
      const values = [
        this.tenantSlug(),
        this.establishmentSlug(),
        this.date(),
        this.startTime(),
        this.endTime(),
        this.endDate(),
      ] as const;
      untracked(() => this.store.configure(...values));
    });
  }
  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    await this.store.search();
    if (!this.store.response()) return;
    await this.router.navigate([], {
      relativeTo: this.route,
      replaceUrl: true,
      queryParams: {
        date: this.store.date(),
        startTime: this.store.startTime(),
        endTime: this.store.endTime(),
        endDate: this.store.stay() ? this.store.endDate() : null,
      },
    });
  }
}
