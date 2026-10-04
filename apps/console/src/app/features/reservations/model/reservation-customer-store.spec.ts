import { TestBed } from '@angular/core/testing';
import type { Person } from '@mapit/api-client';
import { of, throwError } from 'rxjs';

import { ReservationsApi } from '../data/reservations-api';
import { ReservationCustomerStore } from './reservation-customer-store';

const ANA: Person = {
  id: '20000000-0000-4000-8000-000000000001',
  fullName: 'Ana Pérez',
  email: 'ana@example.com',
  phone: '+591 70000000',
  createdAt: '2026-10-03T12:00:00Z',
  updatedAt: '2026-10-03T12:00:00Z',
};

describe('ReservationCustomerStore', () => {
  let store: ReservationCustomerStore;
  const searchPeople = vi.fn(() => of([ANA]));
  const createPerson = vi.fn(() => of(ANA));
  const api = { searchPeople, createPerson } as unknown as ReservationsApi;

  beforeEach(() => {
    vi.clearAllMocks();
    searchPeople.mockReturnValue(of([ANA]));
    createPerson.mockReturnValue(of(ANA));
    TestBed.configureTestingModule({
      providers: [ReservationCustomerStore, { provide: ReservationsApi, useValue: api }],
    });
    store = TestBed.inject(ReservationCustomerStore);
  });

  it('busca con el texto recortado y guarda los resultados', () => {
    store.setQuery('  Ana  ');
    store.search();

    expect(searchPeople).toHaveBeenCalledWith('Ana');
    expect(store.results()).toEqual([ANA]);
    expect(store.searching()).toBe(false);
  });

  it('permite seleccionar y cambiar de cliente', () => {
    store.select(ANA);

    expect(store.selected()).toEqual(ANA);
    expect(store.hasSelection()).toBe(true);

    store.clearSelection();
    expect(store.selected()).toBeNull();
    expect(store.hasSelection()).toBe(false);
  });

  it('precarga la búsqueda como nombre al abrir el registro', () => {
    store.setQuery('  Cliente Nuevo ');
    store.openRegistration();

    expect(store.registrationOpen()).toBe(true);
    expect(store.draft().fullName).toBe('Cliente Nuevo');
  });

  it('registra, agrega y selecciona al cliente creado', () => {
    store.openRegistration();
    store.setFullName('  Ana Pérez ');
    store.setEmail(' ANA@EXAMPLE.COM ');
    store.setPhone(' +591 70000000 ');
    store.register();

    expect(createPerson).toHaveBeenCalledWith({
      fullName: 'Ana Pérez',
      email: 'ana@example.com',
      phone: '+591 70000000',
    });
    expect(store.selected()).toEqual(ANA);
    expect(store.results()).toEqual([ANA]);
    expect(store.registrationOpen()).toBe(false);
    expect(store.saving()).toBe(false);
  });

  it('no llama a la API cuando falta el nombre', () => {
    store.openRegistration();
    store.register();

    expect(createPerson).not.toHaveBeenCalled();
    expect(store.error()).toBe('Ingresa el nombre completo del cliente.');
  });

  it('rechaza un correo con formato inválido', () => {
    store.openRegistration();
    store.setFullName('Ana Pérez');
    store.setEmail('correo-invalido');
    store.register();

    expect(createPerson).not.toHaveBeenCalled();
    expect(store.error()).toBe('Ingresa un correo electrónico válido.');
  });

  it('traduce el conflicto de correo del backend', () => {
    createPerson.mockReturnValue(throwError(() => ({ status: 409 })));
    store.openRegistration();
    store.setFullName('Ana Pérez');
    store.setEmail('ana@example.com');
    store.register();

    expect(store.error()).toBe('Ya existe un cliente con ese correo.');
  });

  it('limpia resultados y muestra error cuando falla la búsqueda', () => {
    searchPeople.mockReturnValue(throwError(() => new Error('network')));
    store.search();

    expect(store.results()).toEqual([]);
    expect(store.error()).toBe('No se pudo buscar clientes. Inténtalo de nuevo.');
  });
});
