import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  input,
  viewChild,
} from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { LucideArmchair, LucideCalendarDays, LucideCheckCircle2 } from '@lucide/angular';
import { STRINGS } from './strings';

@Component({
  selector: 'mp-reservation-header',
  imports: [NgOptimizedImage, LucideArmchair, LucideCalendarDays, LucideCheckCircle2],
  templateUrl: './reservation-header.html',
  styleUrl: './reservation-header.scss',
  host: { '[class.compact]': 'compact()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservationHeader {
  readonly activeStep = input<1 | 2 | 3>(1);
  readonly compact = input(false);
  readonly autofocus = input(false);
  protected readonly strings = STRINGS;
  private readonly title = viewChild<ElementRef<HTMLElement>>('title');
  constructor() {
    afterRenderEffect({
      write: () => {
        if (this.autofocus()) {
          this.title()?.nativeElement.focus({ preventScroll: true });
          window.scrollTo({ top: 0 });
        }
      },
    });
  }
}
