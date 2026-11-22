import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthSession } from '@mapit/auth';
import type { PersonalProfile, UpdateMyProfileRequest } from '@mapit/api-client';
import { I18nService } from '@mapit/i18n';
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
  private readonly i18n = inject(I18nService);
  private requests = new Subscription();
  private requestVersion = 0;
  private readonly owner = signal<string | null>(null);
  private readonly data = signal<PersonalProfile | null>(null);
  private readonly name = signal('');
  private readonly phone = signal('');
  private readonly language = signal('');
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
  readonly phoneDraft = computed(() => (this.current() ? this.phone() : ''));
  readonly languageDraft = computed(() => (this.current() ? this.language() : ''));
  readonly loading = computed(() => this.current() && this.pendingRead());
  readonly saving = computed(() => this.current() && this.pendingWrite());
  readonly saved = computed(() => this.current() && this.savedState());
  readonly error = computed(() => {
    const code = this.current() ? this.errorCode() : null;
    return code ? STRINGS.myAccount.errors[code] : '';
  });
  readonly sessionWarning = this.session.warning;
  readonly nameValid = computed(() => {
    const name = this.draft().trim();
    return [...name].length <= 120 && /^\S(?:[^\r\n]*\S)?$/u.test(name);
  });
  readonly phoneValid = computed(() => validPhone(this.phoneDraft() || null));
  readonly languageValid = computed(
    () => this.languageDraft() === '' || supportedLanguage(this.languageDraft()),
  );
  readonly valid = computed(() => this.nameValid() && this.phoneValid() && this.languageValid());
  readonly dirty = computed(
    () =>
      !!this.profile() &&
      (this.draft().trim() !== this.profile()?.fullName ||
        (this.phoneDraft() || null) !== this.profile()?.contactPhone ||
        (this.languageDraft() || null) !== this.profile()?.preferredLanguage),
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
      this.phone.set('');
      this.language.set('');
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

  setPhone(value: string): void {
    if (!this.current() || this.saving() || !this.profile()) return;
    this.phone.set(value);
    this.savedState.set(false);
    this.errorCode.set(null);
  }

  setLanguage(value: string): void {
    if (!this.current() || this.saving() || !this.profile()) return;
    this.language.set(value);
    this.savedState.set(false);
    this.errorCode.set(null);
  }

  private fillDraft(profile: PersonalProfile): void {
    this.name.set(profile.fullName);
    this.phone.set(profile.contactPhone ?? '');
    this.language.set(profile.preferredLanguage ?? '');
  }

  reset(): void {
    if (this.saving()) return;
    const profile = this.profile();
    if (profile) this.fillDraft(profile);
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
          if (!validProfile(profile)) {
            this.pendingRead.set(false);
            this.errorCode.set('load');
            return;
          }
          this.data.set(profile);
          this.fillDraft(profile);
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
    const languageAtRequest = this.i18n.language();
    const previous = this.profile()!;
    const selectedLanguage = this.languageDraft();
    const preferredLanguage = supportedLanguage(selectedLanguage) ? selectedLanguage : null;
    const patch: UpdateMyProfileRequest = {
      ...(this.draft().trim() !== previous.fullName ? { fullName: this.draft().trim() } : {}),
      ...((this.phoneDraft() || null) !== previous.contactPhone
        ? { contactPhone: this.phoneDraft() || null }
        : {}),
      ...((this.languageDraft() || null) !== previous.preferredLanguage
        ? { preferredLanguage }
        : {}),
    };
    this.pendingWrite.set(true);
    this.savedState.set(false);
    this.errorCode.set(null);
    this.requests.add(
      this.api.update(patch).subscribe({
        next: (profile) => {
          if (!this.accepts(version, revision)) return;
          if (!validProfile(profile)) {
            this.pendingWrite.set(false);
            this.errorCode.set('save');
            return;
          }
          if (!this.session.updateFullName(profile.fullName, revision)) {
            this.pendingWrite.set(false);
            this.errorCode.set('save');
            return;
          }
          this.data.set(profile);
          this.fillDraft(profile);
          // Otra sesión o un idioma local distinto al capturado al enviar prevalecen.
          if (
            patch.preferredLanguage !== undefined &&
            profile.preferredLanguage !== null &&
            this.i18n.language() === languageAtRequest &&
            this.accepts(version, revision)
          ) {
            this.i18n.setLanguage(profile.preferredLanguage);
          }
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

function supportedLanguage(
  value: unknown,
): value is NonNullable<PersonalProfile['preferredLanguage']> {
  return value === 'es' || value === 'en' || value === 'ja-JP';
}

function validPhone(value: unknown): boolean {
  // Final absoluto: $ de JavaScript también permite una línea final, que el backend rechaza.
  return (
    value === null ||
    (typeof value === 'string' &&
      value.length <= 32 &&
      /^[+0-9() ./-]*[0-9][+0-9() ./-]*(?![\s\S])/u.test(value))
  );
}

function validProfile(value: unknown): value is PersonalProfile {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Partial<PersonalProfile>;
  return (
    typeof profile.fullName === 'string' &&
    typeof profile.email === 'string' &&
    validPhone(profile.contactPhone) &&
    (profile.preferredLanguage === null || supportedLanguage(profile.preferredLanguage))
  );
}
