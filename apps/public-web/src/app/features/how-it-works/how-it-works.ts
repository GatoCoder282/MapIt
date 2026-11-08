import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SiteFooter } from '@mapit/ui-kit';
import { STRINGS } from '../../core/strings';
import { HowEditor } from './how-editor';
import { HowPhones } from './how-phones';
@Component({
  selector: 'mp-how-it-works',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage, RouterLink, SiteFooter, HowEditor, HowPhones],
  templateUrl: './how-it-works.html',
  styleUrl: './how-it-works.scss',
})
export class HowItWorks {
  protected readonly copy = STRINGS.howItWorks;
  protected readonly icons = [
    'M3 10h18l-2-7H5l-2 7Zm1 0v11h16V10M9 21v-7h6v7',
    'M12 2 2 7l10 5 10-5-10-5ZM2 12l10 5 10-5M2 17l10 5 10-5',
    'M4 5h16v16H4zM4 10h16M8 2v6m8-6v6m-8 7 2 2 4-4',
    'M3 5h18v14H3zM3 10h18m-14 5h3',
    'M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6M8 8h3v3H8zm5 5h3v3h-3z',
    'M4 20v-5m6 5V9m6 11V4m5 16V2',
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm9-7a4 4 0 0 1 0 8m4 9v-2a4 4 0 0 0-3-4',
    'M4 2l16 12-8 1-4 7L4 2Zm8 13 5 6',
    'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM12 6v6l4 2',
    'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2m3 6a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2',
    'M5 12l4 4L20 5',
    'M12 2v10h10A10 10 0 0 0 12 2Zm-3 1a10 10 0 1 0 12 12H9Z',
    'M3 20V5m0 10h18v5M3 11h5a3 3 0 0 1 3 3v1m0 0V9h6a4 4 0 0 1 4 4v2',
  ];
  protected readonly typeIcons = [this.icons[0], this.icons[6], this.icons[2], this.icons[12]];
  protected readonly featureIcons = [
    [0, 1, 6],
    [1, 7, 0],
    [2, 8, 3],
    [9, 4, 3],
    [4, 10, 6],
    [5, 11, 1],
  ];
}
