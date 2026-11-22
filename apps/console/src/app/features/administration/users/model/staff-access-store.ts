import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import type { AccessibleEstablishment, TenantUser } from '@mapit/api-client';
import { AuthSession } from '@mapit/auth';
import { firstValueFrom } from 'rxjs';

import { STRINGS } from '../../../../core/strings';
import { StaffAccessApi } from '../data/staff-access-api';

type Assignment = {
  establishment: AccessibleEstablishment;
  granted: boolean;
  desired: boolean;
};

@Injectable()
export class StaffAccessStore {
  private readonly api = inject(StaffAccessApi);
  private readonly session = inject(AuthSession);
  private readonly destroyRef = inject(DestroyRef);
  private generation = 0;
  private userId: string | null = null;

  readonly status = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly assignments = signal<readonly Assignment[]>([]);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly feedback = signal('');
  readonly canSave = computed(
    () =>
      this.status() === 'ready' &&
      !this.saving() &&
      this.assignments().some(({ granted, desired }) => granted !== desired),
  );
  readonly pendingCount = computed(
    () => this.assignments().filter(({ granted, desired }) => granted !== desired).length,
  );

  constructor() {
    this.destroyRef.onDestroy(() => this.generation++);
  }

  canManage(user: TenantUser): boolean {
    return this.session.user()?.role === 'ADMIN' && user.active && user.role === 'STAFF';
  }

  async load(user: TenantUser): Promise<void> {
    const generation = ++this.generation;
    this.userId = user.id;
    this.assignments.set([]);
    this.error.set('');
    this.feedback.set('');
    if (!this.canManage(user)) {
      this.status.set('idle');
      return;
    }
    this.status.set('loading');
    try {
      const establishments = await firstValueFrom(this.api.establishments());
      const access = await Promise.all(
        establishments.map((establishment) => firstValueFrom(this.api.staff(establishment.id))),
      );
      if (!this.isCurrent(user, generation)) return;
      this.assignments.set(
        establishments.map((establishment, index) => {
          const granted =
            access[index]?.find((entry) => entry.userId === user.id)?.canCheckIn ?? false;
          return { establishment, granted, desired: granted };
        }),
      );
      this.status.set('ready');
    } catch {
      if (!this.isCurrent(user, generation)) return;
      this.status.set('error');
      this.error.set(STRINGS.users.staffAccess.loadError);
    }
  }

  toggle(establishmentId: string): void {
    if (this.status() !== 'ready' || this.saving()) return;
    this.error.set('');
    this.feedback.set('');
    this.assignments.update((items) =>
      items.map((item) =>
        item.establishment.id === establishmentId ? { ...item, desired: !item.desired } : item,
      ),
    );
  }

  async save(user: TenantUser): Promise<void> {
    if (!this.canManage(user) || user.id !== this.userId || !this.canSave()) return;
    const generation = this.generation;
    const changes = this.assignments().filter(({ granted, desired }) => granted !== desired);
    this.saving.set(true);
    this.error.set('');
    this.feedback.set('');
    try {
      const results = await Promise.allSettled(
        changes.map((item) =>
          firstValueFrom(this.api.save(item.establishment.id, user.id, item.desired)),
        ),
      );
      if (!this.isCurrent(user, generation)) return;
      const failed = results.filter((result) => result.status === 'rejected').length;
      const refreshGeneration = this.generation + 1;
      await this.load(user);
      if (!this.isCurrent(user, refreshGeneration)) return;
      if (this.status() !== 'ready') {
        this.error.set(STRINGS.users.staffAccess.verifyError);
      } else if (
        failed === 0 &&
        changes.every(
          (change) =>
            this.assignments().find((item) => item.establishment.id === change.establishment.id)
              ?.granted === change.desired,
        )
      ) {
        this.feedback.set(STRINGS.users.staffAccess.saved);
      } else {
        this.error.set(
          failed === results.length
            ? STRINGS.users.staffAccess.saveError
            : STRINGS.users.staffAccess.partialError,
        );
      }
    } finally {
      this.saving.set(false);
    }
  }

  private isCurrent(user: TenantUser, generation: number): boolean {
    return (
      !this.destroyRef.destroyed &&
      this.generation === generation &&
      this.userId === user.id &&
      this.canManage(user)
    );
  }
}
