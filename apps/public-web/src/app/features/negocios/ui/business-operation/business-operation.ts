import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PublicRuntimeConfig } from '../../../../core/runtime-config';
import { STRINGS } from '../../../../core/strings';
@Component({
  selector: 'mp-business-operation',
  imports: [NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './business-operation.html',
  styleUrl: './business-operation.scss',
})
export class BusinessOperation {
  protected readonly runtime = inject(PublicRuntimeConfig);
  protected readonly copy = STRINGS.landing.showcase.operationOverview;
  protected readonly strings = STRINGS;
  protected readonly icons = [
    'M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16m6-14v16',
    'M4 5h16v16H4zM4 10h16M8 2v6m8-6v6m-8 7 2 2 4-4',
    'M4 21v-6m5 6V9m6 12V3m5 18V7',
  ];
  protected readonly statusIcons = [
    'M5 11V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4M3 11h18v6H3zM5 17v4m14-4v4',
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-4M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm4-3a4 4 0 0 1 0 8',
    'M4 5h16v16H4zM4 10h16M8 2v6m8-6v6m-8 7 2 2 4-4',
    'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Zm7-2v4m-2-2h4',
    'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM5 19 19 5',
  ];
  protected readonly tables = [
    { x: 25.5, y: 20, status: 1 },
    { x: 49.5, y: 18.5, status: 0 },
    { x: 81.5, y: 20, status: 0 },
    { x: 26.5, y: 44, status: 0 },
    { x: 50, y: 52, status: 3 },
    { x: 76, y: 54, status: 0 },
    { x: 27, y: 69, status: 4 },
    { x: 59, y: 77, status: 0 },
    { x: 81.5, y: 77, status: 2 },
  ];
  protected readonly counts = this.statusIcons.map(
    (_, status) => this.tables.filter((table) => table.status === status).length,
  );
}
