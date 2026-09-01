import { TestBed } from '@angular/core/testing';
import type { DemoItem } from '@mapit/api-client';
import { of } from 'rxjs';
import { DemoItemsApi } from '../data/demo-items-api';
import { DemoItemsStore } from './demo-items-store';

const ITEM: DemoItem = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Mesa terraza',
  description: 'Cerca de la entrada',
  active: true,
  createdAt: '2026-09-01T12:00:00Z',
  updatedAt: '2026-09-01T12:00:00Z',
};

describe('DemoItemsStore', () => {
  let store: DemoItemsStore;
  const list = vi.fn(() => of([ITEM]));
  const create = vi.fn(() => of(ITEM));
  const update = vi.fn(() => of(ITEM));
  const remove = vi.fn(() => of(undefined));
  const api = { list, create, update, delete: remove } as unknown as DemoItemsApi;

  beforeEach(() => {
    list.mockReturnValue(of([ITEM]));
    create.mockReturnValue(of(ITEM));
    TestBed.configureTestingModule({
      providers: [DemoItemsStore, { provide: DemoItemsApi, useValue: api }],
    });
    store = TestBed.inject(DemoItemsStore);
  });

  it('carga los elementos al crear el ViewModel', () => {
    expect(store.items()).toEqual([ITEM]);
    expect(list).toHaveBeenCalledOnce();
  });

  it('crea un elemento y lo añade al estado', () => {
    const created: DemoItem = {
      ...ITEM,
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Barra',
    };
    create.mockReturnValue(of(created));

    store.setName('Barra');
    store.setDescription('Zona principal');
    store.setActive(true);
    store.save();

    expect(create).toHaveBeenCalledWith({
      name: 'Barra',
      description: 'Zona principal',
      active: true,
    });
    expect(store.items()).toEqual([created, ITEM]);
    expect(store.isEditing()).toBe(false);
  });
});
