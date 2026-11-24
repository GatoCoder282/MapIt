import { Injectable, inject } from '@angular/core';
import { BusinessApplicationsService } from '@mapit/api-client';
import type {
  BusinessApplicationDetail,
  BusinessApplicationPage,
  BusinessApplicationStatus,
} from '@mapit/api-client';
import type { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class BusinessApplicationsApi {
  private readonly client = inject(BusinessApplicationsService);

  list(
    search: string,
    status: BusinessApplicationStatus | '',
    page: number,
  ): Observable<BusinessApplicationPage> {
    return this.client.listBusinessApplications({
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
      page,
      size: 20,
    });
  }

  detail(id: string): Observable<BusinessApplicationDetail> {
    return this.client.getBusinessApplication({ id });
  }

  approve(id: string, slug: string): Observable<BusinessApplicationDetail> {
    return this.client.approveBusinessApplication({
      id,
      businessApplicationApprovalRequest: { slug },
    });
  }

  reject(id: string, reason: string): Observable<BusinessApplicationDetail> {
    return this.client.rejectBusinessApplication({
      id,
      businessApplicationRejectionRequest: { reason },
    });
  }
}
