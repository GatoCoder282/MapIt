import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import {
  LucideArmchair,
  LucideCheck,
  LucideChevronDown,
  LucideCircleSlash,
  LucideLoaderCircle,
} from '@lucide/angular';
import { localizeString, STRINGS } from '../../../core/strings';
import { I18nService } from '@mapit/i18n';
import { QuickReservationStore } from '../model/quick-reservation-store';

@Component({
  selector: 'mapit-quick-reservation',
  imports: [
    LucideArmchair,
    LucideCheck,
    LucideChevronDown,
    LucideCircleSlash,
    LucideLoaderCircle,
    NgOptimizedImage,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quick-reservation.html',
  styleUrl: './quick-reservation.scss',
})
export class QuickReservationComponent {
  readonly cancelled = output<void>();
  protected readonly store = inject(QuickReservationStore);
  protected readonly strings = STRINGS.spaces.editor.monitor.quickBooking;
  protected readonly localize = localizeString;
  protected readonly locale = inject(I18nService).locale;
  protected readonly countryNames = computed(
    () => new Intl.DisplayNames(this.locale(), { type: 'region' }),
  );
}
