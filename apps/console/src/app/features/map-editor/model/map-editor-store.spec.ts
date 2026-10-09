import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MapEditorStore } from './map-editor-store';
import { MapEditorApiService } from '../data/map-editor-api';
import { MAP_EDITOR_DEBOUNCE_MS } from './map-editor-store';
import { of, throwError } from 'rxjs';
import type { SpaceElement } from '@mapit/api-client';

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

const createMockApi = () => ({
  listSpaceElementsBySector: vi.fn(() => of(MOCK_ELEMENTS)),
  updateSpaceElement: vi.fn(() => of(MOCK_ELEMENTS[0])),
});

describe('MapEditorStore', () => {
  let store: MapEditorStore;
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    mockApi = createMockApi();

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        MapEditorStore,
        { provide: MapEditorApiService, useValue: mockApi },
        { provide: MAP_EDITOR_DEBOUNCE_MS, useValue: 0 },
      ],
    });

    store = TestBed.inject(MapEditorStore);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
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

    store.loadSector('sector-1');
    vi.runAllTicks();

    expect(store.loading()).toBe(false);
    expect(store.error()).toBeTruthy();
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

  it('should persist element position on debounced save and clear pending save on success', () => {
    store.loadSector('sector-1');
    vi.runAllTicks();

    store.dragElement('elem-1', 200, 200);

    expect(store.saving()).toBe(false);

    store.flushDebouncedPersist();
    vi.runAllTicks();

    expect(mockApi.updateSpaceElement).toHaveBeenCalledWith('sector-1', 'elem-1', {
      type: 'TABLE',
      x: 200,
      y: 200,
      width: 80,
      height: 80,
      rotation: 0,
    });
    expect(store.saving()).toBe(false);
  });

  it('should rollback position on API error', () => {
    mockApi.updateSpaceElement.mockReturnValueOnce(throwError(() => ({ status: 500 })));

    store.loadSector('sector-1');
    vi.runAllTicks();

    const originalPos = store.layout().elements.find((e) => e.id === 'elem-1')?.position;
    store.dragElement('elem-1', 500, 500);
    store.flushDebouncedPersist();
    vi.runAllTicks();

    expect(store.error()).toBeTruthy();
    const rolledBackPos = store.layout().elements.find((e) => e.id === 'elem-1')?.position;
    expect(rolledBackPos).toEqual(originalPos);
  });

  it('should rollback on 400 error with specific message', () => {
    mockApi.updateSpaceElement.mockReturnValueOnce(throwError(() => ({ status: 400 })));

    store.loadSector('sector-1');
    vi.runAllTicks();

    store.dragElement('elem-1', 500, 500);
    store.flushDebouncedPersist();
    vi.runAllTicks();

    expect(store.error()).toContain('inválidos');
  });

  it('should rollback on 404 error with not found message', () => {
    mockApi.updateSpaceElement.mockReturnValueOnce(throwError(() => ({ status: 404 })));

    store.loadSector('sector-1');
    vi.runAllTicks();

    store.dragElement('elem-1', 500, 500);
    store.flushDebouncedPersist();
    vi.runAllTicks();

    expect(store.error()).toContain('encontrado');
  });

  it('should debounce multiple rapid drags to single API call', () => {
    store.loadSector('sector-1');
    vi.runAllTicks();

    store.dragElement('elem-1', 100, 100);
    store.dragElement('elem-1', 200, 200);
    store.dragElement('elem-1', 300, 300);

    store.flushDebouncedPersist();
    vi.runAllTicks();

    expect(mockApi.updateSpaceElement).toHaveBeenCalledTimes(1);
    expect(mockApi.updateSpaceElement).toHaveBeenCalledWith('sector-1', 'elem-1', {
      type: 'TABLE',
      x: 300,
      y: 300,
      width: 80,
      height: 80,
      rotation: 0,
    });
  });

  it('should persist element rotation and size on transform end', () => {
    store.loadSector('sector-1');
    vi.runAllTicks();

    store.rotateElement('elem-1', 45);
    store.resizeElement('elem-1', 120, 120, 120, 120);

    store.flushDebouncedPersist();
    vi.runAllTicks();

    expect(mockApi.updateSpaceElement).toHaveBeenCalledWith('sector-1', 'elem-1', {
      type: 'TABLE',
      x: 120, // position updated by resizeElement
      y: 120,
      width: 120,
      height: 120,
      rotation: 45,
    });
  });

  it('should expose sectorId signal', () => {
    expect(store.sectorId()).toBeNull();
    store.loadSector('sector-1');
    expect(store.sectorId()).toBe('sector-1');
  });

  it('should clear error', () => {
    mockApi.listSpaceElementsBySector.mockReturnValueOnce(throwError(() => ({ status: 500 })));
    store.loadSector('sector-1');
    vi.runAllTicks();
    expect(store.error()).toBeTruthy();

    store.clearError();
    expect(store.error()).toBeNull();
  });
});
