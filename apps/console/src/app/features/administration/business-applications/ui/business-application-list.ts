import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { BusinessApplicationStatus } from '@mapit/api-client';
import { STRINGS } from '../../../../core/strings';
import { BusinessApplicationsStore } from '../model/business-applications-store';

@Component({
  selector: 'mapit-business-application-list',
  imports: [RouterLink],
  providers: [BusinessApplicationsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './business-application-list.html',
  styleUrl: './business-application-list.scss',
})
export class BusinessApplicationList {
  protected readonly copy = STRINGS.businessApplications;
  protected readonly store = inject(BusinessApplicationsStore);

  constructor() {
    this.store.load();
  }

  protected filter(event: Event, search: string, status: string): void {
    event.preventDefault();
    this.store.filter(search, status as BusinessApplicationStatus | '');
  }
}
