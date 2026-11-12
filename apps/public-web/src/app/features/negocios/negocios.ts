import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { SiteFooter } from '@mapit/ui-kit';
import { BusinessOperation } from './ui/business-operation/business-operation';
import { BusinessJoin } from './ui/business-join/business-join';
import { BusinessEditor } from './ui/business-editor/business-editor';
import { BusinessSteps } from './ui/business-steps/business-steps';
import { BusinessComparison } from './ui/business-comparison/business-comparison';
import { BusinessIntro } from './ui/business-intro/business-intro';
import { PublicRuntimeConfig } from '../../core/runtime-config';
import { STRINGS } from '../../core/strings';

@Component({
  selector: 'mp-negocios',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SiteFooter,
    NgOptimizedImage,
    BusinessIntro,
    BusinessSteps,
    BusinessComparison,
    BusinessEditor,
    BusinessJoin,
    BusinessOperation,
  ],
  templateUrl: './negocios.html',
  styleUrl: './negocios.scss',
})
export class Negocios {
  protected readonly runtime = inject(PublicRuntimeConfig);
  protected readonly copy = STRINGS.landing.showcase;
  protected readonly venueIcons = [
    'M4 20v-5m6 5V9m6 11V4m5 16V2',
    'M3 10h18l-2-7H5l-2 7Zm1 0v11h16V10M9 21v-7h6v7M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0',
    'M12 2 2 7l10 5 10-5-10-5ZM2 12l10 5 10-5M2 17l10 5 10-5',
  ];
  protected readonly bookingIcons = [
    'M4 5h16v16H4zM4 10h16M8 2v6m8-6v6m-8 7 2 2 4-4',
    'M3 5h18v14H3zM3 10h18m-14 5h3',
    'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM7 12l3 3 7-7',
  ];
  protected readonly industries = ['restaurant', 'nightclub', 'events', 'hotel'] as const;
  protected readonly industryIcons = [
    'M6 3v7m-2-7v4a2 2 0 0 0 4 0V3M6 10v11m8-18v18m0-18c-3 4-3 8 0 9',
    'M3 4h18l-9 9-9-9zm9 9v8m-4 0h8',
    'M4 5h16v16H4zM8 3v4m8-4v4M4 10h16m-11 4h2m4 0h2',
    'M3 20V5m0 10h18v5M3 11h5a3 3 0 0 1 3 3v1m0 0V9h6a4 4 0 0 1 4 4v2',
  ];
}
