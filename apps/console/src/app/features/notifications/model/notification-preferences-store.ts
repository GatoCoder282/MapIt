import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import type { NotificationPreferences } from '@mapit/api-client';
import { Subscription } from 'rxjs';
import { NotificationSessionContext } from '../../../core/notification-session-context';
import { NotificationsApi } from '../data/notifications-api';

@Injectable()
export class NotificationPreferencesStore {
  private readonly api = inject(NotificationsApi);
  private readonly access = inject(NotificationSessionContext);
  private pending = new Subscription();
  private revision = 0;
  private readonly owner = signal(this.access.context());
  private readonly value = signal<NotificationPreferences | null>(null);
  private readonly working = signal(false);
  private readonly problem = signal(false);
  private readonly success = signal(false);
  private readonly draft = signal<NotificationPreferences>({
    reservations: true,
    operations: true,
  });
  readonly available = computed(
    () => this.access.enabled() && this.owner() === this.access.context(),
  );
  readonly preferences = computed(() => (this.available() && this.value() ? this.draft() : null));
  readonly busy = computed(() => this.available() && this.working());
  readonly error = computed(() => this.available() && this.problem());
  readonly saved = computed(() => this.available() && this.success());
  readonly changed = computed(
    () => !!this.preferences() && JSON.stringify(this.value()) !== JSON.stringify(this.draft()),
  );
  constructor() {
    effect(() => {
      const context = this.access.context();
      this.access.enabled();
      untracked(() => {
        this.revision++;
        this.pending.unsubscribe();
        this.pending = new Subscription();
        this.owner.set(context);
        this.value.set(null);
        this.working.set(false);
        this.problem.set(false);
        this.success.set(false);
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.revision++;
      this.pending.unsubscribe();
    });
  }
  load(): void {
    if (!this.available() || this.busy() || this.value()) return;
    this.request(false);
  }
  edit(key: keyof NotificationPreferences, enabled: boolean): void {
    if (!this.preferences() || this.busy()) return;
    this.draft.update((value) => ({ ...value, [key]: enabled }));
    this.success.set(false);
  }
  save(): void {
    if (!this.available() || this.busy() || !this.changed()) return;
    this.request(true);
  }
  private request(save: boolean): void {
    const owner = this.owner(),
      revision = this.revision;
    this.working.set(true);
    this.problem.set(false);
    this.success.set(false);
    const current = () => this.available() && this.owner() === owner && this.revision === revision;
    const fail = () => {
      if (current()) {
        this.working.set(false);
        this.problem.set(true);
      }
    };
    this.pending.add(
      (save ? this.api.updatePreferences(this.draft()) : this.api.preferences()).subscribe({
        next: (value) => {
          if (!current()) return;
          if (
            !value ||
            typeof value.reservations !== 'boolean' ||
            typeof value.operations !== 'boolean'
          ) {
            fail();
            return;
          }
          const canonical = { reservations: value.reservations, operations: value.operations };
          this.value.set(canonical);
          this.draft.set(canonical);
          this.working.set(false);
          this.success.set(save);
        },
        error: fail,
      }),
    );
  }
}
