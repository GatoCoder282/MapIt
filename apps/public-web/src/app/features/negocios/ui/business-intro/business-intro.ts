import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { currentLocaleTag } from '@mapit/i18n';
import { STRINGS } from '../../../../core/strings';

@Component({
  selector: 'mp-business-intro',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage],
  templateUrl: './business-intro.html',
  styleUrl: './business-intro.scss',
})
export class BusinessIntro {
  protected readonly copy = STRINGS.landing.showcase;

  protected formatDemoTime(hour: number): string {
    return new Intl.DateTimeFormat(currentLocaleTag(), {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(2026, 10, 7, hour)));
  }
}
