import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { STRINGS } from '../../../core/strings';
import { LoginStore } from '../model/login-store';

@Component({
  selector: 'mapit-login',
  imports: [FormsModule],
  providers: [LoginStore],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  protected readonly store = inject(LoginStore);
  protected readonly strings = STRINGS;
}
