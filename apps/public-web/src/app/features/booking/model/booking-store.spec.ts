import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { PublicAvailabilityMap, PublicReservation, PublicCheckout } from '@mapit/api-client';
import { of, throwError, Subject } from 'rxjs';
import { publicMapFixture } from '../../../core/public-map.fixture';
import { BookingApi } from '../data/booking-api';
import { BookingStore } from './booking-store';

describe('BookingStore — resolved selection before customer data', () => {
  const reservation: PublicReservation = {
    accessToken: 'a'.repeat(43),
    accessExpiresAt: '2099-10-25T12:00:00Z',
    id: 'reservation-a',
    establishmentId: 'venue-id',
    spaceElementIds: new Set(['space-a']),
    date: '2030-12-24',
    startTime: '19:00',
    endTime: '21:00',
    startsAt: '2030-12-24T23:00:00Z',
    endsAt: '2030-12-25T01:00:00Z',
    timezone: 'America/La_Paz',
    status: 'CREATED',
    createdAt: '2030-12-01T00:00:00Z',
  };
  const checkout = (): PublicCheckout => ({
    reservation: {
      id: reservation.id,
      establishmentId: 'venue-id',
      establishmentName: 'Local de prueba',
      tenantSlug: 'tenant-a',
      establishmentSlug: 'venue-a',
      startsAt: reservation.startsAt,
      endsAt: reservation.endsAt,
      timezone: reservation.timezone,
      status: 'CREATED',
      spaces: [
        {
          id: 'space-a',
          name: 'Nombre vigente',
          floor: 'Planta baja',
          sector: 'Salón',
          state: 'RESERVED',
          type: 'ROOM',
          label: 'Nombre vigente',
          capacity: null,
          x: 120,
          y: 60,
        },
      ],
    },
    available: false,
    unavailableReason: 'PAYMENT_POLICY_DISABLED',
    amount: null,
    currency: null,
    totalAmount: null,
    paidAmount: '0',
    balanceAmount: null,
    payment: null,
    historicalMethod: null,
    methods: [],
  });
  let api: {
    create: ReturnType<typeof vi.fn>;
    map: ReturnType<typeof vi.fn>;
    checkout: ReturnType<typeof vi.fn>;
  };
  let store: BookingStore;
  const configure = () =>
    store.configure('tenant-a', 'venue-a', 'space-a', '2030-12-24', '19:00', '21:00');
  beforeEach(() => {
    api = {
      create: vi.fn(() => of(reservation)),
      map: vi.fn(() => of(publicMapFixture())),
      checkout: vi.fn(() => of(checkout())),
    };
    TestBed.configureTestingModule({
      providers: [BookingStore, { provide: BookingApi, useValue: api }],
    });
    store = TestBed.inject(BookingStore);
  });
  afterEach(() => TestBed.resetTestingModule());
  const fill = () => {
    store.setFullName('Ana Pérez');
    store.setEmail('ana@example.com');
    store.setPhone('+591 70000000');
  };
  const ready = async () => {
    await configure();
    store.confirm();
    fill();
  };

  it('reload resolves the canonical descriptor before explicit confirmation; no POST on GET', async () => {
    await configure();
    expect(store.descriptor()?.name).toBe('Habitación sin nombre');
    expect(store.step()).toBe('confirm');
    expect(api.create).not.toHaveBeenCalled();
    store.confirm();
    expect(store.step()).toBe('details');
  });
  it('legacy URL without hours requests an interval and never assumes 19–21', async () => {
    await store.configure('tenant-a', 'venue-a', 'space-a', '2030-12-24');
    expect(store.startTime()).toBe('');
    expect(store.endTime()).toBe('');
    expect(store.canConfirm()).toBe(false);
    expect(api.map).not.toHaveBeenCalled();
    fill();
    await store.submit();
    expect(api.create).not.toHaveBeenCalled();
  });
  it('submit rechecks the server then creates once; own descriptor uses checkout, not own RESERVED map', async () => {
    await ready();
    await store.submit();
    expect(api.map).toHaveBeenCalledTimes(2);
    expect(api.create).toHaveBeenCalledWith('tenant-a', 'venue-a', {
      date: '2030-12-24',
      startTime: '19:00',
      endTime: '21:00',
      spaceElementIds: new Set(['space-a']),
      customer: { fullName: 'Ana Pérez', email: 'ana@example.com', phone: '+591 70000000' },
    });
    expect(store.status()).toBe('success');
    expect(store.ownReservation()?.spaces[0]?.name).toBe('Nombre vigente');
    expect(api.checkout).toHaveBeenCalledOnce();
    expect(store.checkoutPath()).toContain(reservation.id);
    await store.submit();
    expect(api.create).toHaveBeenCalledOnce();
  });
  it.each(['RESERVED', 'UNAVAILABLE'] as const)(
    'rejects %s including a forged selectable flag',
    async (availability) => {
      const data = publicMapFixture();
      data.floors[0]!.sectors[0]!.elements[0]!.availability = availability;
      api.map.mockReturnValue(of(data));
      await configure();
      store.confirm();
      fill();
      await store.submit();
      expect(store.canConfirm()).toBe(false);
      expect(api.create).not.toHaveBeenCalled();
    },
  );
  it('fails closed for another establishment returned by the map', async () => {
    api.map.mockReturnValue(of({ ...publicMapFixture(), establishmentSlug: 'other' }));
    await configure();
    expect(store.descriptor()).toBeNull();
    expect(store.canConfirm()).toBe(false);
  });
  it('invalid customer data never creates a reservation', async () => {
    await configure();
    store.confirm();
    store.setFullName('A');
    store.setEmail('invalid');
    await store.submit();
    expect(store.fullNameError()).toBeTruthy();
    expect(store.emailError()).toBeTruthy();
    expect(api.create).not.toHaveBeenCalled();
  });
  it('409 re-queries and returns to selection, preserving customer data only in memory', async () => {
    await ready();
    api.create.mockImplementation(() => {
      const occupied = publicMapFixture();
      occupied.floors[0]!.sectors[0]!.elements[0]!.availability = 'RESERVED';
      occupied.floors[0]!.sectors[0]!.elements[0]!.selectable = false;
      api.map.mockReturnValue(of(occupied));
      return throwError(() => new HttpErrorResponse({ status: 409 }));
    });
    await store.submit();
    expect(store.step()).toBe('confirm');
    expect(store.errorMessage()).toContain('ya no está disponible');
    expect(store.reservation()).toBeNull();
    expect(store.canConfirm()).toBe(false);
    expect(store.fullName()).toBe('Ana Pérez');
    expect(store.email()).toBe('ana@example.com');
    expect(api.map).toHaveBeenCalledTimes(3);
  });
  it('a fresh unavailable descriptor blocks POST even if selected earlier', async () => {
    await ready();
    const changed = publicMapFixture();
    changed.floors[0]!.sectors[0]!.elements[0]!.selectable = false;
    api.map.mockReturnValue(of(changed));
    await store.submit();
    expect(api.create).not.toHaveBeenCalled();
    expect(store.step()).toBe('confirm');
  });
  it('late map response cannot restore selection after changing context', async () => {
    const late = new Subject<PublicAvailabilityMap>();
    api.map.mockReturnValueOnce(late);
    const first = configure();
    await store.configure('tenant-a', 'venue-b', 'space-a', '2030-12-24', '19:00', '21:00');
    late.next(publicMapFixture());
    late.complete();
    await first;
    expect(store.descriptor()).toBeNull();
  });
  it('cancels pending creation on scope change and ignores its late response', async () => {
    await ready();
    const late = new Subject<PublicReservation>();
    api.create.mockReturnValue(late);
    const first = store.submit();
    await Promise.resolve();
    await store.configure('tenant-a', 'venue-b', 'space-b', '2030-12-24', '19:00', '21:00');
    late.next(reservation);
    late.complete();
    await first;
    expect(store.reservation()).toBeNull();
    expect(store.checkoutPath()).toBeNull();
  });
  it.each([400, 404, 0])(
    'keeps form fields on HTTP error %s without fake success',
    async (status) => {
      await ready();
      api.create.mockReturnValue(throwError(() => new HttpErrorResponse({ status })));
      await store.submit();
      expect(store.status()).toBe('error');
      expect(store.fullName()).toBe('Ana Pérez');
      expect(store.reservation()).toBeNull();
    },
  );

  it('recovers an already-created reservation through its own checkout after reload, not the RESERVED map', async () => {
    await store.configure(
      'tenant-a',
      'venue-a',
      'space-a',
      '2030-12-24',
      '19:00',
      '21:00',
      reservation.id,
    );
    expect(api.map).not.toHaveBeenCalled();
    expect(api.create).not.toHaveBeenCalled();
    expect(store.ownReservation()?.spaces[0]?.name).toBe('Nombre vigente');
    expect(store.step()).toBe('done');
  });

  it('retains the draft only in memory when reselecting within the same establishment', async () => {
    await ready();
    await store.configure('tenant-a', 'venue-a', 'space-b', '2030-12-24', '19:00', '21:00');
    expect(store.fullName()).toBe('Ana Pérez');
    expect(store.email()).toBe('ana@example.com');
    await store.configure('tenant-a', 'venue-b', 'space-b', '2030-12-24', '19:00', '21:00');
    expect(store.fullName()).toBe('');
    expect(store.email()).toBe('');
  });

  it('does not claim success for an own reservation response from another scope', async () => {
    api.checkout.mockReturnValue(
      of({ ...checkout(), reservation: { ...checkout().reservation, establishmentSlug: 'other' } }),
    );
    await store.configure(
      'tenant-a',
      'venue-a',
      'space-a',
      '2030-12-24',
      '19:00',
      '21:00',
      reservation.id,
    );
    expect(store.ownReservation()).toBeNull();
    expect(store.status()).not.toBe('success');
    expect(store.checkoutPath()).toBeNull();
  });
});
