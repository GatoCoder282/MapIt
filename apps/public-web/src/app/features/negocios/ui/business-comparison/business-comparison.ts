import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { currentLocaleTag } from '@mapit/i18n';
import { PublicRuntimeConfig } from '../../../../core/runtime-config';
import { STRINGS } from '../../../../core/strings';

@Component({
  selector: 'mp-business-comparison',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage],
  templateUrl: './business-comparison.html',
  styleUrl: './business-comparison.scss',
})
export class BusinessComparison {
  protected readonly runtime = inject(PublicRuntimeConfig);
  protected readonly strings = STRINGS;
  protected reservationTime(): string {
    return new Intl.DateTimeFormat(currentLocaleTag(), {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(2026, 10, 7, 20)));
  }
}
