import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import type { NotificationItem, NotificationPage } from '@mapit/api-client';
import type { FeatureFlagContext } from '@mapit/feature-flags';
import { Subscription } from 'rxjs';
import { NotificationSessionContext } from '../../../core/notification-session-context';
import { NotificationsApi } from '../data/notifications-api';

type Status = 'idle' | 'loading' | 'ready' | 'error';

@Injectable()
export class NotificationsStore {
  private readonly api = inject(NotificationsApi);
  readonly access = inject(NotificationSessionContext);
  private pending = new Subscription();
  private readonly owner = signal<FeatureFlagContext | null>(null);
  private readonly rows = signal<readonly NotificationItem[]>([]);
  private readonly countValue = signal<number | null>(null);
  private readonly pageStatus = signal<Status>('idle');
  private readonly badgeStatus = signal<Status>('idle');
  private readonly writing = signal(false);
  private readonly moreLoading = signal(false);
  private readonly nextCursor = signal<string | null>(null);
  private readonly writeError = signal(false);
  private readonly feedbackValue = signal<'read' | 'all' | null>(null);
  private generation = 0;
  private listVersion = 0;
  private countVersion = 0;
  private listSubscription: Subscription | undefined;
  private countSubscription: Subscription | undefined;
  private readonly visible = computed(
    () => this.owner() !== null && this.access.enabled() && this.owner() === this.access.context(),
  );

  readonly entries = computed(() => (this.visible() ? this.rows() : []));
  readonly unreadCount = computed(() => (this.visible() ? this.countValue() : null));
  readonly status = computed(() => (this.visible() ? this.pageStatus() : 'idle'));
  readonly countStatus = computed(() => (this.visible() ? this.badgeStatus() : 'idle'));
  readonly busy = computed(() => this.visible() && this.writing());
  readonly loadingMore = computed(() => this.visible() && this.moreLoading());
  readonly hasMore = computed(() => this.visible() && this.nextCursor() !== null);
  readonly actionError = computed(() => this.visible() && this.writeError());
  readonly feedback = computed(() => (this.visible() ? this.feedbackValue() : null));

  constructor() {
    effect(() => {
      const context = this.access.context();
      const enabled = this.access.enabled();
      untracked(() => {
        this.reset();
        if (enabled && context) {
          this.owner.set(context);
          this.refreshCount();
        }
      });
    });
    inject(DestroyRef).onDestroy(() => this.reset());
  }

  private reset(): void {
    this.generation++;
    this.pending.unsubscribe();
    this.pending = new Subscription();
    this.owner.set(null);
    this.rows.set([]);
    this.countValue.set(null);
    this.pageStatus.set('idle');
    this.badgeStatus.set('idle');
    this.writing.set(false);
    this.moreLoading.set(false);
    this.nextCursor.set(null);
    this.writeError.set(false);
    this.feedbackValue.set(null);
  }

  private current(context: FeatureFlagContext | null, generation: number): boolean {
    return (
      !!context &&
      context === this.access.context() &&
      this.owner() === context &&
      this.access.enabled() &&
      generation === this.generation
    );
  }

  refresh(): void {
    if (this.busy()) return;
    this.loadFirst();
    this.refreshCount();
  }

  loadFirst(): void {
    if (!this.visible() || this.busy() || this.status() === 'loading') return;
    this.loadPage();
  }

  loadMore(): void {
    if (!this.visible() || this.busy() || this.loadingMore() || this.status() !== 'ready') return;
    const cursor = this.nextCursor();
    if (cursor) this.loadPage(cursor);
  }

  private loadPage(cursor?: string): void {
    const context = this.owner();
    const generation = this.generation;
    const version = ++this.listVersion;
    this.listSubscription?.unsubscribe();
    if (cursor) this.moreLoading.set(true);
    else {
      this.moreLoading.set(false);
      this.pageStatus.set('loading');
      this.rows.set([]);
      this.nextCursor.set(null);
    }
    this.writeError.set(false);
    const fail = () => {
      if (!this.current(context, generation) || version !== this.listVersion) return;
      this.moreLoading.set(false);
      this.pageStatus.set('error');
    };
    this.listSubscription = this.api.list(cursor).subscribe({
      next: (page) => {
        if (!this.current(context, generation) || version !== this.listVersion) return;
        if (!validPage(page) || (cursor && page.hasMore && page.nextCursor === cursor)) {
          fail();
          return;
        }
        const previous = cursor ? this.rows() : [];
        const ids = new Set(previous.map((row) => row.id));
        this.rows.set([
          ...previous,
          ...page.content.filter((row) => {
            if (ids.has(row.id)) return false;
            ids.add(row.id);
            return true;
          }),
        ]);
        this.nextCursor.set(page.hasMore ? (page.nextCursor ?? null) : null);
        this.moreLoading.set(false);
        this.pageStatus.set('ready');
      },
      error: fail,
    });
    this.pending.add(this.listSubscription);
  }

