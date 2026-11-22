import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import type { TenantUser } from '@mapit/api-client';

import { STRINGS } from '../../../../core/strings';
import { StaffAccessStore } from '../model/staff-access-store';

@Component({
  selector: 'mapit-staff-establishments',
  providers: [StaffAccessStore],
  templateUrl: './staff-establishments.html',
  styleUrl: './staff-establishments.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffEstablishments {
  readonly user = input.required<TenantUser>();
  protected readonly strings = STRINGS.users.staffAccess;
  protected readonly store = inject(StaffAccessStore);

  constructor() {
    effect(() => {
      void this.store.load(this.user());
    });
  }
}
