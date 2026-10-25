import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { PublicReservation } from '@mapit/api-client';
import { of, throwError } from 'rxjs';

import { BookingApi } from '../data/booking-api';
import { BookingStore } from './booking-store';

describe('BookingStore', () => {
  const reservation: PublicReservation = {
    id: '10000000-0000-0000-0000-000000000001',
    establishmentId: '20000000-0000-0000-0000-000000000001',
    spaceElementIds: new Set(['30000000-0000-0000-0000-000000000001']),
    date: '2026-10-25',
    startTime: '19:00',
    endTime: '21:00',
    startsAt: '2026-10-25T23:00:00Z',
    endsAt: '2026-10-26T01:00:00Z',
    timezone: 'America/La_Paz',
    status: 'CREATED',
    createdAt: '2026-10-20T12:00:00Z',
  };

  let api: { create: ReturnType<typeof vi.fn> };
  let store: BookingStore;

  beforeEach(() => {
    api = { create: vi.fn() };
    TestBed.configureTestingModule({
      providers: [BookingStore, { provide: BookingApi, useValue: api }],
    });
    store = TestBed.inject(BookingStore);
  });

  afterEach(() => TestBed.resetTestingModule());

  function fillValidForm(): void {
    store.initialize('2026-10-25');
    store.setStartTime('19:00');
    store.setEndTime('21:00');
    store.setFullName('Ana Pérez');
    store.setEmail('ana@example.com');
    store.setPhone('+591 70000000');
  }

  it('envía la reserva con el espacio, la fecha y los datos del cliente', () => {
    api.create.mockReturnValue(of(reservation));
    fillValidForm();

    store.submit('demo', 'la-bahia', '30000000-0000-0000-0000-000000000001');

    expect(api.create).toHaveBeenCalledWith('demo', 'la-bahia', {
      date: '2026-10-25',
      startTime: '19:00',
      endTime: '21:00',
      spaceElementIds: new Set(['30000000-0000-0000-0000-000000000001']),
      customer: {
        fullName: 'Ana Pérez',
        email: 'ana@example.com',
        phone: '+591 70000000',
      },
    });
    expect(store.status()).toBe('success');
    expect(store.reservation()).toEqual(reservation);
  });

  it('no llama a la API cuando el formulario es inválido', () => {
    store.initialize('2026-10-25');
    store.setFullName('A');
    store.setEmail('correo-invalido');
    store.setStartTime('21:00');
    store.setEndTime('19:00');

    store.submit('demo', 'la-bahia', '30000000-0000-0000-0000-000000000001');

    expect(api.create).not.toHaveBeenCalled();
    expect(store.submitted()).toBe(true);
    expect(store.status()).toBe('idle');
    expect(store.fullNameError()).not.toBe('');
    expect(store.emailError()).not.toBe('');
    expect(store.timeError()).not.toBe('');
  });

  it('traduce un conflicto de disponibilidad a un mensaje recuperable', () => {
    api.create.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, statusText: 'Conflict' })),
    );
    fillValidForm();

    store.submit('demo', 'la-bahia', '30000000-0000-0000-0000-000000000001');

    expect(store.status()).toBe('error');
    expect(store.errorMessage()).toContain('ya no está disponible');
  });

  it.each([
    [400, 'Revisa los datos'],
    [404, 'ya no están disponibles'],
    [0, 'Revisa tu conexión'],
  ])('traduce el estado %i sin perder los datos del formulario', (status, message) => {
    api.create.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status, statusText: 'Error' })),
    );
    fillValidForm();

    store.submit('demo', 'la-bahia', '30000000-0000-0000-0000-000000000001');

    expect(store.status()).toBe('error');
    expect(store.errorMessage()).toContain(message);
    expect(store.fullName()).toBe('Ana Pérez');
    expect(store.email()).toBe('ana@example.com');
    expect(store.startTime()).toBe('19:00');
  });

  it('limpia el error al editar un campo', () => {
    api.create.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, statusText: 'Server error' })),
    );
    fillValidForm();
    store.submit('demo', 'la-bahia', '30000000-0000-0000-0000-000000000001');

    store.setFullName('Ana María Pérez');

    expect(store.status()).toBe('idle');
    expect(store.errorMessage()).toBe('');
  });
});
