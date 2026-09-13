import { computed, Injectable, signal } from '@angular/core';

/**
 * Estado del formulario de registro (solo visual por ahora).
 *
 * No toca el backend: el alta real de empresas vive en
 * `features/administration/tenant-registration`. Al enviar, muestra el mismo
 * mensaje de "solicitud no disponible" que usa el login para esa acción.
 */
@Injectable()
export class RegisterStore {
  readonly name = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly passwordVisible = signal(false);
  readonly confirmPassword = signal('');
  readonly submitted = signal(false);
  readonly message = signal('');

  /** Coincidencia reactiva entre contraseña y confirmación (adaptado de React demo.tsx). */
  readonly passwordsMatch = computed(() => {
    const p = this.password();
    const cp = this.confirmPassword();
    return Boolean(p && cp && p === cp);
  });

  /** Muestra error de discordancia en tiempo real mientras el usuario escribe. */
  readonly showMismatch = computed(() => {
    const p = this.password();
    const cp = this.confirmPassword();
    return cp.length > 0 && p !== cp;
  });

  readonly nameError = computed(() =>
    this.submitted() && !this.name().trim() ? 'Ingresa el nombre de tu negocio.' : '',
  );
  readonly emailError = computed(() => {
    if (!this.submitted()) return '';
    const email = this.email().trim();
    if (!email) return 'Ingresa tu correo electrónico.';
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : 'Ingresa un correo válido.';
  });
  readonly passwordError = computed(() =>
    this.submitted() && !this.password().trim() ? 'Crea una contraseña.' : '',
  );
  readonly confirmPasswordError = computed(() => {
    if (!this.submitted()) return '';
    const confirm = this.confirmPassword().trim();
    if (!confirm) return 'Confirma tu contraseña.';
    return confirm !== this.password() ? 'Las contraseñas no coinciden.' : '';
  });

  set(field: 'name' | 'email' | 'password' | 'confirmPassword', value: string): void {
    this[field].set(value);
    this.message.set('');
  }

  togglePassword(): void {
    this.passwordVisible.update((v) => !v);
  }

  submit(): void {
    this.submitted.set(true);
    if (
      this.nameError() ||
      this.emailError() ||
      this.passwordError() ||
      this.confirmPasswordError()
    ) {
      return;
    }
    this.message.set('Las solicitudes de acceso aún no están disponibles desde esta pantalla.');
  }
}
