import { inject, Injectable } from '@angular/core';
import { MyAccountService } from '@mapit/api-client';

@Injectable({ providedIn: 'root' })
export class MyAccountApi {
  private readonly client = inject(MyAccountService);

  read() {
    return this.client.getMyProfile(undefined, 'body', false, { transferCache: false });
  }

  updateName(fullName: string) {
    return this.client.updateMyProfile({ updateMyProfileRequest: { fullName } }, 'body', false, {
      transferCache: false,
    });
  }
}
