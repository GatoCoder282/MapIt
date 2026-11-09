import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { SiteFooter } from '@mapit/ui-kit';
import { STRINGS } from '../../core/strings';
@Component({
  selector: 'mp-about',
  imports: [NgOptimizedImage, SiteFooter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './about.html',
  styleUrl: './about.scss',
})
export class About {
  protected readonly copy = STRINGS.about;
  protected readonly icons = [
    'M12 2 2 7l10 5 10-5-10-5ZM2 12l10 5 10-5M2 17l10 5 10-5',
    'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
    'M3 20V5m0 10h18v5M3 11h5a3 3 0 0 1 3 3v1m0 0V9h6a4 4 0 0 1 4 4v2',
    'M21 12a9 9 0 1 1-9-9m0 5a4 4 0 1 0 4 4m-4 0 9-9m-5 0h5v5',
    'M3 16V8l3-4h3v8m6 0V4h3l3 4v8M9 16h6M6 21a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm12 0a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z',
    'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4ZM8 12l3 3 5-6',
    'M13 2 3 14h8l-1 8 11-13h-8l1-7',
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm9-7a4 4 0 0 1 0 8m4 9v-2a4 4 0 0 0-3-4',
  ];
}
