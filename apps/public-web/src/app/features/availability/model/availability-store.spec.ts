import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import type { PublicAvailabilityMap } from '@mapit/api-client';
import { publicMapFixture, verticalProfileFixture } from '../../../core/public-map.fixture';
import { AvailabilityApi } from '../data/availability-api';
import { AvailabilityStore } from './availability-store';

describe('AvailabilityStore — public interval selection', () => {
  let store: AvailabilityStore;
  let api: { map: ReturnType<typeof vi.fn>; profile: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    api = {
      map: vi.fn(() => of(publicMapFixture())),
      profile: vi.fn(() => of(verticalProfileFixture('RESTAURANT'))),
    };
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
  it('loads real floors/sectors and selects one eligible ID without a POST', async () => {
    await store.search();
    expect(api.map).toHaveBeenCalledWith('tenant-a', 'venue-a', '2030-12-24', '19:00', '21:00', '');
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

  describe('por vertical (HU-7.01/7.02 · MAP-234)', () => {
    it('carga el perfil al entrar y nombra el formulario como turno', () => {
      expect(api.profile).toHaveBeenCalledWith('tenant-a', 'venue-a');
      expect(store.terms().startLabel).toBe('Inicio del turno');
      expect(store.hint()).toContain('6 h');
    });

    it('en un hotel pide llegada y salida y usa las horas de check-in/out', async () => {
      const hotel = verticalProfileFixture('HOTEL');
      api.profile.mockReturnValue(of(hotel));
      api.map.mockReturnValue(
        of({
          ...publicMapFixture(),
          establishmentSlug: 'hotel-a',
          startTime: '15:00',
          endDate: '2030-12-26',
          endTime: '12:00',
          vertical: hotel,
        }),
      );
      store.configure('tenant-a', 'hotel-a', '2030-12-24');

      expect(store.stay()).toBe(true);
      expect(store.startTime()).toBe('15:00');
      expect(store.endTime()).toBe('12:00');
      expect(store.endDate()).toBe('2030-12-25');
      expect(store.terms().endDateLabel).toBe('Salida');

      store.setEndDate('2030-12-26');
      await store.search();
      expect(api.map).toHaveBeenCalledWith(
        'tenant-a',
        'hotel-a',
        '2030-12-24',
        '15:00',
        '12:00',
        '2030-12-26',
      );
      expect(store.status()).toBe('loaded');
    });

    it('rechaza en el navegador un turno de restaurante que cruza el día', async () => {
      store.setStartTime('22:00');
      store.setEndTime('01:00');
      await store.search();

      expect(api.map).not.toHaveBeenCalled();
      expect(store.failure()).toContain('mismo día');
    });

    it('acepta en discoteca una salida de madrugada', async () => {
      const night = verticalProfileFixture('NIGHTCLUB');
      api.profile.mockReturnValue(of(night));
      api.map.mockReturnValue(
        of({
          ...publicMapFixture(),
          establishmentSlug: 'club-a',
          startTime: '23:00',
          endDate: '2030-12-25',
          endTime: '04:00',
          vertical: night,
        }),
      );
      store.configure('tenant-a', 'club-a', '2030-12-24', '23:00', '04:00');

      expect(store.intervalValid()).toBe(true);
      await store.search();
      expect(store.status()).toBe('loaded');
    });

    it('con la vertical apagada muestra el plano pero no deja continuar', async () => {
      const off = { ...verticalProfileFixture('RESTAURANT'), enabled: false };
      api.map.mockReturnValue(of({ ...publicMapFixture(), vertical: off }));
      await store.search();
      store.select('space-a');

      expect(store.bookingDisabled()).toBe(true);
      expect(store.canConfirm()).toBe(false);
    });
  });
});
