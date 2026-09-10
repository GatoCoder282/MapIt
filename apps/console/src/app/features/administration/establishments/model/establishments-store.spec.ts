import { TestBed } from '@angular/core/testing';
import type { Establishment } from '@mapit/api-client';
import { of, throwError } from 'rxjs';
import { EstablishmentsApi } from '../data/establishments-api';
import { EstablishmentsStore } from './establishments-store';

const BAR: Establishment = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Bar Central',
  type: 'NIGHTCLUB',
  slug: 'bar-central',
  timezone: 'America/La_Paz',
  createdAt: '2026-09-09T12:00:00Z',
  updatedAt: '2026-09-09T12:00:00Z',
};

describe('EstablishmentsStore', () => {
  let store: EstablishmentsStore;
  const list = vi.fn(() => of([BAR]));
  const create = vi.fn(() => of(BAR));
  const update = vi.fn(() => of(BAR));
  const remove = vi.fn(() => of(undefined));
  const api = { list, create, update, delete: remove } as unknown as EstablishmentsApi;

  beforeEach(() => {
    vi.clearAllMocks();
    list.mockReturnValue(of([BAR]));
    create.mockReturnValue(of(BAR));
    update.mockReturnValue(of(BAR));
    remove.mockReturnValue(of(undefined));
    TestBed.configureTestingModule({
      providers: [EstablishmentsStore, { provide: EstablishmentsApi, useValue: api }],
    });
    store = TestBed.inject(EstablishmentsStore);
  });

  it('carga los establecimientos al crear el ViewModel', () => {
    expect(store.items()).toEqual([BAR]);
    expect(list).toHaveBeenCalledOnce();
  });

  it('crea uno enviando el tipo y lo añade al principio del estado', () => {
    const creado: Establishment = {
      ...BAR,
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Hotel Sur',
      type: 'HOTEL',
      slug: 'hotel-sur',
    };
    create.mockReturnValue(of(creado));

    store.setName('Hotel Sur');
    store.setType('HOTEL');
    store.setSlug('hotel-sur');
    store.save();

    expect(create).toHaveBeenCalledWith({
      name: 'Hotel Sur',
      type: 'HOTEL',
      slug: 'hotel-sur',
      timezone: 'America/La_Paz',
    });
    expect(store.items()).toEqual([creado, BAR]);
    expect(store.isEditing()).toBe(false);
  });

  it('al actualizar NO envía el tipo, porque es inmutable', () => {
    store.edit(BAR);
    store.setName('Bar Central VIP');
    store.save();

    // La comparación es exacta: si el store enviara `type`, esta aserción fallaría.
    expect(update).toHaveBeenCalledWith(BAR.id, {
      name: 'Bar Central VIP',
      slug: 'bar-central',
      timezone: 'America/La_Paz',
    });
  });

  it('rechaza guardar sin nombre y no llama a la API', () => {
    store.setSlug('sin-nombre');
    store.save();

    expect(store.error()).toBe('El nombre es obligatorio.');
    expect(create).not.toHaveBeenCalled();
  });

  it('rechaza un slug con formato inválido y no llama a la API', () => {
    store.setName('Con mayúsculas');
    store.setSlug('Slug-Invalido');
    store.save();

    expect(store.error()).toContain('slug');
    expect(create).not.toHaveBeenCalled();
  });

  it('traduce el 409 del backend a un mensaje sobre el slug', () => {
    create.mockReturnValue(throwError(() => ({ status: 409 })));

    store.setName('Duplicado');
    store.setSlug('bar-central');
    store.save();

    expect(store.error()).toBe('Ya existe un establecimiento con ese slug.');
  });

  it('quita de la lista el que se da de baja', () => {
    store.remove(BAR.id);

    expect(remove).toHaveBeenCalledWith(BAR.id);
    expect(store.items()).toEqual([]);
  });

  it('editar carga el borrador con los datos del establecimiento', () => {
    store.edit(BAR);

    expect(store.isEditing()).toBe(true);
    expect(store.draft()).toEqual({
      name: 'Bar Central',
      type: 'NIGHTCLUB',
      slug: 'bar-central',
      timezone: 'America/La_Paz',
    });
  });
});
