import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import { I18nService } from '@mapit/i18n';
import { STRINGS } from '../../../core/strings';
import { MyAccountStore } from '../model/my-account-store';
import { PasswordChangeForm } from './password-change-form';

@Component({
  selector: 'mapit-my-account',
  templateUrl: './my-account.html',
  styleUrl: './my-account.scss',
  providers: [MyAccountStore],
  imports: [PasswordChangeForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyAccount {
  private readonly password = viewChild(PasswordChangeForm);
  protected readonly strings = STRINGS;
  protected readonly store = inject(MyAccountStore);
  protected readonly languages = inject(I18nService).languages.filter(({ code }) =>
    ['es', 'en', 'ja-JP'].includes(code),
  );

  protected submit(event: Event): void {
    event.preventDefault();
    this.store.save();
  }

  canDeactivate(): boolean {
    return (this.password()?.canDeactivate() ?? true) && this.store.canDeactivate();
  }
}
