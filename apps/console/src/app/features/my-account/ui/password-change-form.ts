import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { STRINGS } from '../../../core/strings';
import { PasswordChangeStore } from '../model/password-change-store';

@Component({
  selector: 'mapit-password-change-form',
  templateUrl: './password-change-form.html',
  styleUrl: './password-change-form.scss',
  providers: [PasswordChangeStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordChangeForm {
  protected readonly store = inject(PasswordChangeStore);
  protected readonly strings = STRINGS;

  canDeactivate(): boolean {
    return this.store.canDeactivate();
  }

  protected preventSubmit(event: Event): void {
    event.preventDefault();
    this.store.submit();
  }
}
