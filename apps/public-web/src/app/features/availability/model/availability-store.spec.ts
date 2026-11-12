import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import type { PublicAvailabilityMap } from '@mapit/api-client';
import { publicMapFixture } from '../../../core/public-map.fixture';
import { AvailabilityApi } from '../data/availability-api';
import { AvailabilityStore } from './availability-store';

describe('AvailabilityStore — public interval selection', () => {
  let store: AvailabilityStore;
  let api: { map: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    api = { map: vi.fn(() => of(publicMapFixture())) };
    TestBed.configureTestingModule({
      providers: [AvailabilityStore, { provide: AvailabilityApi, useValue: api }],
    });
    store = TestBed.inject(AvailabilityStore);
    store.configure('tenant-a', 'venue-a', '2030-12-24', '19:00', '21:00');
  });
  afterEach(() => TestBed.resetTestingModule());

  it('requires the interval before requesting or selecting; no hidden hours', async () => {
    store.setStartTime('');
    await store.search();
    store.select('space-a');
    expect(api.map).not.toHaveBeenCalled();
    expect(store.canConfirm()).toBe(false);
    expect(store.failure()).toBeTruthy();
  });
  it('builds a leap-month calendar and moves across the year without changing the interval', () => {
    store.setDate('2028-02-29');
    const days = store.calendarDays().filter((day) => day !== null);
    expect(days).toHaveLength(29);
    expect(days.at(-1)?.value).toBe('2028-02-29');
    expect(store.weekdays()).toHaveLength(7);
    expect(store.startTime()).toBe('19:00');
    expect(store.endTime()).toBe('21:00');
    store.setDate('2031-01-05');
    store.moveMonth(-1);
    expect(store.calendarDays().find((day) => day)?.value).toBe('2030-12-01');
    store.setDate('invalid');
    expect(store.calendarDays().find((day) => day)?.value).toBe('2030-12-01');
  });
  it('counts only selectable available spaces across the establishment', async () => {
    await store.search();
    expect(store.availableCount()).toBe(3);
    store.selectSector('sector-b');
    expect(store.availableCount()).toBe(3);
    store.setStartTime('20:00');
    expect(store.availableCount()).toBe(0);
  });
  it('restores a chosen space in its sector after loading the interval', async () => {
    await store.search('space-c');
    expect(store.floorId()).toBe('floor-a');
    expect(store.sectorId()).toBe('sector-b');
    expect(store.selectedElementId()).toBe('space-c');
    expect(store.canConfirm()).toBe(true);
  });
  it.each(['reserved', 'unavailable', 'unknown'])(
    'does not restore an ineligible URL space: %s',
    async (id) => {
      await store.search(id);
      expect(store.selectedElementId()).toBeNull();
      expect(store.canConfirm()).toBe(false);
      expect(store.failure()).toBeTruthy();
      store.restoreSelection('space-a');
      expect(store.failure()).toBe('');
      expect(store.canConfirm()).toBe(true);
    },
  );
  it('does not restore a selection from a cancelled lookup', async () => {
    const late = new Subject<PublicAvailabilityMap>();
    api.map.mockReturnValue(late);
    const request = store.search('space-a');
    store.setEndTime('22:00');
    late.next(publicMapFixture());
    late.complete();
    await request;
    expect(store.response()).toBeNull();
    expect(store.selectedElementId()).toBeNull();
  });
  it('accepts a party preference only within the supported range', () => {
    store.configure('tenant-a', 'venue-a', '2030-12-24', '', '', '4');
    expect(store.people()).toBe(4);
    for (const people of ['0', '-1', '21', '2.5', 'invalid']) {
      store.configure('tenant-a', 'venue-a', '2030-12-24', '', '', people);
      expect(store.people()).toBeNull();
    }
  });
  it('updates the party preference without losing the chosen interval', async () => {
    await store.search();
    store.setPeople('6');
    expect(store.people()).toBe(6);
    expect(store.response()).not.toBeNull();
    expect(store.startTime()).toBe('19:00');
    for (const value of ['', '0', '21', '2.5']) {
      store.setPeople(value);
      expect(store.people()).toBeNull();
    }
  });
  it('loads real floors/sectors and selects one eligible ID without a POST', async () => {
    await store.search();
    expect(api.map).toHaveBeenCalledWith('tenant-a', 'venue-a', '2030-12-24', '19:00', '21:00');
    expect(store.floor()?.name).toBe('Planta baja');
    expect(store.sector()?.name).toBe('Salón');
    store.select('space-a');
    expect(store.selectedSpace()?.name).toBe('Habitación sin nombre');
    expect(store.canConfirm()).toBe(true);
  });
  it.each(['reserved', 'unavailable', 'unknown'])('rejects %s from list or map', async (id) => {
    await store.search();
    store.select(id);
    expect(store.selectedElementId()).toBeNull();
    expect(store.canConfirm()).toBe(false);
  });
  it('rejects reserved even if a malformed projection marks it selectable', async () => {
    const data = publicMapFixture();
    data.floors[0]!.sectors[0]!.elements[2]!.selectable = true;
    api.map.mockReturnValue(of(data));
    await store.search();
    store.select('reserved');
    expect(store.canConfirm()).toBe(false);
  });
  it('clears selection on sector/floor/interval/scope change, not when choosing the same sector', async () => {
    await store.search();
    store.select('space-a');
    store.selectSector('sector-a');
    expect(store.selectedElementId()).toBe('space-a');
    store.selectSector('sector-b');
    expect(store.selectedElementId()).toBeNull();
    store.select('space-c');
    store.selectFloor('floor-b');
    expect(store.selectedElementId()).toBeNull();
    store.setEndTime('22:00');
    expect(store.response()).toBeNull();
    store.configure('tenant-a', 'venue-b', '2030-12-24', '19:00', '21:00');
    expect(store.response()).toBeNull();
  });
  it('does not revive a selection from a response invalidated by changing time', async () => {
    const late = new Subject<PublicAvailabilityMap>();
    api.map.mockReturnValue(late);
    const request = store.search();
    store.setStartTime('20:00');
    late.next(publicMapFixture());
    late.complete();
    await request;
    expect(store.response()).toBeNull();
    expect(store.status()).toBe('idle');
  });
  it('fails closed for another scope, wrong interval or daily response', async () => {
    for (const changed of [
      { establishmentSlug: 'other' },
      { startTime: '18:00' },
      { mode: 'DAY' as const },
    ]) {
      api.map.mockReturnValue(of({ ...publicMapFixture(), ...changed }));
      await store.search();
      expect(store.response()).toBeNull();
      expect(store.canConfirm()).toBe(false);
    }
  });
  it('clears old geometry on HTTP error', async () => {
    await store.search();
    api.map.mockReturnValue(throwError(() => new Error('offline')));
    await store.search();
    expect(store.status()).toBe('error');
    expect(store.response()).toBeNull();
  });

  it('keeps the last result when the URL is synchronized to the queried interval', async () => {
    store.setEndTime('22:00');
    api.map.mockReturnValue(of({ ...publicMapFixture(), endTime: '22:00' }));
    await store.search();
    store.select('space-a');
    store.configure('tenant-a', 'venue-a', '2030-12-24', '19:00', '22:00');
    expect(store.canConfirm()).toBe(true);
  });
});
