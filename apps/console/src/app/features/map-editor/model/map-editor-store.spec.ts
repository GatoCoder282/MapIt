import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MapEditorStore } from './map-editor-store';
import { MapEditorApiService } from '../data/map-editor-api';
import { of, Subject, throwError } from 'rxjs';
import type {
  SpaceElement,
  ElementTemplate,
  SectorLayoutResponse,
  SectorLayoutUpdateRequest,
} from '@mapit/api-client';
import { AuthSession } from '@mapit/auth';
import { EstablishmentContext } from '../../../core/establishment-context';

const MOCK_ELEMENTS: SpaceElement[] = [
  {
    id: 'elem-1',
    sectorId: 'sector-1',
    type: 'TABLE',
    x: 100,
    y: 100,
    width: 80,
    height: 80,
    rotation: 0,
    state: 'AVAILABLE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'elem-2',
    sectorId: 'sector-1',
    type: 'BAR',
    x: 300,
    y: 200,
    width: 100,
    height: 100,
    rotation: 0,
    state: 'OCCUPIED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const MOCK_TEMPLATES: ElementTemplate[] = [
  {
    id: 'tpl-1',
    name: 'Mesa redonda 6 pax',
    type: 'TABLE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl-2',
    name: 'Barra alta',
    type: 'BAR',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const sectorVersion = '2026-10-01T00:00:00Z';
const createMockApi = () => ({
  listFloorsByEstablishment: vi.fn(() => of([{ id: 'floor-1' }])),
  listSectorsByFloor: vi.fn(() =>
    of([
      { id: 'sector-1', name: 'Terraza', updatedAt: sectorVersion },
      { id: 'sector-2', name: 'Interior', updatedAt: sectorVersion },
    ]),
  ),
  listSpaceElementsBySector: vi.fn(() => of(MOCK_ELEMENTS)),
  createSpaceElement: vi.fn(() => of(MOCK_ELEMENTS[0])),
  updateSpaceElement: vi.fn(() => of(MOCK_ELEMENTS[0])),
  saveSectorLayout: vi.fn((id: string, request: SectorLayoutUpdateRequest) =>
    of({
      sector: {
        ...request.sector,
        id,
        updatedAt: '2026-10-02T00:00:00Z',
        ...(request.appearance ? { appearance: request.appearance } : {}),
      },
      elements: [
        ...MOCK_ELEMENTS,
        ...(request.createdElements ?? []).map((created) => ({
          ...created,
          sectorId: id,
          state: 'AVAILABLE',
          createdAt: sectorVersion,
          updatedAt: sectorVersion,
        })),
      ]
        .filter((element) => !request.deletedElements?.some((deleted) => deleted.id === element.id))
        .map((element) => {
          const update = request.elements.find((geometry) => geometry.id === element.id);
          const metadata = request.metadataUpdates?.find(({ id }) => id === element.id);
          return { ...element, ...update, ...metadata, sectorId: id };
        }),
    } as SectorLayoutResponse),
  ),
  deleteSpaceElement: vi.fn(() => of(undefined)),
  listTemplates: vi.fn(() => of(MOCK_TEMPLATES)),
  createTemplate: vi.fn(() => of(MOCK_TEMPLATES[0])),
});

describe('MapEditorStore', () => {
  let store: MapEditorStore;
  let role: 'ADMIN' | 'STAFF';
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    role = 'ADMIN';
    mockApi = createMockApi();

    TestBed.configureTestingModule({
      providers: [
        MapEditorStore,
        { provide: MapEditorApiService, useValue: mockApi },
        { provide: AuthSession, useValue: { user: () => ({ role }) } },
        {
          provide: EstablishmentContext,
          useValue: { active: () => ({ id: 'est-1' }), status: () => 'ready' },
        },
      ],
    });

    store = TestBed.inject(MapEditorStore);
    TestBed.flushEffects();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens a newly created floor after refreshing the floor list', () => {
    mockApi.listFloorsByEstablishment.mockReturnValue(of([{ id: 'floor-1' }, { id: 'floor-new' }]));
    mockApi.listSectorsByFloor.mockReturnValue(of([]));
    store.openRoute(null, 'floor-new');
    expect(store.selectedFloorId()).toBe('floor-new');
    expect(mockApi.listSectorsByFloor).toHaveBeenLastCalledWith('floor-new');
    expect(store.sectorId()).toBeNull();
    expect(store.loading()).toBe(false);
  });

  it('undoes multiple changes in reverse order and clears redo after a new edit', () => {
    const original = store.elements();
    store.dragElement('elem-1', 200, 200);
    store.saveElementMetadata('elem-1', 'Mesa historial', '3');
    store.deleteElement('elem-1');
    store.undo();
    expect(store.elements().find(({ id }) => id === 'elem-1')).toMatchObject({
      label: 'Mesa historial',
      capacity: 3,
      position: { x: 200, y: 200 },
    });
    store.undo();
    expect(store.elements().find(({ id }) => id === 'elem-1')).toMatchObject({
      label: original[0]!.label,
      position: { x: 200, y: 200 },
    });
    store.undo();
    expect(store.elements()).toEqual(original);
    expect(store.canUndo()).toBe(false);
    store.redo();
    expect(store.elements().find(({ id }) => id === 'elem-1')?.position).toEqual({
      x: 200,
      y: 200,
    });
    store.dragElement('elem-1', 240, 240);
    expect(store.canRedo()).toBe(false);
  });

  it('requires confirmation before removing an element and supports undo', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const before = store.elements();
    store.selectElement('elem-1');
    store.confirmDeleteElement('missing');
    expect(confirm).not.toHaveBeenCalled();
    store.confirmDeleteElement('elem-1');
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(store.elements()).toBe(before);
    confirm.mockReturnValue(true);
    store.confirmDeleteElement('elem-1');
    expect(store.elements().some(({ id }) => id === 'elem-1')).toBe(false);
    expect(store.selectedId()).toBeNull();
    store.undo();
    expect(store.elements()).toEqual(before);
    confirm.mockRestore();
  });

  it('copies a snapshot of metadata and appearance and pastes it with a new identity', () => {
    store.selectElement('elem-1');
    store.saveElementMetadata('elem-1', 'Mesa ventana', '6');
    store.updateAppearance((current) => ({
      ...current,
      elements: { ...current.elements, 'elem-1': { variant: 'oval', boardColor: '#f5d69a' } },
    }));
    expect(store.copySelectedElement()).toBe(true);
    store.deleteElement('elem-1');
    const before = store.elements().length;
    store.pasteElement();
    const pasted = store.selectedElement()!;
    expect(pasted.id).not.toBe('elem-1');
    expect(pasted.position).toEqual({ x: 124, y: 124 });
    expect(pasted.state).toBe('AVAILABLE');
    expect(store.selectedMetadata()).toEqual({ label: 'Mesa ventana', capacity: 6 });
    expect(store.appearance().elements[pasted.id]).toEqual({
      variant: 'oval',
      boardColor: '#f5d69a',
    });
    expect(store.elements()).toHaveLength(before + 1);
    store.undo();
    expect(store.elements()).toHaveLength(before);
    store.redo();
    expect(store.elements()).toHaveLength(before + 1);
    store.openRoute('sector-2', 'floor-1');
    expect(store.canPaste()).toBe(false);
  });

  it('validates configured insertions before changing the draft', () => {
    const before = store.elements();
    store.createElementFromDrop('base:TABLE', 100, 100, { capacity: 0 });
    expect(store.elements()).toBe(before);
    store.createElementFromDrop('base:TABLE', 100, 100, {
      label: 'Ventana',
      capacity: 8,
      size: { width: 160, height: 100 },
      finish: { variant: 'oval' },
    });
    expect(store.selectedMetadata()).toEqual({ label: 'Ventana', capacity: 8 });
    expect(store.selectedElement()?.size).toEqual({ width: 160, height: 100 });
    expect(store.appearance().elements[store.selectedId()!]?.variant).toBe('oval');
  });

  it('inserts a numbered arrangement with one undo step and preserves each finish', () => {
    const before = store.elements();
    store.createArrangement('TABLE', 0, 0, 2, 3, 12, {
      size: { width: 60, height: 60 },
      capacity: 4,
      label: 'Banquete',
      finish: { variant: 'round' },
    });
    const created = store
      .elements()
      .filter((element) => !before.some((previous) => previous.id === element.id));
    expect(created).toHaveLength(6);
    expect(created.map((element) => element.position)).toEqual([
      { x: 0, y: 0 },
      { x: 72, y: 0 },
      { x: 144, y: 0 },
      { x: 0, y: 72 },
      { x: 72, y: 72 },
      { x: 144, y: 72 },
    ]);
    expect(created.map((element) => element.label)).toEqual([
      'Banquete 1',
      'Banquete 2',
      'Banquete 3',
      'Banquete 4',
      'Banquete 5',
      'Banquete 6',
    ]);
    for (const element of created)
      expect(store.appearance().elements[element.id]?.variant).toBe('round');
    store.undo();
    expect(store.elements()).toEqual(before);
    expect(store.canUndo()).toBe(false);
    store.redo();
    expect(store.elements()).toHaveLength(before.length + 6);
  });

  it('rejects oversized arrangements and rolls back invalid resource metadata atomically', () => {
    const before = store.elements();
    store.createArrangement('TABLE', 0, 0, 10, 10, 200, { size: { width: 100, height: 100 } });
    expect(store.elements()).toEqual(before);
    expect(store.canUndo()).toBe(false);
    store.createArrangement('TABLE', 0, 0, 2, 2, 12, { capacity: 0 });
    expect(store.elements()).toEqual(before);
    expect(store.canUndo()).toBe(false);
  });

  it('stages metadata together with geometry without writing before Save', async () => {
    store.selectElement('elem-1');
    store.saveElementMetadata('elem-1', ' Terraza ', '3');
    expect(store.selectedMetadata()).toEqual({ label: 'Terraza', capacity: 3 });
    expect(store.dirty()).toBe(true);
    store.dragElement('elem-1', 200, 200);
    expect(mockApi.updateSpaceElement).not.toHaveBeenCalled();
    expect(mockApi.saveSectorLayout).not.toHaveBeenCalled();
    expect(await store.saveChanges()).toBe(true);
    expect(mockApi.saveSectorLayout).toHaveBeenCalledWith(
      'sector-1',
      expect.objectContaining({
        metadataUpdates: [
          { id: 'elem-1', updatedAt: MOCK_ELEMENTS[0]!.updatedAt, label: 'Terraza', capacity: 3 },
        ],
      }),
    );
    expect(store.selectedMetadata()).toEqual({ label: 'Terraza', capacity: 3 });
    expect(store.dirty()).toBe(false);
    store.clearElementMetadata('elem-1');
    expect(store.dirty()).toBe(true);
    expect(store.selectedMetadata()).toEqual({ label: null, capacity: null });
    store.discardChanges();
    expect(store.selectedMetadata()).toEqual({ label: 'Terraza', capacity: 3 });
  });

  it('rejects invalid metadata and includes cleared metadata in the pending draft', () => {
    store.saveElementMetadata('elem-1', 'X'.repeat(121), '4');
    expect(store.metadataError()).toBeTruthy();
    store.saveElementMetadata('elem-1', 'Terraza', '1.5');
    expect(store.dirty()).toBe(false);
    expect(mockApi.updateSpaceElement).not.toHaveBeenCalled();
    store.saveElementMetadata('elem-1', 'Terraza', '4');
    expect(store.metadataError()).toBeNull();
    expect(store.dirty()).toBe(true);
    store.undo();
    expect(store.dirty()).toBe(false);
    store.redo();
    store.selectElement('elem-1');
    expect(store.selectedMetadata()?.label).toBe('Terraza');
  });

  it('saves and restores a style-only draft using the versioned sector endpoint', async () => {
    const style = { elements: { 'elem-1': { color: '#145dca', showName: false } } };
    store.updateAppearance(() => style);
    expect(store.dirty()).toBe(true);
    expect(mockApi.saveSectorLayout).not.toHaveBeenCalled();
    store.undo();
    expect(store.dirty()).toBe(false);
    store.redo();
    expect(store.appearance()).toEqual(style);

    mockApi.saveSectorLayout.mockReturnValueOnce(throwError(() => ({ status: 500 })));
    expect(await store.saveChanges()).toBe(false);
    expect(store.dirty()).toBe(true);
    expect(store.appearance()).toEqual(style);

    expect(await store.saveChanges()).toBe(true);
    expect(mockApi.saveSectorLayout).toHaveBeenLastCalledWith(
      'sector-1',
      expect.objectContaining({ appearance: style, elements: [] }),
    );
    expect(store.dirty()).toBe(false);
    store.updateAppearance(() => ({ elements: {} }));
    expect(store.dirty()).toBe(true);
    store.discardChanges();
    expect(store.appearance()).toEqual(style);
  });

  it('keeps existing and newly added elements when a successful response omits them', async () => {
    store.createElementFromDrop('base:TABLE', 400, 400);
    const draft = store.layout();
    mockApi.saveSectorLayout.mockImplementationOnce((id, request) => {
      const sector: SectorLayoutResponse['sector'] = {
        ...request.sector,
        id,
        name: 'Terraza',
        slug: 'terraza',
        createdAt: sectorVersion,
        x: 0,
        y: 0,
        rotation: 0,
      };
      return of({ sector, elements: [] });
    });

    expect(await store.saveChanges()).toBe(false);
    expect(store.saved()).toBe(false);
    expect(store.dirty()).toBe(true);
    expect(store.layout()).toEqual(draft);
    expect(store.error()).toBeTruthy();

    expect(await store.saveChanges()).toBe(true);
    expect(store.layout().elements.map(({ id }) => id)).toEqual(draft.elements.map(({ id }) => id));
  });

  it('drops sector-one draft on sector-two switch before delayed elements load', () => {
    const pendingElements = new Subject<SpaceElement[]>();
    mockApi.listSpaceElementsBySector.mockReturnValueOnce(pendingElements);
    store.dragElement('elem-1', 250, 250);
    store.switchSector('sector-2');
    void store.saveChanges();
    expect(store.layout().elements).toEqual([]);
    expect(mockApi.updateSpaceElement).not.toHaveBeenCalled();
    pendingElements.next(MOCK_ELEMENTS);
    expect(store.layout().elements).toEqual([]);
    expect(mockApi.updateSpaceElement).not.toHaveBeenCalled();
  });

  it('dirty follows the original baseline through revert and successful save', () => {
    store.dragElement('elem-1', 200, 200);
    expect(store.dirty()).toBe(true);
    store.dragElement('elem-1', 100, 100);
    expect(store.dirty()).toBe(false);

    store.dragElement('elem-1', 200, 200);
    expect(store.dirty()).toBe(true);
    void store.saveChanges();
    expect(store.dirty()).toBe(false);
  });

  it('blocks new element edits while a save is pending', () => {
    const pending = new Subject<SectorLayoutResponse>();
    mockApi.saveSectorLayout.mockReturnValueOnce(pending);
    store.dragElement('elem-1', 200, 200);
    void store.saveChanges();
    expect(store.busy()).toBe(true);
    store.dragElement('elem-1', 300, 300);
    expect(store.elements().find((element) => element.id === 'elem-1')?.position).toEqual({
      x: 200,
      y: 200,
    });
    pending.next({
      sector: {
        id: 'sector-1',
        width: 1200,
        height: 800,
        updatedAt: sectorVersion,
      } as SectorLayoutResponse['sector'],
      elements: [{ ...MOCK_ELEMENTS[0]!, x: 200, y: 200 }, MOCK_ELEMENTS[1]!],
    });
    pending.complete();
    expect(store.busy()).toBe(false);
    expect(store.dirty()).toBe(false);
  });

  it('awaits a confirmed save and rejects duplicate saves or discard while saving', async () => {
    const pending = new Subject<SectorLayoutResponse>();
    mockApi.saveSectorLayout.mockReturnValueOnce(pending);
    store.dragElement('elem-1', 200, 200);
    const result = store.saveChanges();
    let settled = false;
    void result.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(await store.saveChanges()).toBe(false);
    expect(store.discardChanges()).toBe(false);
    expect(mockApi.saveSectorLayout).toHaveBeenCalledOnce();
    pending.next({
      sector: {
        id: 'sector-1',
        width: 1200,
        height: 800,
        updatedAt: sectorVersion,
      } as SectorLayoutResponse['sector'],
      elements: [{ ...MOCK_ELEMENTS[0]!, x: 200, y: 200 }, MOCK_ELEMENTS[1]!],
    });
    expect(await result).toBe(true);
    expect(store.busy()).toBe(false);
    expect(store.dirty()).toBe(false);
  });

  it('retains an unsuccessful draft and discards back to the last persisted baseline', async () => {
    mockApi.saveSectorLayout.mockReturnValueOnce(throwError(() => ({ status: 500 })));
    store.dragElement('elem-1', 200, 200);
    expect(await store.saveChanges()).toBe(false);
    expect(store.dirty()).toBe(true);
    expect(store.discardChanges()).toBe(true);
    expect(store.dirty()).toBe(false);
    expect(store.canUndo()).toBe(false);
    expect(store.canRedo()).toBe(false);
    expect(store.elements()[0]?.position).toEqual({ x: 100, y: 100 });
  });

  it('includes added elements, metadata, deletion and dimensions in one atomic save', async () => {
    store.createElementFromDrop('base:TABLE', 400, 400);
    const added = store.selectedId()!;
    store.saveElementMetadata(added, 'Mesa nueva', '6');
    store.saveElementMetadata('elem-1', 'Mesa uno', '4');
    store.deleteElement('elem-2');
    store.setSectorDimensions(1400, 900);

    expect(mockApi.createSpaceElement).not.toHaveBeenCalled();
    expect(mockApi.updateSpaceElement).not.toHaveBeenCalled();
    expect(mockApi.deleteSpaceElement).not.toHaveBeenCalled();
    expect(await store.saveChanges()).toBe(true);
    expect(mockApi.saveSectorLayout).toHaveBeenCalledOnce();
    expect(mockApi.saveSectorLayout).toHaveBeenCalledWith('sector-1', {
      sector: { width: 1400, height: 900, updatedAt: sectorVersion },
      elements: [],
      createdElements: [
        {
          id: added,
          type: 'TABLE',
          x: 400,
          y: 400,
          width: 80,
          height: 80,
          rotation: 0,
          label: 'Mesa nueva',
          capacity: 6,
        },
      ],
      deletedElements: [{ id: 'elem-2', updatedAt: MOCK_ELEMENTS[1]!.updatedAt }],
      metadataUpdates: [
        { id: 'elem-1', updatedAt: MOCK_ELEMENTS[0]!.updatedAt, label: 'Mesa uno', capacity: 4 },
      ],
    });
    expect(store.dirty()).toBe(false);
    expect(store.canUndo()).toBe(false);
    expect(store.elements().map(({ id }) => id)).toEqual(['elem-1', added]);

    store.setSectorDimensions(1600, 1000);
    store.discardChanges();
    expect(store.sectorSize()).toEqual({ width: 1400, height: 900 });
  });

  it('adding and deleting a draft element returns to clean without a server call', async () => {
    store.createElementFromDrop('base:DECOR', 300, 300);
    const id = store.selectedId()!;
    store.saveElementMetadata(id, 'Planta', '9');
    expect(store.selectedMetadata()?.capacity).toBeNull();
    store.deleteElement(id);
    expect(store.dirty()).toBe(false);
    expect(await store.saveChanges()).toBe(true);
    expect(mockApi.saveSectorLayout).not.toHaveBeenCalled();
    store.undo();
    expect(store.elements().some((element) => element.id === id)).toBe(true);
    expect(store.dirty()).toBe(true);
  });

  it('should load sector and populate layout with mapped elements', () => {
    store.loadSector('sector-1', 'Terraza');
    vi.runAllTicks();

    expect(mockApi.listSpaceElementsBySector).toHaveBeenCalledWith('sector-1');
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();

    const layout = store.layout();
    expect(layout.elements.length).toBe(2);
    const first = layout.elements[0];
    expect(first).toBeDefined();
    if (first) {
      expect(first.id).toBe('elem-1');
      expect(first.position).toEqual({ x: 100, y: 100 });
      expect(first.type).toBe('TABLE');
      expect(first.size).toEqual({ width: 80, height: 80 });
    }
    expect(layout.name).toBe('Terraza');
  });

  it('should handle load error', () => {
    mockApi.listSpaceElementsBySector.mockReturnValueOnce(throwError(() => ({ status: 500 })));

    store.switchSector('sector-2');
    vi.runAllTicks();

    expect(store.loading()).toBe(false);
    expect(store.error()).toBeTruthy();
  });

  it('rejects a sector not listed under the selected floor', () => {
    store.loadSector('foreign-sector');
    expect(mockApi.listSpaceElementsBySector).not.toHaveBeenCalledWith('foreign-sector');
    expect(store.sectorId()).not.toBe('foreign-sector');
  });

  it('should update element position on dragElement and clamp to sector bounds', () => {
    store.loadSector('sector-1');
    vi.runAllTicks();

    store.dragElement('elem-1', 500, 500);
    const layout = store.layout();
    const elem = layout.elements.find((e) => e.id === 'elem-1');
    expect(elem?.position).toEqual({ x: 500, y: 500 });

    store.dragElement('elem-1', -50, -50);
    const clampedLayout = store.layout();
    const clampedElem = clampedLayout.elements.find((e) => e.id === 'elem-1');
    expect(clampedElem?.position.x).toBe(0);
    expect(clampedElem?.position.y).toBe(0);

    store.dragElement('elem-1', 1150, 750);
    const maxClampedLayout = store.layout();
    const maxClampedElem = maxClampedLayout.elements.find((e) => e.id === 'elem-1');
    expect(maxClampedElem?.position.x).toBe(1120);
    expect(maxClampedElem?.position.y).toBe(720);
  });

  it('should update element rotation on rotateElement', () => {
    store.loadSector('sector-1');
    vi.runAllTicks();

    store.rotateElement('elem-1', 90);
    expect(store.layout().elements.find((e) => e.id === 'elem-1')?.rotation).toBe(90);

    store.rotateElement('elem-1', 450);
    expect(store.layout().elements.find((e) => e.id === 'elem-1')?.rotation).toBe(90);

    store.rotateElement('elem-1', -90);
    expect(store.layout().elements.find((e) => e.id === 'elem-1')?.rotation).toBe(270);
  });

  it('should update element size on resizeElement with minimum clamp', () => {
    store.loadSector('sector-1');
    vi.runAllTicks();

    store.resizeElement('elem-1', 200, 150, 200, 150);
    expect(store.layout().elements.find((e) => e.id === 'elem-1')?.size).toEqual({
      width: 200,
      height: 150,
    });

    store.resizeElement('elem-1', 10, 10, 20, 20);
    expect(store.layout().elements.find((e) => e.id === 'elem-1')?.size).toEqual({
      width: 20,
      height: 20,
    });
  });

  it('persists the latest drag and transform for each element in the same versioned save', () => {
    store.dragElement('elem-1', 200, 200);
    store.dragElement('elem-1', 230, 240);
    store.resizeElement('elem-2', 310, 210, 95, 105, 45);
    expect(mockApi.saveSectorLayout).not.toHaveBeenCalled();
    void store.saveChanges();
    expect(mockApi.saveSectorLayout).toHaveBeenCalledOnce();
    expect(mockApi.saveSectorLayout).toHaveBeenCalledWith('sector-1', {
      sector: { width: 1200, height: 800, updatedAt: sectorVersion },
      elements: [
        {
          id: 'elem-1',
          x: 230,
          y: 240,
          width: 80,
          height: 80,
          rotation: 0,
          updatedAt: MOCK_ELEMENTS[0]!.updatedAt,
        },
        {
          id: 'elem-2',
          x: 310,
          y: 210,
          width: 95,
          height: 105,
          rotation: 45,
          updatedAt: MOCK_ELEMENTS[1]!.updatedAt,
        },
      ],
    });
    expect(store.saved()).toBe(true);
    expect(store.dirty()).toBe(false);
  });

  it.each([400, 409, 500])('preserves the draft on save error %s', (status) => {
    mockApi.saveSectorLayout.mockReturnValueOnce(throwError(() => ({ status })));
    store.dragElement('elem-1', 200, 200);
    void store.saveChanges();
    expect(store.error()).toBeTruthy();
    expect(store.conflict()).toBe(status === 409);
    expect(store.dirty()).toBe(true);
    expect(store.layout().elements[0]?.position).toEqual({ x: 200, y: 200 });
    if (status === 409) {
      void store.saveChanges();
      expect(mockApi.saveSectorLayout).toHaveBeenCalledOnce();
      store.reloadSector();
      expect(store.dirty()).toBe(false);
      expect(store.conflict()).toBe(false);
    }
  });

  it('undoes and redoes grouped geometry before saving', () => {
    store.resizeElement('elem-1', 200, 220, 90, 95, 45);
    store.undo();
    expect(store.dirty()).toBe(false);
    expect(store.layout().elements[0]?.rotation).toBe(0);
    store.redo();
    expect(store.layout().elements[0]).toMatchObject({
      size: { width: 90, height: 95 },
      rotation: 45,
    });
    expect(store.dirty()).toBe(true);
  });

  it('blocks mutations for staff', () => {
    role = 'STAFF';
    store.dragElement('elem-1', 200, 200);
    void store.saveChanges();
    store.createElementFromDrop('base:TABLE', 100, 100);
    store.deleteElement('elem-1');
    expect(store.dirty()).toBe(false);
    expect(mockApi.saveSectorLayout).not.toHaveBeenCalled();
    expect(mockApi.createSpaceElement).not.toHaveBeenCalled();
    expect(mockApi.deleteSpaceElement).not.toHaveBeenCalled();
  });

  it('should expose sectorId signal', () => {
    expect(store.sectorId()).toBe('sector-1');
    store.loadSector('sector-1');
    expect(store.sectorId()).toBe('sector-1');
  });

  it('should clear error', () => {
    mockApi.listSpaceElementsBySector.mockReturnValueOnce(throwError(() => ({ status: 500 })));
    store.switchSector('sector-2');
    vi.runAllTicks();
    expect(store.error()).toBeTruthy();

    store.clearError();
    expect(store.error()).toBeNull();
  });

  describe('Plantillas (HU-4.02)', () => {
    it('should load templates', () => {
      store.loadTemplates();
      vi.runAllTicks();

      expect(mockApi.listTemplates).toHaveBeenCalled();
      expect(store.templates()).toEqual(MOCK_TEMPLATES);
      expect(store.templatesLoading()).toBe(false);
    });

    it('should select element and save it as template', () => {
      store.loadSector('sector-1');
      vi.runAllTicks();
      store.selectElement('elem-1');
      vi.runAllTicks();

      store.saveAsTemplate('Mesa redonda');
      vi.runAllTicks();

      expect(mockApi.createTemplate).toHaveBeenCalledWith({
        name: 'Mesa redonda',
        type: 'TABLE',
      });
    });

    it('should show error when saving template without selection', () => {
      store.loadSector('sector-1');
      vi.runAllTicks();

      store.saveAsTemplate('Sin selección');
      vi.runAllTicks();

      expect(store.error()).toContain('Selecciona un elemento');
      expect(mockApi.createTemplate).not.toHaveBeenCalled();
    });

    it('should show error when template name is empty', () => {
      store.loadSector('sector-1');
      vi.runAllTicks();
      store.selectElement('elem-1');
      vi.runAllTicks();

      store.saveAsTemplate('   ');
      vi.runAllTicks();

      expect(store.error()).toContain('nombre');
      expect(mockApi.createTemplate).not.toHaveBeenCalled();
    });

    it('should handle conflict when template name already exists', () => {
      mockApi.createTemplate.mockReturnValueOnce(throwError(() => ({ status: 409 })));

      store.loadSector('sector-1');
      vi.runAllTicks();
      store.selectElement('elem-1');
      vi.runAllTicks();

      store.saveAsTemplate('Mesa existente');
      vi.runAllTicks();

      expect(store.error()).toContain('Ya existe');
    });
  });

  describe('HU-4.01: drop desde biblioteca y borrado', () => {
    it('creates element at drop coordinates from a base structure key', () => {
      store.loadSector('sector-1');
      vi.runAllTicks();

      store.createElementFromDrop('base:BAR', 250, 120);
      vi.runAllTicks();

      expect(mockApi.createSpaceElement).not.toHaveBeenCalled();
      expect(store.elements().at(-1)).toMatchObject({
        type: 'BAR',
        position: { x: 250, y: 120 },
        size: { width: 200, height: 60 },
      });
      expect(store.dirty()).toBe(true);
    });

    it('stages a saved-template element and discards it without a POST', () => {
      store.loadTemplates();
      store.createElementFromDrop('tpl:tpl-1', 10, 20);
      expect(mockApi.createSpaceElement).not.toHaveBeenCalled();
      expect(store.elements()).toHaveLength(3);
      expect(store.dirty()).toBe(true);
      store.discardChanges();
      expect(store.elements()).toHaveLength(2);
      expect(store.dirty()).toBe(false);
    });

    it('does nothing for an unknown key in the selected sector', () => {
      store.loadTemplates();
      vi.runAllTicks();
      store.createElementFromDrop('tpl:missing', 10, 10);
      expect(mockApi.createSpaceElement).not.toHaveBeenCalled();
      expect(store.error()).toContain('no existe');
    });

    it('stages deletion, supports undo, and only sends the delete with Save', async () => {
      store.selectElement('elem-1');
      store.deleteElement('elem-1');
      expect(mockApi.deleteSpaceElement).not.toHaveBeenCalled();
      expect(store.elements()).toHaveLength(1);
      expect(store.selectedId()).toBeNull();
      expect(store.dirty()).toBe(true);
      store.undo();
      expect(store.elements()).toHaveLength(2);
      expect(store.dirty()).toBe(false);
      store.redo();
      expect(await store.saveChanges()).toBe(true);
      expect(mockApi.saveSectorLayout).toHaveBeenCalledWith(
        'sector-1',
        expect.objectContaining({
          deletedElements: [{ id: 'elem-1', updatedAt: MOCK_ELEMENTS[0]!.updatedAt }],
        }),
      );
      expect(store.elements()).toHaveLength(1);
      expect(store.dirty()).toBe(false);
    });

    it('preserves a deleted element draft on an active-reservation conflict', async () => {
      mockApi.saveSectorLayout.mockReturnValueOnce(throwError(() => ({ status: 409 })));
      store.deleteElement('elem-1');
      expect(await store.saveChanges()).toBe(false);
      expect(store.dirty()).toBe(true);
      expect(store.conflict()).toBe(true);
      expect(store.discardChanges()).toBe(true);
      expect(store.elements()).toHaveLength(2);
    });
  });
});
