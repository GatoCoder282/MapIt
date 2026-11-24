import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { AuthSession } from '@mapit/auth';
import type { Subscription } from 'rxjs';
import { confirmOperationalExit } from '../../../core/operational-exit-guard';
import { MyAccountAccess } from '../../../core/my-account-access';
import { STRINGS } from '../../../core/strings';
import { MyAccountApi } from '../data/my-account-api';
import { fitsBcrypt, newPasswordRules } from './password-change-rules';

type PasswordField = 'currentPassword' | 'newPassword' | 'newPasswordConfirm';
const empty = () => ({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });

/** Los secretos solo viven en memoria durante la interacción y la solicitud. */
@Injectable()
export class PasswordChangeStore {
  private readonly access = inject(MyAccountAccess);
  private readonly session = inject(AuthSession);
  private readonly api = inject(MyAccountApi);
  private request: Subscription | undefined;
  private generation = 0;
  private readonly busy = signal(false);
  private readonly errorState = signal<'invalid' | 'limited' | 'uncertain' | null>(null);
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
  readonly saving = computed(() => this.currentScope() && this.busy());
  readonly dirty = computed(
    () => !!(this.currentPassword() || this.newPassword() || this.confirmation()),
  );
  readonly canSubmit = computed(() => this.currentScope() && this.valid() && !this.busy());
  readonly error = computed(() => {
    if (!this.currentScope()) return '';
    const key = this.errorState();
    return key ? STRINGS.myAccount.password[key] : '';
  });

  constructor() {
    effect(() => {
      const scope = this.access.scope();
      const enabled = this.access.enabled();
      this.owner.set(enabled ? scope : null);
      this.cancel();
      this.clear();
    });
    inject(DestroyRef).onDestroy(() => {
      this.cancel();
      this.clear();
    });
  }

  set(field: PasswordField, value: string): void {
    if (!this.currentScope() || this.busy()) return;
    this.values.update((values) => ({ ...values, [field]: value }));
  }

  clear(): void {
    this.values.set(empty());
  }

  canDeactivate(): boolean {
    return confirmOperationalExit(this.saving(), this.dirty());
  }

  submit(): void {
    if (!this.canSubmit()) return;
    const scope = this.access.scope();
    const revision = this.session.revision();
    const token = this.session.token();
    if (!token || !this.currentScope()) {
      this.clear();
      return;
    }
    const command = this.values();
    const generation = ++this.generation;
    const current = () =>
      generation === this.generation &&
      scope === this.access.scope() &&
      this.access.enabled() &&
      revision === this.session.revision();
    this.busy.set(true);
    this.errorState.set(null);
    this.clear();
    this.request = this.api.changePassword(command).subscribe({
      next: () => {
        if (!current()) return;
        this.busy.set(false);
        this.clear();
        // El backend ya revocó todos los JWT. Nunca cerrar una sesión nueva por un 204 tardío.
        this.session.clearIfCurrent(token);
      },
      error: (failure: unknown) => {
        if (!current()) return;
        this.busy.set(false);
        this.clear();
        const status =
          failure && typeof failure === 'object' && 'status' in failure ? failure.status : 0;
        this.errorState.set(status === 429 ? 'limited' : status === 400 ? 'invalid' : 'uncertain');
      },
    });
  }

  private cancel(): void {
    this.generation++;
    this.request?.unsubscribe();
    this.request = undefined;
    this.busy.set(false);
    this.errorState.set(null);
  }
}
