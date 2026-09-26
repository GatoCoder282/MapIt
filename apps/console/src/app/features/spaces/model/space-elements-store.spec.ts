import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpaceElement } from '@mapit/api-client';

import { SpacesStore } from './spaces-store';
import { SpacesApiService } from '../data/spaces-api';

/**
 * Reglas del ViewModel de elementos espaciales (HU-2.03 / MAP-116/118).
 * Sin renderizar componentes: el store queda probado con un mock de la capa de datos.
 */
describe('SpacesStore — elementos espaciales', () => {
  let api: {
    createSpaceElement: ReturnType<typeof vi.fn>;
    updateSpaceElement: ReturnType<typeof vi.fn>;
    listSpaceElementsBySector: ReturnType<typeof vi.fn>;
    listFloors: ReturnType<typeof vi.fn>;
    listSectorsByFloor: ReturnType<typeof vi.fn>;
    deleteFloor: ReturnType<typeof vi.fn>;
    deleteSector: ReturnType<typeof vi.fn>;
    createFloor: ReturnType<typeof vi.fn>;
    updateFloor: ReturnType<typeof vi.fn>;
    createSector: ReturnType<typeof vi.fn>;
    getFloor: ReturnType<typeof vi.fn>;
  };
  let store: SpacesStore;

  beforeEach(() => {
    api = {
      createSpaceElement: vi.fn(),
      updateSpaceElement: vi.fn(),
      listSpaceElementsBySector: vi.fn(),
      // El store arranca pidiendo floors/sectores; las mockeamos como vacías.
      listFloors: vi.fn().mockReturnValue(of([])),
      listSectorsByFloor: vi.fn().mockReturnValue(of([])),
      deleteFloor: vi.fn(),
      deleteSector: vi.fn(),
      createFloor: vi.fn(),
      updateFloor: vi.fn(),
      createSector: vi.fn(),
      getFloor: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [SpacesStore, { provide: SpacesApiService, useValue: api }],
    });
    store = TestBed.inject(SpacesStore);
  });

  it('carga los elementos del sector en la key correspondiente', () => {
    const stub: SpaceElement[] = [
      {
        id: 'e1',
        sectorId: 's-a',
        type: 'TABLE',
        x: 1,
        y: 2,
        state: 'AVAILABLE',
        createdAt: '2026-09-24T00:00:00Z',
        updatedAt: '2026-09-24T00:00:00Z',
      },
    ];
    api.listSpaceElementsBySector.mockReturnValue(of(stub));

    store.loadSpaceElementsBySector('s-a');
    expect(store.elementsBySector()['s-a']).toEqual(stub);
  });

  it('rechaza coordenadas no-negativas sin llamar al API', () => {
    store.setElementType('TABLE');
    store.setElementX('-1');
    store.setElementY('10');
    const result = store.saveElement('s-a');
    expect(result).toBeNull();
    expect(api.createSpaceElement).not.toHaveBeenCalled();
    expect(store.error()).toContain('no negativos');
  });

  it('alta válida crea el elemento y lo añade a la lista', () => {
    const created: SpaceElement = {
      id: 'e1',
      sectorId: 's-a',
      type: 'TABLE',
      x: 5,
      y: 10,
      state: 'AVAILABLE',
      createdAt: '2026-09-24T00:00:00Z',
      updatedAt: '2026-09-24T00:00:00Z',
    };
    api.createSpaceElement.mockReturnValue(of(created));
    store.setElementType('TABLE');
    store.setElementX('5');
    store.setElementY('10');

    const subscription = store.saveElement('s-a')?.subscribe();
    expect(api.createSpaceElement).toHaveBeenCalledWith(
      's-a',
      expect.objectContaining({ type: 'TABLE', x: 5, y: 10, initialState: 'AVAILABLE' }),
    );
    expect(store.elementsBySector()['s-a']?.[0]).toEqual(created);
    expect(store.elementDraft().type).toBe('TABLE'); // reset suave post-save
    subscription?.unsubscribe();
  });

  it('guarda por error 400 con mensaje específico de Validación de vertical', () => {
    api.createSpaceElement.mockReturnValue(throwError(() => ({ status: 400 })));
    store.setElementType('ROOM');
    store.setElementX('1');
    store.setElementY('1');
    const sub = store.saveElement('s-a')?.subscribe({ error: () => {} });
    expect(store.error()).toContain('vertical');
    sub?.unsubscribe();
  });

  it('guarda por error genérico sin detalle técnico', () => {
    api.createSpaceElement.mockReturnValue(throwError(() => ({ status: 500 })));
    store.setElementType('BAR');
    store.setElementX('1');
    store.setElementY('1');
    const sub = store.saveElement('s-a')?.subscribe({ error: () => {} });
    expect(store.error()).toBe('No se pudo guardar el elemento.');
    sub?.unsubscribe();
  });

  it('PUT conserva el estado y actualiza solo tipo/coords', () => {
    const existing: SpaceElement = {
      id: 'e1',
      sectorId: 's-a',
      type: 'TABLE',
      x: 1,
      y: 1,
      state: 'OCCUPIED',
      createdAt: '2026-09-23T00:00:00Z',
      updatedAt: '2026-09-23T00:00:00Z',
    };
    const updated = { ...existing, type: 'BAR' as const, x: 9, y: 9 };
    api.updateSpaceElement.mockReturnValue(of(updated));

    // Simular contexto editando el elemento existente
    store.setElementType('BAR');
    store.setElementX('9');
    store.setElementY('9');
    (store as unknown as { editingElementIdState: { set: (v: string) => void } })[
      'editingElementIdState'
    ].set('e1');

    const sub = store.saveElement('s-a')?.subscribe();
    expect(api.updateSpaceElement).toHaveBeenCalledWith(
      's-a',
      'e1',
      expect.objectContaining({ type: 'BAR', x: 9, y: 9 }),
    );
    sub?.unsubscribe();
  });
});

