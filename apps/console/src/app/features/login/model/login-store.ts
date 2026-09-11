import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

/** Estado del formulario; MAP-50 incorporará autenticación y sesión. */
@Injectable()
export class LoginStore {
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
    this.submitted.set(true);
    this.message.set('');
    if (this.emailError() || this.passwordError()) return;
    if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(this.tenantSlug())) {
      this.message.set('Abre el enlace de acceso de tu empresa para continuar.');
      return;
    }
    this.message.set('El inicio de sesión estará disponible próximamente.');
  }

  showHelp(kind: 'password' | 'access'): void {
    this.message.set(
      kind === 'password'
        ? 'La recuperación de contraseña aún no está disponible. Contacta al administrador de tu empresa.'
        : 'Las solicitudes de acceso aún no están disponibles desde esta pantalla.',
    );
  }
}
