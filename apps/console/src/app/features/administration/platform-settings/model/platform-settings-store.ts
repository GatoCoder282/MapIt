import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type {
  PlatformSetting,
  PlatformSettingChange,
  PlatformSettingsOverview,
} from '@mapit/api-client';
import { forkJoin } from 'rxjs';
import { PlatformSettingsApi } from '../data/platform-settings-api';

export type PlatformSettingsStatus = 'loading' | 'loaded' | 'disabled' | 'error';
export type PlatformSettingsNotice = 'saved' | 'conflict' | 'invalid' | 'failed' | null;

/** Cambio preparado, a la espera de confirmación. `value` nulo = restaurar el del despliegue. */
export interface PendingChange {
  readonly setting: PlatformSetting;
  readonly value: number | null;
  readonly reason: string;
}

const MIN_REASON = 10;

/** ViewModel de la configuración de plataforma (HU-7.07). */
@Injectable()
export class PlatformSettingsStore {
  private readonly api = inject(PlatformSettingsApi);
  private readonly destroyRef = inject(DestroyRef);
  private request = 0;

  readonly status = signal<PlatformSettingsStatus>('loading');
  readonly overview = signal<PlatformSettingsOverview | null>(null);
  readonly changes = signal<PlatformSettingChange[]>([]);
  readonly editingKey = signal<string | null>(null);
  readonly draft = signal('');
  readonly reason = signal('');
  readonly pending = signal<PendingChange | null>(null);
  readonly saving = signal(false);
  readonly notice = signal<PlatformSettingsNotice>(null);

  readonly editing = computed(
    () => this.overview()?.settings.find((item) => item.key === this.editingKey()) ?? null,
  );
  private readonly reasonValid = computed(() => this.reason().trim().length >= MIN_REASON);
  readonly draftValid = computed(() => {
    const setting = this.editing();
    const value = Number(this.draft());
    return (
      !!setting &&
      this.draft().trim() !== '' &&
      Number.isInteger(value) &&
      value >= setting.min &&
      value <= setting.max
    );
  });
  readonly canReview = computed(
    () => this.draftValid() && this.reasonValid() && Number(this.draft()) !== this.editing()?.value,
  );
  readonly canRestore = computed(() => !!this.editing()?.overridden && this.reasonValid());

  load(): void {
    const current = ++this.request;
    this.status.set('loading');
    forkJoin({ overview: this.api.overview(), changes: this.api.changes() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ overview, changes }) => {
          if (current !== this.request) return;
          this.overview.set(overview);
          this.changes.set(changes);
          this.status.set('loaded');
        },
        error: (error: unknown) => {
          if (current !== this.request) return;
          // 404: la flag mapit.s6.platform-settings está apagada.
          this.status.set(
            error instanceof HttpErrorResponse && error.status === 404 ? 'disabled' : 'error',
          );
        },
      });
  }

  edit(setting: PlatformSetting): void {
    this.editingKey.set(setting.key);
    this.draft.set(String(setting.value));
    this.reason.set('');
    this.pending.set(null);
    this.notice.set(null);
  }

  cancel(): void {
    if (this.saving()) return;
    this.editingKey.set(null);
    this.pending.set(null);
  }

  review(): void {
    const setting = this.editing();
    if (setting && this.canReview()) {
      this.pending.set({ setting, value: Number(this.draft()), reason: this.reason().trim() });
    }
  }

  reviewRestore(): void {
    const setting = this.editing();
    if (setting && this.canRestore()) {
      this.pending.set({ setting, value: null, reason: this.reason().trim() });
    }
  }

  back(): void {
    if (!this.saving()) this.pending.set(null);
  }

  confirm(): void {
    const pending = this.pending();
    if (!pending || this.saving()) return;
    this.saving.set(true);
    this.notice.set(null);
    this.api
      .change(pending.setting.key, pending.value, pending.setting.value, pending.reason)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.finish('saved'),
        error: (error: unknown) => {
          const status = error instanceof HttpErrorResponse ? error.status : 0;
          this.finish(status === 409 ? 'conflict' : status === 400 ? 'invalid' : 'failed');
        },
      });
  }

  private finish(notice: PlatformSettingsNotice): void {
    this.saving.set(false);
    this.pending.set(null);
    this.notice.set(notice);
    // Tras guardar o chocar con otro cambio se recarga el valor vigente.
    if (notice === 'saved' || notice === 'conflict') {
      this.editingKey.set(null);
      this.load();
    }
  }
}
