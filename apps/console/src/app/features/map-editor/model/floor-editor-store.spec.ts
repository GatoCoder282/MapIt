import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, throwError } from 'rxjs';

import { FloorEditorStore } from './floor-editor-store';
import { MapEditorApiService } from '../data/map-editor-api';
import type { FloorLayoutResponse } from '@mapit/api-client';

const NOW = '2026-10-12T10:00:00Z';

const LAYOUT_RESPONSE: FloorLayoutResponse = {
  floor: {
    id: 'floor-1',
    name: 'Planta Baja',
    level: 0,
    canvasWidth: 1200,
    canvasHeight: 800,
    createdAt: NOW,
    updatedAt: NOW,
  } as FloorLayoutResponse['floor'],
  sectors: [
    {
      id: 'sector-1',
      name: 'Salón',
      x: 10,
      y: 10,
      rotation: 0,
      width: 400,
      height: 300,
      createdAt: NOW,
      updatedAt: NOW,
      elements: [
        {
          id: 'elem-1',
          sectorId: 'sector-1',
          type: 'TABLE',
          x: 20,
          y: 20,
          width: 80,
          height: 80,
          rotation: 0,
          state: 'AVAILABLE',
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    } as FloorLayoutResponse['sectors'][number],
  ],
};

const createMockApi = () => ({
  getFloorLayout: vi.fn(() => of(LAYOUT_RESPONSE)),
  saveFloorLayout: vi.fn(() => of(LAYOUT_RESPONSE)),
  duplicateSector: vi.fn(() =>
    of({
      sector: {
        id: 'sector-copy',
        name: 'Salón (copia)',
        slug: 'salon-copia',
        maxCapacity: 40,
        x: 0,
        y: 0,
        rotation: 0,
        width: 400,
        height: 300,
        createdAt: NOW,
        updatedAt: NOW,
      },
      elements: [],
    }),
  ),
});

describe('FloorEditorStore (HU-4.01)', () => {
  let store: FloorEditorStore;
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    mockApi = createMockApi();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        FloorEditorStore,
        { provide: MapEditorApiService, useValue: mockApi },
      ],
    });
    store = TestBed.inject(FloorEditorStore);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('carga el layout agregado en modo planta con sectores y elementos (CA-1)', () => {
    store.loadFloor('floor-1');
    vi.runAllTicks();

    expect(mockApi.getFloorLayout).toHaveBeenCalledWith('floor-1');
    const layout = store.layout();
    expect(layout.kind).toBe('floor');
    expect(layout.name).toBe('Planta Baja');
    expect(layout.size).toEqual({ width: 1200, height: 800 });
    expect(store.sectors()).toHaveLength(1);
    expect(store.sectors()[0]!.position).toEqual({ x: 10, y: 10 });
    expect(store.sectors()[0]!.children).toHaveLength(1);
    expect(store.loading()).toBe(false);
  });

  it('mueve un sector clampeando al lienzo y sin tocar sus elementos (RN-2)', () => {
    store.loadFloor('floor-1');
    vi.runAllTicks();

    store.moveSector('sector-1', 5000, -50);
    const moved = store.sectors()[0]!;
    expect(moved.position.x).toBe(800); // 1200 - 400
    expect(moved.position.y).toBe(0);
    // Los hijos (solo lectura en esta vista) no cambian
    expect(moved.children[0]!.position).toEqual({ x: 20, y: 20 });
    expect(store.dirty()).toBe(true);
  });

  it('guarda por lotes con versiones y limpia pendientes al éxito (RN-7)', () => {
    store.loadFloor('floor-1');
    vi.runAllTicks();

    store.moveSector('sector-1', 100, 50);
    store.rotateSector('sector-1', 90);
    store.saveLayout();
    vi.runAllTicks();

    expect(mockApi.saveFloorLayout).toHaveBeenCalledWith('floor-1', {
      floor: { canvasWidth: 1200, canvasHeight: 800, updatedAt: NOW },
      sectors: [{ id: 'sector-1', x: 100, y: 50, rotation: 90, updatedAt: NOW }],
    });
    expect(store.dirty()).toBe(false);
    expect(store.saving()).toBe(false);
  });

  it('un 409 marca los ids en conflicto sin perder el error visible (RN-7)', () => {
    mockApi.saveFloorLayout.mockReturnValueOnce(
      throwError(() => ({ status: 409, error: { conflictingIds: ['sector-1'] } })),
    );
    store.loadFloor('floor-1');
    vi.runAllTicks();

    store.moveSector('sector-1', 100, 50);
    store.saveLayout();
    vi.runAllTicks();

    expect(store.error()).toBeTruthy();
    expect(store.conflictingIds()).toEqual(['sector-1']);
    expect(store.dirty()).toBe(true); // el borrador local no se pierde
  });

  it('duplicateSector recarga y coloca la copia en el punto de drop (RN-5)', () => {
    store.loadFloor('floor-1');
    vi.runAllTicks();

    store.duplicateSector('sector-1', 300, 200);
    vi.runAllTicks();

    expect(mockApi.duplicateSector).toHaveBeenCalledWith('floor-1', {
      sourceSectorId: 'sector-1',
    });
    // Tras el duplicado se recarga (mocks idempotentes devuelven el mismo layout) y
    // se intenta guardar la colocación desde el drop.
    expect(mockApi.saveFloorLayout).toHaveBeenCalled();
  });
});
