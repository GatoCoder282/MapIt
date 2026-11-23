import { inject, Injectable } from '@angular/core';
import { EstablishmentsService } from '@mapit/api-client';

@Injectable({ providedIn: 'root' })
export class StaffAccessApi {
  private readonly client = inject(EstablishmentsService);

  establishments() {
    return this.client.listAccessibleEstablishments();
  }

  staff(establishmentId: string) {
    return this.client.listEstablishmentStaffAccess({ establishmentId });
  }

  save(establishmentId: string, userId: string, canCheckIn: boolean) {
    return this.client.saveEstablishmentStaffAccess({
      establishmentId,
      userId,
      establishmentStaffAccessWrite: { canCheckIn },
    });
  }
}
