import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LoginStore } from '../model/login-store';
import { RegisterStore } from '../model/register-store';
import { PasswordStrength } from './password-strength';

@Component({
  selector: 'mapit-login',
  imports: [FormsModule, PasswordStrength],
  providers: [LoginStore, RegisterStore],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  protected readonly store = inject(LoginStore);
  protected readonly register = inject(RegisterStore);

  /** Vista activa del panel: acceso o registro (solo visual). */
  protected readonly mode = signal<'login' | 'register'>('login');

  protected setMode(mode: 'login' | 'register'): void {
    this.mode.set(mode);
  }
}
