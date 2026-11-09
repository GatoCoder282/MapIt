import {
  ChangeDetectionStrategy,
  Component,
  afterRenderEffect,
  type ElementRef,
  effect,
  inject,
  input,
  untracked,
  viewChild,
} from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import {
  LucideCalendarDays,
  LucideCheckCircle2,
  LucideMapPin,
  LucideClock3,
  LucideChevronLeft,
  LucideChevronRight,
} from '@lucide/angular';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { currentLocaleTag } from '@mapit/i18n';
import { SiteFooter } from '@mapit/ui-kit';
import { localizeString, STRINGS } from '../../../core/strings';
import { PublicEstablishmentIdentity } from '../../../core/public-establishment-identity';
import { AvailabilityStore } from '../model/availability-store';
import { SpaceSelection } from './space-selection';
import { ReservationHeader } from '../../../core/reservation-header';

@Component({
  selector: 'mp-availability-page',
  imports: [
    RouterLink,
    SiteFooter,
    PublicEstablishmentIdentity,
    SpaceSelection,
    ReservationHeader,
    NgOptimizedImage,
    LucideCalendarDays,
    LucideCheckCircle2,
    LucideMapPin,
    LucideClock3,
    LucideChevronLeft,
    LucideChevronRight,
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
  readonly people = input('');
  readonly selectionStep = input(false);
  readonly elementId = input('');
  protected readonly store = inject(AvailabilityStore);
  protected readonly strings = STRINGS;
  protected readonly localizeString = localizeString;
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly timeList = viewChild<ElementRef<HTMLElement>>('timeList');
  constructor() {
    afterRenderEffect({
      earlyRead: () => {
        const time = this.store.startTime() || '09:00';
        const list = this.timeList()?.nativeElement;
        const choice = list?.querySelector<HTMLElement>(`[data-time="${CSS.escape(time)}"]`);
        return list && choice
          ? { list, top: Math.max(0, choice.offsetTop - 100), left: choice.offsetLeft - 4 }
          : null;
      },
      write: (measurement) => {
        const next = measurement();
        if (next) {
          next.list.scrollTop = next.top;
          next.list.scrollLeft = next.left;
        }
      },
    });
    effect(() => {
      const values = [
        this.tenantSlug(),
        this.establishmentSlug(),
        this.date(),
        this.startTime(),
        this.endTime(),
        this.people(),
      ] as const;
      const choosing = this.selectionStep() === true;
      const selectedId = this.elementId() || null;
      untracked(() => {
        this.store.configure(...values);
        if (choosing) {
          if (this.store.response()) this.store.restoreSelection(selectedId);
          else void this.store.search(selectedId);
        }
      });
    });
  }
  protected async selectSpace(id: string | null): Promise<void> {
    this.store.select(id);
    if (this.selectionStep() === true) {
      await this.router.navigate([], {
        relativeTo: this.route,
        queryParamsHandling: 'merge',
        queryParams: { elementId: this.store.selectedElementId() },
        replaceUrl: true,
      });
    }
  }
  protected async continueToSpaces(): Promise<void> {
    if (
      this.store.status() !== 'loaded' ||
      this.store.availableCount() === 0 ||
      this.store.people() === null
    )
      return;
    await this.router.navigate(['/elegir-espacio', this.tenantSlug(), this.establishmentSlug()], {
      queryParams: {
        date: this.store.date(),
        startTime: this.store.startTime(),
        endTime: this.store.endTime(),
        people: this.store.people(),
        elementId: this.store.selectedElementId(),
      },
    });
  }
  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
  protected formatDate(date: string): string {
    return new Intl.DateTimeFormat(currentLocaleTag(), {
      dateStyle: 'long',
      timeZone: 'UTC',
    }).format(new Date(`${date}T12:00:00Z`));
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
        people: this.store.people(),
      },
    });
  }
}
