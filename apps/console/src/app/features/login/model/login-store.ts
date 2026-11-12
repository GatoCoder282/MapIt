import { HttpErrorResponse } from '@angular/common/http';
import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { finalize, timeout } from 'rxjs';
import type { LoginResponse } from '@mapit/api-client';
import { AuthSession } from '@mapit/auth';
import { PageTransitionService } from '@mapit/ui-kit';

import { STRINGS } from '../../../core/strings';
import { LoginApi } from '../data/login-api';

/** Timeout de la llamada de login (ms): cubre cold starts en dev local. */
const LOGIN_TIMEOUT_MS = 15_000;

@Injectable()
export class LoginStore {
  private readonly api = inject(LoginApi);
  private readonly session = inject(AuthSession);
  private readonly router = inject(Router);
  private readonly transition = inject(PageTransitionService);
  private readonly destroyRef = inject(DestroyRef);
  readonly email = signal('');
  readonly password = signal('');
  readonly passwordVisible = signal(false);
  readonly remember = signal(false);
  readonly submitted = signal(false);
  readonly pending = signal(false);
  readonly message = signal('');

  readonly emailError = computed(() => {
    if (!this.submitted()) return '';
    const email = this.email().trim();
    if (!email) return STRINGS.login.errors.emailRequired;
    return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ? ''
      : STRINGS.login.errors.emailInvalid;
  });
  readonly passwordError = computed(() =>
    this.submitted() && !this.password().trim() ? STRINGS.login.errors.passwordRequired : '',
  );

  setEmail(value: string): void {
    this.email.set(value);
    this.message.set('');
  }

  setPassword(value: string): void {
    this.password.set(value);
    this.message.set('');
  }

  togglePassword(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  toggleRemember(): void {
    this.remember.update((remember) => !remember);
  }

  submit(): void {
    if (this.pending()) return;
    this.submitted.set(true);
    this.message.set('');
    if (this.emailError() || this.passwordError()) return;

    const credentials = { email: this.email().trim().toLowerCase(), password: this.password() };
    const remember = this.remember();
    this.pending.set(true);
    this.api
      .login(credentials)
      .pipe(
        timeout(LOGIN_TIMEOUT_MS),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.pending.set(false)),
      )
      .subscribe({
        next: (response) => this.startSession(response, remember),
        error: (error: unknown) => this.showError(error),
      });
  }

  showHelp(kind: 'access' | 'password' = 'password'): void {
    this.message.set(STRINGS.login.help[kind]);
  }

  private showError(error: unknown): void {
    const status = error instanceof HttpErrorResponse ? error.status : 0;
    this.message.set(
      status === 401
        ? STRINGS.login.errors.invalidCredentials
        : status === 429
          ? STRINGS.login.errors.rateLimited
          : STRINGS.login.errors.connection,
    );
  }

  private startSession(response: LoginResponse, remember: boolean): void {
    try {
      this.session.start(response, remember);
    } catch {
      this.message.set(STRINGS.login.errors.startFailed);
      return;
    }
    this.submitted.set(false);
    this.password.set('');
    const role = this.session.user()?.role;
    void this.navigate(role === 'SUPER_ADMIN' ? '/admin/tenants' : '/home');
  }

  private async navigate(destination: string): Promise<void> {
    await this.transition.start();
    try {
      await this.router.navigateByUrl(destination);
    } finally {
      await this.transition.complete();
    }
  }
}
