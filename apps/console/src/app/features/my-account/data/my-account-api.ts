import { inject, Injectable } from '@angular/core';
import {
  MyAccountService,
  type ChangeMyPasswordRequest,
  type UpdateMyProfileRequest,
} from '@mapit/api-client';

@Injectable({ providedIn: 'root' })
export class MyAccountApi {
  private readonly client = inject(MyAccountService);

  changePassword(command: ChangeMyPasswordRequest) {
    return this.client.changeMyPassword({ changeMyPasswordRequest: command }, 'body', false, {
      transferCache: false,
    });
  }

  read() {
    return this.client.getMyProfile(undefined, 'body', false, { transferCache: false });
  }

  update(patch: UpdateMyProfileRequest) {
    return this.client.updateMyProfile({ updateMyProfileRequest: patch }, 'body', false, {
      transferCache: false,
    });
  }
}
