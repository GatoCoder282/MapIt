import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { NotificationsApi } from './notifications-api';

let api: NotificationsApi;
let http: HttpTestingController;
beforeEach(() => {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  api = TestBed.inject(NotificationsApi);
  http = TestBed.inject(HttpTestingController);
});
afterEach(() => http.verify());

it('uses the generated authenticated-user URLs, an opaque cursor and no arbitrary scope', () => {
  api.list('opaque_cursor').subscribe();
  const list = http.expectOne((request) => request.url.endsWith('/me/notifications'));
  expect(list.request.method).toBe('GET');
  expect(list.request.params.keys().sort()).toEqual(['cursor', 'limit']);
  expect(list.request.params.get('limit')).toBe('20');
  expect(list.request.params.get('cursor')).toBe('opaque_cursor');
  expect(list.request.transferCache).toBe(false);
  list.flush({ content: [], hasMore: false });
  api.count().subscribe();
  const count = http.expectOne((request) => request.url.endsWith('/me/notifications/unread-count'));
  expect(count.request.method).toBe('GET');
  expect(count.request.params.keys()).toEqual([]);
  count.flush({ unreadCount: 0 });
  api.markRead('notification-1').subscribe();
  const read = http.expectOne((request) =>
    request.url.endsWith('/me/notifications/notification-1/read'),
  );
  expect(read.request.method).toBe('PATCH');
  expect(read.request.body).toBeNull();
  read.flush({ id: 'notification-1', readAt: '2026-11-02T00:00:00Z' });
  api.markAllRead().subscribe();
  const all = http.expectOne((request) => request.url.endsWith('/me/notifications/read-all'));
  expect(all.request.method).toBe('PATCH');
  expect(all.request.body).toBeNull();
  expect(all.request.params.keys()).toEqual([]);
  all.flush({ updatedCount: 1 });
});

it('propagates missing HTTP implementation instead of returning fake production data', () => {
  let result: unknown;
  let failure: unknown;
  api
    .list()
    .subscribe({ next: (value) => (result = value), error: (error: unknown) => (failure = error) });
  http
    .expectOne((request) => request.url.endsWith('/me/notifications'))
    .flush({}, { status: 404, statusText: 'Not Found' });
  expect(result).toBeUndefined();
  expect(failure).toBeDefined();
});
