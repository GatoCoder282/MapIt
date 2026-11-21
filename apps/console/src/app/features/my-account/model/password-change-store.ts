import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { MyAccountAccess } from '../../../core/my-account-access';
import { STRINGS } from '../../../core/strings';
import { fitsBcrypt, newPasswordRules } from './password-change-rules';

type PasswordField = 'currentPassword' | 'newPassword' | 'newPasswordConfirm';
const empty = () => ({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });

/** Preparación local: sin transporte, outputs de secretos ni almacenamiento. */
@Injectable()
export class PasswordChangeStore {
  private readonly access = inject(MyAccountAccess);
  private readonly owner = signal<string | null>(null);
  private readonly values = signal(empty());
  private readonly currentScope = computed(
    () => this.access.enabled() && !!this.owner() && this.owner() === this.access.scope(),
  );
  readonly currentPassword = computed(() =>
    this.currentScope() ? this.values().currentPassword : '',
  );
  readonly newPassword = computed(() => (this.currentScope() ? this.values().newPassword : ''));
  readonly confirmation = computed(() =>
    this.currentScope() ? this.values().newPasswordConfirm : '',
  );
  readonly rules = computed(() => {
    const rules = newPasswordRules(this.newPassword());
    const labels = STRINGS.login.passwordStrength;
    return [
      { id: 'length', label: labels.length, met: rules.length },
      { id: 'casing', label: labels.casing, met: rules.casing },
      { id: 'digit', label: labels.digit, met: rules.digit },
      { id: 'symbol', label: labels.symbol, met: rules.symbol },
      { id: 'bytes', label: STRINGS.myAccount.password.byteLimit, met: rules.bytes },
    ];
  });
  readonly currentInvalid = computed(
    () => !!this.currentPassword() && !fitsBcrypt(this.currentPassword()),
  );
  readonly mismatch = computed(
    () => !!this.confirmation() && this.confirmation() !== this.newPassword(),
  );
  readonly reused = computed(
    () => !!this.newPassword() && this.newPassword() === this.currentPassword(),
  );
  readonly newInvalid = computed(
    () =>
      !!this.newPassword() &&
      (!Object.values(newPasswordRules(this.newPassword())).every(Boolean) || this.reused()),
  );
  readonly valid = computed(
    () =>
      fitsBcrypt(this.currentPassword()) &&
      Object.values(newPasswordRules(this.newPassword())).every(Boolean) &&
      this.confirmation() === this.newPassword() &&
      !this.reused(),
  );
  // No depende de la flag ON ni de que el formulario sea válido: falta revocación real.
  readonly canSubmit = false;

  constructor() {
    effect(() => {
      const scope = this.access.scope();
      const enabled = this.access.enabled();
      this.owner.set(enabled ? scope : null);
      this.clear();
    });
    inject(DestroyRef).onDestroy(() => this.clear());
  }

  set(field: PasswordField, value: string): void {
    if (!this.currentScope()) return;
    this.values.update((values) => ({ ...values, [field]: value }));
  }

  clear(): void {
    this.values.set(empty());
  }
}
