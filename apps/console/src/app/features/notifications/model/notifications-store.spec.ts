import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type {
  NotificationItem,
  NotificationPage,
  NotificationReadResult,
  NotificationMarkAllReadResult,
  NotificationUnreadCount,
} from '@mapit/api-client';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationSessionContext } from '../../../core/notification-session-context';
import { NotificationsApi } from '../data/notifications-api';
import { NotificationsStore } from './notifications-store';

const A = { tenantId: 'tenant-a', userId: 'user-a', sessionId: 'session-a' };
const item = (id = 'notification-1'): NotificationItem => ({
  id,
  type: 'RESERVATION_CREATED',
  category: 'RESERVATIONS',
  establishmentId: 'venue-a',
  reservationId: 'reservation-a',
  occurredAt: '2026-11-01T12:00:00Z',
  createdAt: '2026-11-01T12:00:01Z',
  readAt: null,
});
const page = (content = [item()], nextCursor?: string): NotificationPage => ({
  content,
  hasMore: !!nextCursor,
  ...(nextCursor ? { nextCursor } : {}),
});

describe('NotificationsStore', () => {
  const access = { context: signal<typeof A | null>(A), enabled: signal(true) };
  let lists: Subject<NotificationPage>[];
  let counts: Subject<NotificationUnreadCount>[];
  let read: Subject<NotificationReadResult>;
  let all: Subject<NotificationMarkAllReadResult>;
  const api = { list: vi.fn(), count: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn() };
  let store: NotificationsStore;

  beforeEach(() => {
    vi.clearAllMocks();
    access.context.set(A);
    access.enabled.set(true);
    lists = [];
    counts = [];
    read = new Subject();
    all = new Subject();
    api.list.mockImplementation(() => {
      const subject = new Subject<NotificationPage>();
      lists.push(subject);
      return subject;
    });
    api.count.mockImplementation(() => {
      const subject = new Subject<NotificationUnreadCount>();
      counts.push(subject);
      return subject;
    });
    api.markRead.mockReturnValue(read);
    api.markAllRead.mockReturnValue(all);
    TestBed.configureTestingModule({
      providers: [
        NotificationsStore,
        { provide: NotificationsApi, useValue: api },
        { provide: NotificationSessionContext, useValue: access },
      ],
    });
    store = TestBed.inject(NotificationsStore);
    TestBed.tick();
  });

  it('loads the real transport only on demand, pages by opaque cursor and deduplicates IDs', () => {
    expect(api.list).not.toHaveBeenCalled();
    expect(store.unreadCount()).toBeNull();
    counts[0]!.next({ unreadCount: 2 });
    expect(store.unreadCount()).toBe(2);
    store.loadFirst();
    expect(store.status()).toBe('loading');
    lists[0]!.next(page([item()], 'opaque_cursor'));
    store.loadMore();
    store.loadMore();
    expect(api.list.mock.calls).toEqual([[undefined], ['opaque_cursor']]);
    lists[1]!.next(page([item(), item('second'), item('second')]));
    expect(store.entries().map((row) => row.id)).toEqual(['notification-1', 'second']);
    expect(store.hasMore()).toBe(false);
    expect(store.loadingMore()).toBe(false);
  });

  it('keeps failed HTTP distinct from empty data and rejects malformed responses', () => {
    counts[0]!.error(new Error('404'));
    expect(store.countStatus()).toBe('error');
    expect(store.unreadCount()).toBeNull();
    store.loadFirst();
    lists[0]!.error(new Error('404'));
    expect(store.status()).toBe('error');
    store.refresh();
    lists[1]!.next(page([]));
    expect(store.status()).toBe('ready');
    expect(store.entries()).toEqual([]);
    store.refresh();
    lists[2]!.next({ ...page(), hasMore: true, nextCursor: 'bad cursor!' });
    expect(store.status()).toBe('error');
    counts[2]!.next({ unreadCount: -1 });
    expect(store.countStatus()).toBe('error');
  });

  it.each([
    { ...A, userId: 'user-b' },
    { ...A, tenantId: 'tenant-b' },
    { ...A, sessionId: 'session-b' },
    null,
  ])('hides old data synchronously and discards late results on context change: %j', (next) => {
    store.loadFirst();
    lists[0]!.next(page());
    counts[0]!.next({ unreadCount: 1 });
    store.markRead(item().id);
    store.refreshCount();
    const lateCount = counts.at(-1)!;
    access.context.set(next);
    expect(store.entries()).toEqual([]);
    expect(store.unreadCount()).toBeNull();
    lateCount.next({ unreadCount: 99 });
    read.next({ id: item().id, readAt: '2026-11-02T00:00:00Z' });
    expect(store.entries()).toEqual([]);
    expect(store.feedback()).toBeNull();
    TestBed.tick();
    expect(lateCount.observed).toBe(false);
    expect(read.observed).toBe(false);
    store.markRead(item().id);
    expect(api.markRead).toHaveBeenCalledTimes(1);
  });

  it('does not let a delayed previous page enter a new session', () => {
    store.loadFirst();
    const late = lists[0]!;
    access.context.set({ ...A, sessionId: 'new-session' });
    late.next(page());
    expect(store.entries()).toEqual([]);
    TestBed.tick();
    store.loadFirst();
    lists[1]!.next(page([item('new')]));
    late.next(page());
    expect(store.entries().map((row) => row.id)).toEqual(['new']);
  });

  it('OFF clears data, prevents every request and safely reloads after ON', () => {
    store.loadFirst();
    lists[0]!.next(page());
    access.enabled.set(false);
    expect(store.entries()).toEqual([]);
    TestBed.tick();
    vi.clearAllMocks();
    store.loadFirst();
    store.loadMore();
    store.refresh();
    store.markRead(item().id);
    store.markAllRead();
    expect(api.list).not.toHaveBeenCalled();
    expect(api.count).not.toHaveBeenCalled();
    expect(api.markRead).not.toHaveBeenCalled();
    expect(api.markAllRead).not.toHaveBeenCalled();
    access.enabled.set(true);
    TestBed.tick();
    expect(api.count).toHaveBeenCalledOnce();
    expect(store.status()).toBe('idle');
    store.loadFirst();
    expect(api.list).toHaveBeenCalledOnce();
  });

  it('requires an authenticated context even if a caller reports the flag ON', () => {
    access.context.set(null);
    TestBed.tick();
    vi.clearAllMocks();
    store.refresh();
    store.loadMore();
    store.markRead(item().id);
    store.markAllRead();
    expect(api.list).not.toHaveBeenCalled();
    expect(api.count).not.toHaveBeenCalled();
    expect(api.markRead).not.toHaveBeenCalled();
    expect(api.markAllRead).not.toHaveBeenCalled();
  });

  it('cancels a pending next page on refresh and rejects a non-advancing cursor', () => {
    store.loadFirst();
    lists[0]!.next(page([item()], 'cursor_one'));
    store.loadMore();
    const oldPage = lists[1]!;
    store.refresh();
    expect(oldPage.observed).toBe(false);
    lists[2]!.next(page([item('fresh')], 'cursor_two'));
    expect(store.loadingMore()).toBe(false);
    expect(store.entries()[0]!.id).toBe('fresh');
    store.loadMore();
    lists[3]!.next(page([item('second')], 'cursor_two'));
    expect(store.status()).toBe('error');
    expect(store.entries()).toHaveLength(1);
  });

  it('marks only loaded own items after server acknowledgement and blocks duplicate writes', () => {
    store.loadFirst();
    lists[0]!.next(page());
    store.markRead('foreign');
    expect(api.markRead).not.toHaveBeenCalled();
    store.markRead(item().id);
    store.markRead(item().id);
    expect(api.markRead).toHaveBeenCalledOnce();
    expect(store.entries()[0]!.readAt).toBeNull();
    expect(store.feedback()).toBeNull();
    read.next({ id: item().id, readAt: '2026-11-02T00:00:00Z' });
    expect(store.entries()[0]!.readAt).toBe('2026-11-02T00:00:00Z');
    expect(store.feedback()).toBe('read');
    expect(api.count).toHaveBeenCalledTimes(2);
    store.markRead(item().id);
    expect(api.markRead).toHaveBeenCalledOnce();
  });

  it('never confirms failed or mismatched mutations', () => {
    store.loadFirst();
    lists[0]!.next(page());
    store.markRead(item().id);
    read.next({ id: 'foreign', readAt: '2026-11-02T00:00:00Z' });
    expect(store.actionError()).toBe(true);
    expect(store.entries()[0]!.readAt).toBeNull();
    expect(store.feedback()).toBeNull();
    store.markRead(item().id);
    read.error(new Error('503'));
    expect(store.busy()).toBe(false);
    expect(store.feedback()).toBeNull();
  });

  it('mark-all waits for ACK then reloads canonical data without inventing timestamps or a client cutoff', () => {
    store.loadFirst();
    lists[0]!.next(page());
    counts[0]!.next({ unreadCount: 1 });
    store.markAllRead();
    store.markAllRead();
    expect(api.markAllRead).toHaveBeenCalledOnce();
    expect(store.entries()[0]!.readAt).toBeNull();
    all.next({ updatedCount: 1 });
    expect(store.feedback()).toBe('all');
    expect(store.status()).toBe('loading');
    expect(api.list).toHaveBeenCalledTimes(2);
    lists[1]!.next(page([{ ...item(), readAt: '2026-11-02T00:00:00Z' }]));
    expect(store.entries()[0]!.readAt).toBe('2026-11-02T00:00:00Z');
  });

  it('does not fake success when mark-all fails and rejects malformed counters', () => {
    store.loadFirst();
    lists[0]!.next(page());
    counts[0]!.next({ unreadCount: 1 });
    store.markAllRead();
    all.error(new Error('503'));
    expect(store.actionError()).toBe(true);
    expect(store.feedback()).toBeNull();
    expect(store.entries()[0]!.readAt).toBeNull();
    expect(store.unreadCount()).toBe(1);
    store.refreshCount();
    counts[1]!.next(null as unknown as NotificationUnreadCount);
    expect(store.countStatus()).toBe('error');
    expect(store.unreadCount()).toBeNull();
  });
});
