import { effect, Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  PREVIEW_ESTABLISHMENT_ID,
  PREVIEW_RECEIPT_TOKEN,
  previewReceipt,
  projectReceipt,
} from '@mapit/api-client';
import { EstablishmentContext } from '../../../core/establishment-context';
import { CheckInApi, type CheckInResult } from '../data/check-in-api';
import { CheckInStore } from './check-in-store';

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  return {
    promise: new Promise<T>((done) => {
      resolve = done;
    }),
    resolve: (value) => resolve(value),
  };
}
const RESULT: CheckInResult = {
  receipt: { ...projectReceipt(previewReceipt()), token: PREVIEW_RECEIPT_TOKEN },
  eligibilityError: null,
  audit: null,
};
const A = { id: PREVIEW_ESTABLISHMENT_ID, name: 'Demo', canCheckIn: true };
const B = { id: 'other-establishment', name: 'Other', canCheckIn: true };

describe('CheckInStore', () => {
  const active = signal<typeof A | typeof B | null>(A);
  const status = signal<'idle' | 'loading' | 'ready' | 'error'>('ready');
  const enabled = signal(true);
  const authorized = signal(true);
  const preview = signal(true);
  const lookup = vi.fn(() => Promise.resolve(RESULT));
  const arrive = vi.fn<CheckInApi['arrive']>(() =>
    Promise.resolve({ ...RESULT, receipt: { ...RESULT.receipt, checkIn: 'CHECKED_IN' } }),
  );
  const watch = vi.fn<CheckInApi['watch']>(() => vi.fn());
  const setScenario = vi.fn();
  let watchInjector: Injector;
  let store: CheckInStore;
  beforeEach(() => {
    active.set(A);
    status.set('ready');
    enabled.set(true);
    authorized.set(true);
    preview.set(true);
    vi.clearAllMocks();
    lookup.mockResolvedValue(RESULT);
    TestBed.configureTestingModule({
      providers: [
        CheckInStore,
        { provide: EstablishmentContext, useValue: { active, status } },
        {
          provide: CheckInApi,
          useValue: {
            enabled,
            authorized,
            preview,
            scenario: signal('ready'),
            publicOrigin: () => 'https://public.mapit.test',
            lookup,
            arrive,
            watch,
            setScenario,
          },
        },
      ],
    });
    watchInjector = TestBed.inject(Injector);
    watch.mockImplementation(() => {
      const watchEffect = effect(() => void active(), { injector: watchInjector });
      return vi.fn(() => watchEffect.destroy());
    });
    store = TestBed.inject(CheckInStore);
    TestBed.flushEffects();
  });

  it('uses global active establishment for query and arrival', async () => {
    store.useDemoCode();
    await store.query();
    expect(lookup).toHaveBeenCalledWith(PREVIEW_RECEIPT_TOKEN, PREVIEW_ESTABLISHMENT_ID);
    expect(store.canArrive()).toBe(true);
    await store.arrive();
    expect(arrive).toHaveBeenCalledWith(PREVIEW_RECEIPT_TOKEN, PREVIEW_ESTABLISHMENT_ID);
  });

  it('waits for ready active context and never substitutes the demo ID', async () => {
    status.set('loading');
    TestBed.flushEffects();
    store.useDemoCode();
    await store.query();
    expect(lookup).not.toHaveBeenCalled();
    status.set('ready');
    active.set(B);
    TestBed.flushEffects();
    store.useDemoCode();
    await store.query();
    expect(lookup).toHaveBeenCalledWith(PREVIEW_RECEIPT_TOKEN, B.id);
    expect(store.establishmentId()).toBe(B.id);
  });

  it('cleans the result on context invalidation and drops stale A/B/A response', async () => {
    const pending = deferred<CheckInResult>();
    lookup.mockReturnValueOnce(pending.promise);
    store.useDemoCode();
    const request = store.query();
    active.set(B);
    TestBed.flushEffects();
    active.set(A);
    TestBed.flushEffects();
    pending.resolve(RESULT);
    await request;
    expect(store.result()).toBeNull();
    expect(store.querying()).toBe(false);
  });

  it('requires active check-in capability and prevents duplicate arrivals', async () => {
    store.useDemoCode();
    await store.query();
    const pending = deferred<CheckInResult>();
    arrive.mockReturnValueOnce(pending.promise);
    const request = store.arrive();
    await store.arrive();
    expect(arrive).toHaveBeenCalledOnce();
    expect(store.busy()).toBe(true);
    pending.resolve(RESULT);
    await request;
    expect(store.busy()).toBe(false);
    active.set({ ...A, canCheckIn: false });
    TestBed.flushEffects();
    expect(store.canCheckIn()).toBe(false);
    store.useDemoCode();
    await store.query();
    expect(store.result()).toBeNull();
  });

  it('subscribes to watch only for an authorized active scope and cleans it on change', () => {
    preview.set(false);
    TestBed.flushEffects();
    expect(watch).toHaveBeenCalledWith(A.id, expect.any(Function));
    const cleanup = watch.mock.results[0]?.value as () => void;
    active.set(B);
    TestBed.flushEffects();
    expect(cleanup).toHaveBeenCalledOnce();
    active.set({ ...B, canCheckIn: false });
    TestBed.flushEffects();
    expect(watch).toHaveBeenCalledTimes(2);
  });

  it('keeps the active watch after query and arrival so later events refresh the receipt', async () => {
    preview.set(false);
    TestBed.flushEffects();
    const notify = watch.mock.calls[0]![1];
    store.useDemoCode();
    await store.query();
    notify(null);
    await Promise.resolve();
    expect(lookup).toHaveBeenCalledTimes(2);

    await store.arrive();
    notify(null);
    await Promise.resolve();
    expect(arrive).toHaveBeenCalledOnce();
    expect(lookup).toHaveBeenCalledTimes(3);
  });

  it('ignores callbacks from a prior watch after context leaves and returns to the same ID', async () => {
    preview.set(false);
    TestBed.flushEffects();
    const obsoleteNotify = watch.mock.calls[0]![1];
    active.set(B);
    TestBed.flushEffects();
    active.set(A);
    TestBed.flushEffects();
    store.useDemoCode();
    await store.query();
    obsoleteNotify(null);
    await Promise.resolve();
    expect(lookup).toHaveBeenCalledOnce();
  });

  it('cleans the active watch when authorization is revoked without opening another', () => {
    preview.set(false);
    TestBed.flushEffects();
    const cleanup = watch.mock.results[0]!.value as ReturnType<CheckInApi['watch']>;
    authorized.set(false);
    TestBed.flushEffects();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(watch).toHaveBeenCalledOnce();
  });
});
