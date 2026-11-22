import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { IMessage, StompConfig, StompSubscription } from '@stomp/stompjs';
import {
  NOTIFICATION_USER_DESTINATION as DEST,
  parseNotificationInvalidation,
  type NotificationRealtimeSession,
} from './notification-invalidation';
import {
  REALTIME_CONFIG,
  REALTIME_STOMP_CLIENT_FACTORY,
  RealtimeClient,
  type StompClientLike,
} from './realtime';

const A: NotificationRealtimeSession = {
  tenantId: 'tenant-a',
  userId: '00000000-0000-0000-0000-000000000001',
  sessionId: '00000000-0000-0000-0000-000000000002',
};
const notice = {
  eventId: '00000000-0000-0000-0000-000000000003',
  eventType: 'notification.inbox.invalidated.v1',
  schemaVersion: 1,
  occurredAt: '2026-11-22T12:00:00Z',
};
let clients: FakeClient[];
const current = signal<NotificationRealtimeSession | null>(A);
const enabled = signal(true);

class FakeClient implements StompClientLike {
  active = false;
  reconnectDelay = 0;
  connectHeaders: Record<string, string> = {};
  beforeConnect: StompClientLike['beforeConnect'] = () => {};
  onConnect: StompClientLike['onConnect'] = () => {};
  onStompError: StompClientLike['onStompError'] = () => {};
  onWebSocketClose: StompClientLike['onWebSocketClose'] = () => {};
  onWebSocketError: StompClientLike['onWebSocketError'] = () => {};
  callbacks = new Map<string, (message: IMessage) => void>();
  activate() {
    this.active = true;
    this.onConnect({} as never);
  }
  deactivate() {
    this.active = false;
    return Promise.resolve();
  }
  subscribe(destination: string, callback: (message: IMessage) => void): StompSubscription {
    this.callbacks.set(destination, callback);
    return {
      id: destination,
      unsubscribe: () => {
        this.callbacks.delete(destination);
      },
    };
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  current.set(A);
  enabled.set(true);
  clients = [];
  TestBed.configureTestingModule({
    providers: [
      {
        provide: REALTIME_CONFIG,
        useValue: {
          brokerUrl: () => 'ws://localhost/ws',
          accessToken: () => 'jwt',
          enabled,
          notificationSession: current,
          reconnectInitialDelayMs: 10,
        },
      },
      {
        provide: REALTIME_STOMP_CLIENT_FACTORY,
        useValue: (_config: StompConfig) => {
          const client = new FakeClient();
          clients.push(client);
          return client;
        },
      },
    ],
  });
});
afterEach(async () => {
  await TestBed.inject(RealtimeClient).disconnect();
  TestBed.resetTestingModule();
  vi.useRealTimers();
});

it('accepts only the minimal versioned message; rejects malformed/oversized/personal data', () => {
  expect(parseNotificationInvalidation(JSON.stringify(notice))).toEqual(notice);
  for (const value of [
    { ...notice, tenantId: 'tenant-b' },
    { ...notice, eventId: 'bad' },
    { ...notice, schemaVersion: 2 },
    { ...notice, occurredAt: 'bad' },
    null,
    [],
    {},
  ]) {
    expect(parseNotificationInvalidation(JSON.stringify(value))).toBeNull();
  }
  expect(parseNotificationInvalidation('secret-canary invalid JSON')).toBeNull();
  expect(parseNotificationInvalidation(' '.repeat(513))).toBeNull();
});

it('requires an explicit binding and kill switch ON; no default socket or private subscription', () => {
  const client = TestBed.inject(RealtimeClient);
  const errors = vi.fn();
  current.set(null);
  expect(client.canSubscribeNotifications(A)).toBe(false);
  client.subscribeNotificationInvalidations(A).subscribe({ error: errors });
  expect(errors).toHaveBeenCalledOnce();
  expect(clients).toHaveLength(0);
  current.set(A);
  enabled.set(false);
  expect(client.canSubscribeNotifications(A)).toBe(false);
});

it('the existing runtime configuration has no private channel capability by default', () => {
  TestBed.overrideProvider(REALTIME_CONFIG, {
    useValue: {
      brokerUrl: () => 'ws://localhost/ws',
      accessToken: () => 'jwt',
      enabled: () => true,
    },
  });
  const client = TestBed.inject(RealtimeClient);
  const error = vi.fn();
  expect(client.canSubscribeNotifications(A)).toBe(false);
  client.subscribeNotificationInvalidations(A).subscribe({ error });
  expect(error).toHaveBeenCalledOnce();
  expect(clients).toHaveLength(0);
});

