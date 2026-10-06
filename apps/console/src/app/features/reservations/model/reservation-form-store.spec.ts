import { TestBed } from '@angular/core/testing';
import type { Establishment, Person, Reservation } from '@mapit/api-client';
import { of, throwError } from 'rxjs';

import { ReservationsApi, type ReservationElementOption } from '../data/reservations-api';
import { ReservationFormStore } from './reservation-form-store';

const ESTABLISHMENT: Establishment = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'MapIt Centro',
  type: 'RESTAURANT',
  slug: 'mapit-centro',
  timezone: 'America/La_Paz',
  createdAt: '2026-10-03T12:00:00Z',
  updatedAt: '2026-10-03T12:00:00Z',
};
const PERSON: Person = {
  id: '20000000-0000-4000-8000-000000000001',
  fullName: 'Ana Pérez',
  createdAt: '2026-10-03T12:00:00Z',
  updatedAt: '2026-10-03T12:00:00Z',
};
const ELEMENT: ReservationElementOption = {
  id: '30000000-0000-4000-8000-000000000001',
  type: 'TABLE',
  state: 'AVAILABLE',
  floorName: 'Planta baja',
  sectorName: 'Salón',
};
const RESERVATION: Reservation = {
  id: '40000000-0000-4000-8000-000000000001',
  establishmentId: ESTABLISHMENT.id,
  personId: PERSON.id,
  spaceElementIds: new Set([ELEMENT.id]),
  startsAt: '2026-10-04T16:00:00.000Z',
  endsAt: '2026-10-04T17:00:00.000Z',
  status: 'CREATED',
  createdAt: '2026-10-03T12:00:00Z',
  createdBy: '50000000-0000-4000-8000-000000000001',
};

describe('ReservationFormStore', () => {
  let store: ReservationFormStore;
  const listEstablishments = vi.fn(() => of([ESTABLISHMENT]));
  const listReservableElements = vi.fn(() => of([ELEMENT]));
  const createReservation = vi.fn(() => of(RESERVATION));
  const api = {
    listEstablishments,
    listReservableElements,
    createReservation,
  } as unknown as ReservationsApi;

  beforeEach(() => {
    vi.clearAllMocks();
    listEstablishments.mockReturnValue(of([ESTABLISHMENT]));
    listReservableElements.mockReturnValue(of([ELEMENT]));
    createReservation.mockReturnValue(of(RESERVATION));
    TestBed.configureTestingModule({
      providers: [ReservationFormStore, { provide: ReservationsApi, useValue: api }],
    });
    store = TestBed.inject(ReservationFormStore);
  });

  it('carga y selecciona automáticamente el único establecimiento', () => {
    store.load();

    expect(store.establishments()).toEqual([ESTABLISHMENT]);
    expect(store.establishmentId()).toBe(ESTABLISHMENT.id);
    expect(listReservableElements).toHaveBeenCalledWith(ESTABLISHMENT.id);
    expect(store.elements()).toEqual([ELEMENT]);
  });

  it('limpia los elementos elegidos al cambiar de establecimiento', () => {
    store.selectEstablishment(ESTABLISHMENT.id);
    store.toggleElement(ELEMENT.id, true);
    store.selectEstablishment('10000000-0000-4000-8000-000000000002');

    expect(store.selectedElementIds().size).toBe(0);
  });

  it('exige seleccionar un cliente', () => {
    store.submit();

    expect(createReservation).not.toHaveBeenCalled();
    expect(store.error()).toBe('Selecciona o registra un cliente.');
  });

  it('rechaza un intervalo cuyo fin no es posterior al inicio', () => {
    prepareValidDraft();
    store.setEndsAt('2026-10-04T12:00');
    store.submit();

    expect(createReservation).not.toHaveBeenCalled();
    expect(store.error()).toBe('La fecha de fin debe ser posterior a la fecha de inicio.');
  });

  it('exige al menos un elemento', () => {
    prepareValidDraft();
    store.toggleElement(ELEMENT.id, false);
    store.submit();

    expect(createReservation).not.toHaveBeenCalled();
    expect(store.error()).toBe('Selecciona al menos un elemento.');
  });

  it('crea la reserva con instantes ISO y todos los identificadores', () => {
    prepareValidDraft();
    store.submit();

    expect(createReservation).toHaveBeenCalledWith(ESTABLISHMENT.id, {
      personId: PERSON.id,
      spaceElementIds: new Set([ELEMENT.id]),
      startsAt: '2026-10-04T16:00:00.000Z',
      endsAt: '2026-10-04T17:00:00.000Z',
    });
    expect(store.created()).toEqual(RESERVATION);
    expect(store.submitting()).toBe(false);
  });

  it.each([
    [400, 'Revisa el intervalo y los elementos seleccionados.'],
    [404, 'El cliente, establecimiento o algún elemento ya no está disponible.'],
    [409, 'Uno de los elementos ya está reservado durante ese horario.'],
  ])('traduce el error HTTP %i y conserva el formulario', (status, message) => {
    createReservation.mockReturnValue(throwError(() => ({ status })));
    prepareValidDraft();
    store.submit();

    expect(store.error()).toBe(message);
    expect(store.person()).toEqual(PERSON);
    expect(store.isElementSelected(ELEMENT.id)).toBe(true);
  });

  it('reinicia los datos útiles al comenzar otra reserva', () => {
    prepareValidDraft();
    store.submit();
    store.startAnother();

    expect(store.created()).toBeNull();
    expect(store.person()).toBeNull();
    expect(store.startsAt()).toBe('');
    expect(store.selectedElementIds().size).toBe(0);
  });

  function prepareValidDraft(): void {
    store.load();
    store.setPerson(PERSON);
    store.setStartsAt('2026-10-04T12:00');
    store.setEndsAt('2026-10-04T13:00');
    store.toggleElement(ELEMENT.id, true);
  }
});
