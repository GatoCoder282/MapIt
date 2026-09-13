import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { HttpErrorResponse } from '@angular/common/http';
import { filter, finalize, takeUntil, timeout } from 'rxjs';
import { AuthSession } from '@mapit/auth';
import { LoginApi } from '../data/login-api';

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
    if (!email) return 'Ingresa tu correo electrónico.';
    return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ? ''
      : 'Ingresa un correo electrónico válido.';
  });
  readonly passwordError = computed(() =>
    this.submitted() && !this.password().trim() ? 'Ingresa tu contraseña.' : '',
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
    if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(this.tenantSlug())) {
      this.message.set('Abre el enlace de acceso de tu empresa para continuar.');
      return;
    }
    const tenantSlug = this.tenantSlug();
    const remember = this.remember();
    this.pending.set(true);
    this.api
      .login({ tenantSlug, email: this.email().trim().toLowerCase(), password: this.password() })
      .pipe(
        timeout(15000),
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
            this.message.set('No se pudo iniciar la sesión. Inténtalo de nuevo.');
            return;
          }
          this.password.set('');
          void this.router.navigateByUrl('/home');
        },
        error: (error: unknown) => {
          this.message.set(
            error instanceof HttpErrorResponse && error.status === 401
              ? 'Credenciales inválidas.'
              : 'No pudimos conectar con el servicio. Inténtalo de nuevo.',
          );
        },
      });
  }

  showHelp(kind: 'password' | 'access'): void {
    this.message.set(
      kind === 'password'
        ? 'La recuperación de contraseña aún no está disponible. Contacta al administrador de tu empresa.'
        : 'Las solicitudes de acceso aún no están disponibles desde esta pantalla.',
    );
  }
}
