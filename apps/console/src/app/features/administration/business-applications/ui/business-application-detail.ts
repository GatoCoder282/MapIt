import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { STRINGS } from '../../../../core/strings';
import { BusinessApplicationsStore } from '../model/business-applications-store';

@Component({
  selector: 'mapit-business-application-detail',
  imports: [RouterLink],
  providers: [BusinessApplicationsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './business-application-detail.html',
  styleUrl: './business-application-list.scss',
})
export class BusinessApplicationDetailPage {
  protected readonly copy = STRINGS.businessApplications;
  protected readonly store = inject(BusinessApplicationsStore);

  constructor() {
    this.store.loadDetail(inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '');
  }

  protected approve(event: Event, id: string, slug: string): void {
    event.preventDefault();
    if (!this.store.deciding()) this.store.approve(id, slug.trim());
  }

  protected reject(event: Event, id: string, reason: string): void {
    event.preventDefault();
    if (!this.store.deciding()) this.store.reject(id, reason.trim());
  }
}