it('shares the existing socket, resubscribes after reconnect, and unsubscribes only its own destination', () => {
  const client = TestBed.inject(RealtimeClient);
  const received = vi.fn();
  const room = client.subscribeEstablishment('venue-a').subscribe();
  client.connect();
  const sub = client.subscribeNotificationInvalidations(A).subscribe(received);
  expect(clients).toHaveLength(1);
  expect(clients[0]!.callbacks.has(DEST)).toBe(true);
  clients[0]!.callbacks.get(DEST)!({ body: JSON.stringify(notice) } as IMessage);
  expect(received).toHaveBeenCalledWith(notice);
  const old = clients[0]!.callbacks.get(DEST)!;
  clients[0]!.active = false;
  clients[0]!.onWebSocketClose({});
  vi.advanceTimersByTime(10);
  expect(clients).toHaveLength(2);
  expect(clients[1]!.callbacks.has(DEST)).toBe(true);
  old({ body: JSON.stringify(notice) } as IMessage);
  expect(received).toHaveBeenCalledOnce();
  sub.unsubscribe();
  expect(clients[1]!.callbacks.has(DEST)).toBe(false);
  expect(clients[1]!.callbacks.has('/topic/establishments/venue-a')).toBe(true);
  expect(clients[1]!.active).toBe(true);
  room.unsubscribe();
});

it('discards old-session callbacks immediately and never subscribes a new identity on the old socket', async () => {
  const client = TestBed.inject(RealtimeClient);
  const received = vi.fn();
  const sub = client.subscribeNotificationInvalidations(A).subscribe(received);
  const late = clients[0]!.callbacks.get(DEST)!;
  const B = { ...A, tenantId: 'tenant-b', sessionId: '00000000-0000-0000-0000-000000000004' };
  current.set(B);
  late({ body: JSON.stringify(notice) } as IMessage);
  expect(received).not.toHaveBeenCalled();
  sub.unsubscribe();
  const next = client.subscribeNotificationInvalidations(B).subscribe(received);
  expect(clients[0]!.callbacks.has(DEST)).toBe(false);
  clients[0]!.active = false;
  clients[0]!.onWebSocketClose({});
  await Promise.resolve();
  await Promise.resolve();
  clients[1]!.callbacks.get(DEST)!({ body: JSON.stringify(notice) } as IMessage);
  expect(received).toHaveBeenCalledOnce();
  current.set(null);
  clients[1]!.callbacks.get(DEST)!({ body: JSON.stringify(notice) } as IMessage);
  expect(received).toHaveBeenCalledOnce();
  next.unsubscribe();
});

it('does not expose invalid message content or route operational data through the private channel', () => {
  const client = TestBed.inject(RealtimeClient);
  const received = vi.fn();
  const errors: unknown[] = [];
  client.errors.subscribe((error) => errors.push(error));
  client.subscribeNotificationInvalidations(A).subscribe(received);
  clients[0]!.callbacks.get(DEST)!({ body: 'secret-canary invalid JSON' } as IMessage);
  expect(received).not.toHaveBeenCalled();
  expect(errors).toHaveLength(1);
  expect(String(errors[0])).not.toContain('secret-canary');
});

it('rebinds the shared transport on identity change and discards late callbacks from the old socket', async () => {
  const client = TestBed.inject(RealtimeClient);
  TestBed.tick();
  const oldEvents = vi.fn();
  client.subscribeNotificationInvalidations(A).subscribe(oldEvents);
  const old = clients[0]!;
  const late = old.callbacks.get(DEST)!;
  const B = {
    ...A,
    userId: '00000000-0000-0000-0000-000000000010',
    sessionId: '00000000-0000-0000-0000-000000000011',
  };
  current.set(B);
  const fresh = vi.fn();
  client.subscribeNotificationInvalidations(B).subscribe(fresh);
  TestBed.tick();
  await Promise.resolve();
  await Promise.resolve();
  expect(old.active).toBe(false);
  expect(clients).toHaveLength(2);
  old.onWebSocketClose({});
  late({ body: JSON.stringify(notice) } as IMessage);
  clients[1]!.callbacks.get(DEST)!({ body: JSON.stringify(notice) } as IMessage);
  expect(oldEvents).not.toHaveBeenCalled();
  expect(fresh).toHaveBeenCalledOnce();
  expect(client.connectionState()).toBe('connected');
});
