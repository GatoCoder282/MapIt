import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { HttpErrorResponse } from '@angular/common/http';
import { filter, finalize, takeUntil, timeout } from 'rxjs';
import { AuthSession } from '@mapit/auth';
import { STRINGS } from '../../../core/strings';
import { SLUG_PATTERN } from '../../../core/patterns';
import { LoginApi } from '../data/login-api';

/** Timeout de la llamada de login (ms): cubre cold starts en dev local. */
const LOGIN_TIMEOUT_MS = 15_000;

/** Estado y coordinación del inicio de sesión. */
@Injectable()
export class LoginStore {
  private readonly api = inject(LoginApi);
  private readonly session = inject(AuthSession);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly pending = signal(false);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  readonly tenantSlug = computed(() => this.params().get('tenantSlug') ?? '');
  readonly email = signal('');
  readonly password = signal('');
  readonly passwordVisible = signal(false);
  readonly remember = signal(false);
  readonly submitted = signal(false);
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
    if (!SLUG_PATTERN.test(this.tenantSlug())) {
      this.message.set(STRINGS.login.errors.missingTenantLink);
      return;
    }
    const tenantSlug = this.tenantSlug();
    const remember = this.remember();
    this.pending.set(true);
    this.api
      .login({ tenantSlug, email: this.email().trim().toLowerCase(), password: this.password() })
      .pipe(
        timeout(LOGIN_TIMEOUT_MS),
        takeUntil(
          this.route.paramMap.pipe(filter((params) => params.get('tenantSlug') !== tenantSlug)),
        ),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.pending.set(false)),
      )
      .subscribe({
        next: (response) => {
          try {
            this.session.start(response, tenantSlug, remember);
          } catch {
            this.message.set(STRINGS.login.errors.startFailed);
            return;
          }
          this.password.set('');
          // Redirección por rol: el SUPER_ADMIN entra a la consola de plataforma;
          // el resto a la consola operativa de su tenant. Se lee de la sesión
          // validada (no del payload crudo) para no confiar en datos no verificados.
          void this.router.navigateByUrl(
            this.session.user()?.role === 'SUPER_ADMIN' ? '/admin/tenants' : '/home',
          );
        },
        error: (error: unknown) => {
          this.message.set(
            error instanceof HttpErrorResponse && error.status === 401
              ? STRINGS.login.errors.invalidCredentials
              : STRINGS.login.errors.connection,
          );
        },
      });
  }

  showHelp(kind: 'password' | 'access'): void {
    this.message.set(kind === 'password' ? STRINGS.login.help.password : STRINGS.login.help.access);
  }
}
