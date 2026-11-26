import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { beforeEach, expect, it, vi } from 'vitest';
import type { NotificationPreferences } from '@mapit/api-client';
import { NotificationSessionContext } from '../../../core/notification-session-context';
import { NotificationsApi } from '../data/notifications-api';
import { NotificationPreferencesStore } from './notification-preferences-store';
const A = { tenantId: 'tenant-a', userId: 'a', sessionId: 'session-a' };
const access = { context: signal<typeof A | null>(A), enabled: signal(true) };
let response: Subject<NotificationPreferences>, saved: Subject<NotificationPreferences>;
const api = { preferences: vi.fn(), updatePreferences: vi.fn() };
beforeEach(() => {
  vi.clearAllMocks();
  access.context.set(A);
  access.enabled.set(true);
  response = new Subject();
  saved = new Subject();
  api.preferences.mockReturnValue(response);
  api.updatePreferences.mockReturnValue(saved);
  TestBed.configureTestingModule({
    providers: [
      NotificationPreferencesStore,
      { provide: NotificationsApi, useValue: api },
      { provide: NotificationSessionContext, useValue: access },
    ],
  });
});
function store() {
  const vm = TestBed.inject(NotificationPreferencesStore);
  TestBed.tick();
  return vm;
}
it('loads real transport values and saves only after a valid ACK; blocks duplicate requests', () => {
  const vm = store();
  vm.load();
  expect(vm.busy()).toBe(true);
  vm.load();
  expect(api.preferences).toHaveBeenCalledTimes(1);
  response.next({ reservations: true, operations: false });
  vm.edit('reservations', false);
  vm.save();
  vm.save();
  expect(api.updatePreferences).toHaveBeenCalledExactlyOnceWith({
    reservations: false,
    operations: false,
  });
  expect(vm.saved()).toBe(false);
  saved.next({ reservations: false, operations: false });
  expect(vm.saved()).toBe(true);
  expect(vm.changed()).toBe(false);
});
it('OFF does not request and immediately hides preferences', () => {
  const vm = store();
  access.enabled.set(false);
  vm.load();
  expect(api.preferences).not.toHaveBeenCalled();
  expect(vm.preferences()).toBeNull();
});
it('failure is retryable and never reports saved', () => {
  const vm = store();
  vm.load();
  response.error(new Error('network'));
  expect(vm.error()).toBe(true);
  expect(vm.saved()).toBe(false);
  response = new Subject();
  api.preferences.mockReturnValue(response);
  vm.load();
  response.next({ reservations: false, operations: true });
  expect(vm.preferences()?.reservations).toBe(false);
  expect(vm.error()).toBe(false);
});
it('identity change cancels old requests and never applies old values', () => {
  const vm = store();
  vm.load();
  access.context.set({ ...A, userId: 'b', sessionId: 'session-b' });
  expect(vm.preferences()).toBeNull();
  TestBed.tick();
  response.next({ reservations: false, operations: false });
  expect(vm.preferences()).toBeNull();
  expect(response.observed).toBe(false);
  const fresh = new Subject<NotificationPreferences>();
  api.preferences.mockReturnValue(fresh);
  vm.load();
  fresh.next({ reservations: true, operations: true });
  expect(vm.preferences()?.operations).toBe(true);
});
it('rejects malformed responses and does not optimistically confirm writes', () => {
  const vm = store();
  vm.load();
  response.next({ reservations: true, operations: true });
  vm.edit('operations', false);
  vm.save();
  saved.next({ reservations: true, operations: null } as unknown as NotificationPreferences);
  expect(vm.error()).toBe(true);
  expect(vm.saved()).toBe(false);
  expect(vm.changed()).toBe(true);
});