/**
 * Contexto de establecimiento del wizard (corrección HU-2.03): el paso 2 solo
 * consulta plantas cuando tiene un establishmentId real de la URL/paso 1.
 */
describe('SpacesStore — contexto de establecimiento', () => {
  let api: {
    createEstablishment: ReturnType<typeof vi.fn>;
    listFloors: ReturnType<typeof vi.fn>;
  };
  let store: SpacesStore;

  beforeEach(() => {
    api = {
      createEstablishment: vi.fn(),
      listFloors: vi.fn().mockReturnValue(of([])),
    };
    TestBed.configureTestingModule({
      providers: [SpacesStore, { provide: SpacesApiService, useValue: api }],
    });
    store = TestBed.inject(SpacesStore);
  });

  it('sin establecimiento no consulta plantas ni marca error', () => {
    store.loadFloors();
    expect(api.listFloors).not.toHaveBeenCalled();
    expect(store.floors()).toEqual([]);
    expect(store.error()).toBeNull();
  });

  it('selectEstablishment dispara la carga con el id real', () => {
    api.listFloors.mockReturnValue(
      of([
        {
          id: 'f1',
          establishmentId: 'est-1',
          name: 'Planta baja',
          level: 1,
          slug: 'planta-baja',
          createdAt: '2026-09-25T00:00:00Z',
          updatedAt: '2026-09-25T00:00:00Z',
        },
      ]),
    );
    store.selectEstablishment('est-1');
    expect(api.listFloors).toHaveBeenCalledWith('est-1');
    expect(store.floors()).toHaveLength(1);
    expect(store.error()).toBeNull();
  });

  it('un fallo de carga marca error y NO mezcla con lista vacía', () => {
    api.listFloors.mockReturnValue(throwError(() => ({ status: 404 })));
    store.selectEstablishment('est-404');
    expect(store.error()).toBe(store.strings_.floors.errors.loadFailed);
    expect(store.floors()).toEqual([]);
  });

  it('createEstablishment fija el id como contexto del paso 2', () => {
    const creado = {
      id: 'est-nuevo',
      name: 'Gran Hotel Plaza',
      type: 'HOTEL',
      slug: 'gran-hotel-plaza',
      timezone: 'America/La_Paz',
      createdAt: '2026-09-25T00:00:00Z',
      updatedAt: '2026-09-25T00:00:00Z',
    };
    api.createEstablishment.mockReturnValue(of(creado));

    const sub = store
      .createEstablishment({
        name: 'Gran Hotel Plaza',
        type: 'HOTEL',
        address: '',
        timezone: 'America/La_Paz',
      })
      .subscribe();

    expect(api.createEstablishment).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Gran Hotel Plaza', slug: 'gran-hotel-plaza' }),
    );
    // La zona vacía no se envía: la omite y la controla el backend.
    expect(store.establishmentId()).toBe('est-nuevo');
    sub.unsubscribe();
  });
});
