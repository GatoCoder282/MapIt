import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';

import { STRINGS } from '../../../core/strings';
import { ActivationApi } from '../data/activation-api';

/**
 * Estado del alta por invitación. El token nunca se guarda fuera del formulario
 * ni se loguea; solo viaja una vez al backend.
 */
@Injectable()
export class ActivationStore {
  private readonly api = inject(ActivationApi);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly tenantSlug = signal('');
  readonly token = signal('');
  readonly password = signal('');
  readonly passwordConfirm = signal('');
  readonly passwordVisible = signal(false);
  readonly pending = signal(false);
  readonly submitted = signal(false);
  readonly success = signal<string | null>(null);
  readonly message = signal('');

  readonly hasLinkParams = computed(() => this.tenantSlug() !== '' && this.token() !== '');

  readonly passwordError = computed(() => {
    if (!this.submitted()) return '';
    if (!this.password()) return STRINGS.activation.passwordRequired;
    const weak =
      this.password().length < 8 ||
      !/[A-Z]/.test(this.password()) ||
      !/[a-z]/.test(this.password()) ||
      !/\d/.test(this.password()) ||
      !/[^A-Za-z0-9]/.test(this.password());
    return weak ? STRINGS.activation.passwordWeak : '';
  });

  readonly confirmError = computed(() => {
    if (!this.submitted()) return '';
    return this.password() !== this.passwordConfirm() ? STRINGS.activation.passwordMismatch : '';
  });

  constructor() {
    const params = this.route.snapshot.queryParamMap;
    this.tenantSlug.set(params.get('tenant') ?? '');
    this.token.set(params.get('token') ?? '');
    if (!this.hasLinkParams()) {
      this.message.set(STRINGS.activation.missingLink);
    }
  }

  setPassword(value: string): void {
    this.password.set(value);
    this.message.set('');
  }

  setPasswordConfirm(value: string): void {
    this.passwordConfirm.set(value);
    this.message.set('');
  }

  togglePassword(): void {
    this.passwordVisible.update((v) => !v);
  }

  submit(): void {
    if (this.pending() || !this.hasLinkParams()) return;
    this.submitted.set(true);
    if (this.passwordError() || this.confirmError()) return;
    this.pending.set(true);
    this.api
      .activate(this.tenantSlug(), this.token(), this.password(), this.passwordConfirm())
      .pipe(
        finalize(() => this.pending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          this.success.set(response.tenantSlug);
          this.password.set('');
          this.passwordConfirm.set('');
        },
        error: (error: unknown) => this.message.set(this.describe(error)),
      });
  }

  /** Traduce el Problem Detail del backend a un mensaje claro. */
  private describe(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const type = (error.error as { type?: string } | null)?.type ?? '';
      if (error.status === 409) return STRINGS.activation.errors.duplicate;
      if (type.endsWith('invitation-expired')) return STRINGS.activation.errors.expired;
      if (type.endsWith('invitation-invalid') || type.endsWith('invitation-used'))
        return STRINGS.activation.errors.invalid;
      if (error.status === 400) return STRINGS.activation.passwordWeak;
    }
    return STRINGS.activation.errors.generic;
  }
}
