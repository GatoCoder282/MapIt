import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthSession } from '@mapit/auth';
import { FeatureFlagService, provideFeatureFlags } from '@mapit/feature-flags';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NotificationSessionContext } from './notification-session-context';

const fetchMock = vi.fn<typeof fetch>();
const response = () =>
  new Response(
    JSON.stringify({ toggles: [{ name: 'mapit.s6.notification-center', enabled: true }] }),
  );
const login = (tenantId = 'tenant-a', id = '00000000-0000-0000-0000-000000000001') => ({
  accessToken: 'header.payload.signature',
  tokenType: 'Bearer' as const,
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  user: { tenantId, id, email: 'staff@example.com', fullName: 'Staff', role: 'STAFF' as const },
});
const settle = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  sessionStorage.clear();
  fetchMock.mockReset().mockImplementation(() => Promise.resolve(response()));
  vi.stubGlobal('fetch', fetchMock);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideFeatureFlags({ proxyUrl: 'https://flags.example/proxy', intervaloRefrescoMs: 1000 }),
    ],
  });
  vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
});
afterEach(() => {
  TestBed.resetTestingModule();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

it('binds real AuthSession, rotates the nonce for same-account login and clears ON synchronously', async () => {
  const session = TestBed.inject(AuthSession);
  const context = TestBed.inject(NotificationSessionContext);
  TestBed.tick();
  await settle();
  expect(context.enabled()).toBe(false);
  session.start(login(), false);
  TestBed.tick();
  await settle();
  expect(context.enabled()).toBe(true);
  const old = context.context()!;
  expect(old).toMatchObject({ tenantId: 'tenant-a', userId: login().user.id });
  expect(old.sessionId).not.toContain('header.payload.signature');
  session.start(login(), false);
  expect(context.context()!.sessionId).not.toBe(old.sessionId);
  expect(context.enabled()).toBe(false);
  TestBed.tick();
  await settle();
  expect(context.enabled()).toBe(true);
  session.logout();
  expect(context.context()).toBeNull();
  expect(context.enabled()).toBe(false);
  TestBed.tick();
  expect(TestBed.inject(FeatureFlagService).isEnabledNow('mapit.s6.notification-center')).toBe(
    false,
  );
  expect(JSON.stringify(fetchMock.mock.calls)).not.toContain('header.payload.signature');
});

it('fails closed without a secure source for the per-session nonce', async () => {
  vi.stubGlobal('crypto', {});
  const session = TestBed.inject(AuthSession);
  const context = TestBed.inject(NotificationSessionContext);
  session.start(login(), false);
  TestBed.tick();
  await settle();
  expect(context.context()).toBeNull();
  expect(context.enabled()).toBe(false);
});

it('discards an old asynchronous ON after tenant/user change, closes on provider error and recovers safely', async () => {
  const session = TestBed.inject(AuthSession);
  const context = TestBed.inject(NotificationSessionContext);
  TestBed.tick();
  await settle();
  let resolveOld!: (response: Response) => void;
  fetchMock.mockImplementationOnce(
    () => new Promise<Response>((resolve) => (resolveOld = resolve)),
  );
  session.start(login(), false);
  TestBed.tick();
  session.start(login('tenant-b', '00000000-0000-0000-0000-000000000002'), false);
  expect(context.enabled()).toBe(false);
  fetchMock.mockRejectedValue(new Error('provider unavailable'));
  TestBed.tick();
  await settle();
  resolveOld(response());
  await settle();
  expect(context.context()?.tenantId).toBe('tenant-b');
  expect(context.enabled()).toBe(false);
  fetchMock.mockImplementation(() => Promise.resolve(response()));
  await vi.advanceTimersByTimeAsync(1000);
  expect(context.enabled()).toBe(true);
  const input = fetchMock.mock.calls.at(-1)![0];
  if (typeof input !== 'string') throw new Error('Expected proxy URL');
  const url = new URL(input);
  expect(url.searchParams.get('properties[tenantId]')).toBe('tenant-b');
});
