import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideArmchair,
  LucideCalendarDays,
  LucideCheckCircle2,
  LucideClock3,
  LucideInfo,
  LucideLayers,
  LucideMap,
  LucideMapPin,
  LucideUsers,
  LucideArrowRight,
} from '@lucide/angular';
import { STRINGS } from '../../../core/strings';
import { AvailabilityStore } from '../model/availability-store';
import { PublicMap } from './public-map';

@Component({
  selector: 'mp-space-selection',
  imports: [
    RouterLink,
    PublicMap,
    LucideArmchair,
    LucideCalendarDays,
    LucideCheckCircle2,
    LucideClock3,
    LucideInfo,
    LucideLayers,
    LucideMap,
    LucideMapPin,
    LucideUsers,
    LucideArrowRight,
  ],
  templateUrl: './space-selection.html',
  styleUrl: './space-selection.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpaceSelection {
  readonly tenantSlug = input.required<string>();
  readonly establishmentSlug = input.required<string>();
  readonly dateLabel = input.required<string>();
  readonly selected = output<string | null>();
  protected readonly store = inject(AvailabilityStore);
  protected readonly strings = STRINGS;
  protected readonly states = ['AVAILABLE', 'RESERVED', 'UNAVAILABLE'] as const;
  protected readonly typeLabels: Readonly<Record<string, string>> = STRINGS.availability.types;
  protected value(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }
}
