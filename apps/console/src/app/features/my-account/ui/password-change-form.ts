import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { STRINGS } from '../../../core/strings';
import { PasswordChangeStore } from '../model/password-change-store';

/** No montar en Mi cuenta/rutas hasta completar endpoint, límites y revocación. */
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

  protected preventSubmit(event: Event): void {
    event.preventDefault();
  }
}