  refreshCount(): void {
    if (!this.visible()) return;
    const context = this.owner();
    const generation = this.generation;
    const version = ++this.countVersion;
    this.countSubscription?.unsubscribe();
    this.badgeStatus.set('loading');
    this.countValue.set(null);
    const fail = () => {
      if (!this.current(context, generation) || version !== this.countVersion) return;
      this.countValue.set(null);
      this.badgeStatus.set('error');
    };
    this.countSubscription = this.api.count().subscribe({
      next: (result) => {
        if (!this.current(context, generation) || version !== this.countVersion) return;
        if (!result || !Number.isSafeInteger(result.unreadCount) || result.unreadCount < 0) {
          fail();
          return;
        }
        this.countValue.set(result.unreadCount);
        this.badgeStatus.set('ready');
      },
      error: fail,
    });
    this.pending.add(this.countSubscription);
  }

  markRead(id: string): void {
    if (!this.visible() || this.busy() || this.status() !== 'ready' || this.loadingMore()) return;
    const row = this.rows().find((item) => item.id === id);
    if (!row || row.readAt !== null) return;
    const context = this.owner();
    const generation = this.generation;
    this.writing.set(true);
    this.writeError.set(false);
    this.feedbackValue.set(null);
    this.pending.add(
      this.api.markRead(id).subscribe({
        next: (result) => {
          if (!this.current(context, generation)) return;
          this.writing.set(false);
          if (
            !result ||
            result.id !== id ||
            !validDate(result.readAt) ||
            Date.parse(result.readAt) < Date.parse(row.createdAt)
          ) {
            this.writeError.set(true);
            return;
          }
          this.rows.update((rows) =>
            rows.map((item) => (item.id === id ? { ...item, readAt: result.readAt } : item)),
          );
          this.feedbackValue.set('read');
          this.refreshCount();
        },
        error: () => {
          if (this.current(context, generation)) {
            this.writing.set(false);
            this.writeError.set(true);
          }
        },
      }),
    );
  }

  markAllRead(): void {
    if (
      !this.visible() ||
      this.busy() ||
      this.status() !== 'ready' ||
      this.loadingMore() ||
      this.countStatus() !== 'ready' ||
      !this.unreadCount()
    )
      return;
    const context = this.owner();
    const generation = this.generation;
    this.writing.set(true);
    this.writeError.set(false);
    this.feedbackValue.set(null);
    this.pending.add(
      this.api.markAllRead().subscribe({
        next: (result) => {
          if (!this.current(context, generation)) return;
          this.writing.set(false);
          if (!result || !Number.isSafeInteger(result.updatedCount) || result.updatedCount < 0) {
            this.writeError.set(true);
            return;
          }
          this.feedbackValue.set('all');
          this.refresh();
        },
        error: () => {
          if (this.current(context, generation)) {
            this.writing.set(false);
            this.writeError.set(true);
          }
        },
      }),
    );
  }
}

function validDate(value: string): boolean {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function validPage(page: NotificationPage): boolean {
  return (
    !!page &&
    Array.isArray(page.content) &&
    page.content.length <= 20 &&
    typeof page.hasMore === 'boolean' &&
    (!page.hasMore ||
      (typeof page.nextCursor === 'string' && /^[A-Za-z0-9_-]{1,2048}$/.test(page.nextCursor))) &&
    page.content.every(
      (row) =>
        !!row &&
        typeof row.id === 'string' &&
        ['RESERVATION_CREATED', 'RESERVATION_CHECKED_IN'].includes(row.type) &&
        validDate(row.createdAt) &&
        validDate(row.occurredAt) &&
        (row.readAt === null || validDate(row.readAt)),
    )
  );
}
