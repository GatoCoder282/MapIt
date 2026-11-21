import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { STRINGS } from '../../../core/strings';
import { MyAccountStore } from '../model/my-account-store';

@Component({
  selector: 'mapit-my-account',
  templateUrl: './my-account.html',
  styleUrl: './my-account.scss',
  providers: [MyAccountStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyAccount {
  protected readonly strings = STRINGS;
  protected readonly store = inject(MyAccountStore);

  protected submit(event: Event): void {
    event.preventDefault();
    this.store.save();
  }

  canDeactivate(): boolean {
    return this.store.canDeactivate();
  }
}
