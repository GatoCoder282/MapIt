import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthSession } from '@mapit/auth';
import type { PersonalProfile } from '@mapit/api-client';
import { Subscription } from 'rxjs';
import { MyAccountAccess } from '../../../core/my-account-access';
import { confirmOperationalExit } from '../../../core/operational-exit-guard';
import { STRINGS } from '../../../core/strings';
import { MyAccountApi } from '../data/my-account-api';

@Injectable()
export class MyAccountStore {
  private readonly api = inject(MyAccountApi);
  private readonly session = inject(AuthSession);
  private readonly access = inject(MyAccountAccess);
  private requests = new Subscription();
  private requestVersion = 0;
  private readonly owner = signal<string | null>(null);
  private readonly data = signal<PersonalProfile | null>(null);
  private readonly name = signal('');
  private readonly pendingRead = signal(false);
  private readonly pendingWrite = signal(false);
  private readonly savedState = signal(false);
  private readonly errorCode = signal<'load' | 'save' | 'unavailable' | null>(null);
  private readonly current = computed(
    () => this.access.enabled() && this.owner() === this.access.scope() && !!this.owner(),
  );
  readonly available = this.access.enabled;
  readonly profile = computed(() => (this.current() ? this.data() : null));
  readonly draft = computed(() => (this.current() ? this.name() : ''));
  readonly loading = computed(() => this.current() && this.pendingRead());
  readonly saving = computed(() => this.current() && this.pendingWrite());
  readonly saved = computed(() => this.current() && this.savedState());
  readonly error = computed(() => {
    const code = this.current() ? this.errorCode() : null;
    return code ? STRINGS.myAccount.errors[code] : '';
  });
  readonly sessionWarning = this.session.warning;
  readonly valid = computed(() => {
    const name = this.draft().trim();
    return [...name].length <= 120 && /^\S(?:[^\r\n]*\S)?$/u.test(name);
  });
  readonly dirty = computed(
    () => !!this.profile() && this.draft().trim() !== this.profile()?.fullName,
  );
  readonly canSave = computed(
    () => !!this.profile() && this.valid() && this.dirty() && !this.saving() && !this.loading(),
  );

  constructor() {
    effect(() => {
      const scope = this.access.scope();
      const enabled = this.access.enabled();
      this.cancelRequests();
      this.owner.set(scope);
      this.data.set(null);
      this.name.set('');
      this.pendingRead.set(false);
      this.pendingWrite.set(false);
      this.errorCode.set(null);
      this.savedState.set(false);
      if (scope && enabled) untracked(() => this.load());
    });
    inject(DestroyRef).onDestroy(() => this.cancelRequests());
  }

  setName(value: string): void {
    if (!this.current() || this.saving() || !this.profile()) return;
    this.name.set(value);
    this.savedState.set(false);
    this.errorCode.set(null);
  }

  reset(): void {
    if (this.saving()) return;
    this.name.set(this.profile()?.fullName ?? '');
    this.savedState.set(false);
    this.errorCode.set(null);
  }

  load(): void {
    if (!this.current() || this.pendingRead() || this.pendingWrite()) return;
    const version = ++this.requestVersion;
    const revision = this.session.revision();
    this.pendingRead.set(true);
    this.errorCode.set(null);
    this.requests.add(
      this.api.read().subscribe({
        next: (profile) => {
          if (!this.accepts(version, revision)) return;
          this.data.set(profile);
          this.name.set(profile.fullName);
          this.pendingRead.set(false);
        },
        error: (error: unknown) => {
          if (!this.accepts(version, revision)) return;
          this.pendingRead.set(false);
          this.errorCode.set(this.unavailable(error) ? 'unavailable' : 'load');
        },
      }),
    );
  }

  save(): void {
    if (!this.canSave()) return;
    const version = ++this.requestVersion;
    const revision = this.session.revision();
    this.pendingWrite.set(true);
    this.savedState.set(false);
    this.errorCode.set(null);
    this.requests.add(
      this.api.updateName(this.draft().trim()).subscribe({
        next: (profile) => {
          if (!this.accepts(version, revision)) return;
          if (!this.session.updateFullName(profile.fullName, revision)) {
            this.pendingWrite.set(false);
            this.errorCode.set('save');
            return;
          }
          this.data.set(profile);
          this.name.set(profile.fullName);
          this.pendingWrite.set(false);
          this.savedState.set(true);
        },
        error: (error: unknown) => {
          if (!this.accepts(version, revision)) return;
          this.pendingWrite.set(false);
          this.errorCode.set(this.unavailable(error) ? 'unavailable' : 'save');
        },
      }),
    );
  }

  canDeactivate(): boolean {
    return confirmOperationalExit(this.saving(), this.dirty());
  }

  private unavailable(error: unknown): boolean {
    return error instanceof HttpErrorResponse && [403, 404].includes(error.status);
  }

  private accepts(version: number, revision: number): boolean {
    return (
      this.current() && version === this.requestVersion && revision === this.session.revision()
    );
  }

  private cancelRequests(): void {
    this.requestVersion++;
    this.requests.unsubscribe();
    this.requests = new Subscription();
  }
}
