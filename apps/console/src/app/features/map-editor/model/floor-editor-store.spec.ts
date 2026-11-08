import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';

import { FloorEditorStore } from './floor-editor-store';
import { MapEditorApiService } from '../data/map-editor-api';
import type { FloorLayoutResponse } from '@mapit/api-client';
import { EstablishmentContext } from '../../../core/establishment-context';

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
  listFloorsByEstablishment: vi.fn(() => of([{ id: 'floor-1' }])),
  listSectorsByFloor: vi.fn(() => of([{ id: 'sector-A' }])),
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
  let active: ReturnType<typeof signal<{ id: string } | null>>;

  beforeEach(() => {
    mockApi = createMockApi();
    active = signal<{ id: string } | null>({ id: 'est-1' });
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        FloorEditorStore,
        { provide: MapEditorApiService, useValue: mockApi },
        {
          provide: EstablishmentContext,
          useValue: { active: () => active(), status: () => 'ready' },
        },
      ],
    });
    store = TestBed.inject(FloorEditorStore);
    TestBed.flushEffects();
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

  it('rechaza una planta ajena antes de solicitar su layout', () => {
    mockApi.listFloorsByEstablishment.mockReturnValueOnce(of([]));
    store.loadFloor('foreign-floor');
    expect(mockApi.getFloorLayout).not.toHaveBeenCalled();
    expect(store.floorId()).toBeNull();
  });

  it('ignora la validación tardía de una ruta anterior y no permite escribir antes de validar', () => {
    const staleFloors = new Subject<Array<{ id: string }>>();
    mockApi.listFloorsByEstablishment.mockReturnValueOnce(staleFloors);
    store.loadFloor('old-floor');
    store.saveLayout();
    store.duplicateSector('sector-1');
    expect(mockApi.saveFloorLayout).not.toHaveBeenCalled();
    expect(mockApi.duplicateSector).not.toHaveBeenCalled();

    store.loadFloor('floor-1');
    expect(store.layout().name).toBe('Planta Baja');
    staleFloors.next([{ id: 'old-floor' }]);
    expect(store.layout().name).toBe('Planta Baja');
    expect(store.floorId()).toBe('floor-1');
  });

  it('busy remains true until every layout write completes', () => {
    const first = new Subject<FloorLayoutResponse>();
    mockApi.saveFloorLayout.mockReturnValueOnce(first);
    store.loadFloor('floor-1');
    store.moveSector('sector-1', 50, 50);
    store.saveLayout();
    store.moveSector('sector-1', 60, 60);
    store.saveLayout();
    expect(store.sectors()[0]!.position).toEqual({ x: 50, y: 50 });
    expect(store.busy()).toBe(true);
    first.complete();
    expect(store.busy()).toBe(false);
    expect(mockApi.saveFloorLayout).toHaveBeenCalledTimes(1);
  });

  it('clears establishment A library before immediately loading a floor in B', () => {
    store.loadLibrary('est-1');
    expect(store.librarySectors().map((sector) => sector.id)).toContain('sector-A');
    active.set({ id: 'est-2' });
    store.loadFloor('floor-1');
    expect(store.librarySectors()).toEqual([]);
    store.duplicateSector('sector-A');
    expect(mockApi.duplicateSector).not.toHaveBeenCalled();
  });

  it('keeps duplicate busy through the layout reload and placement save', () => {
    store.loadFloor('floor-1');
    const reload = new Subject<FloorLayoutResponse>();
    mockApi.getFloorLayout.mockReturnValueOnce(reload);
    store.duplicateSector('sector-1');
    expect(store.busy()).toBe(true);
    reload.next(LAYOUT_RESPONSE);
    expect(mockApi.saveFloorLayout).toHaveBeenCalled();
    expect(store.busy()).toBe(true);
    reload.complete();
    expect(store.busy()).toBe(false);
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

  it('floor dirty returns to the loaded baseline when placement and canvas are reverted', () => {
    store.loadFloor('floor-1');
    expect(store.dirty()).toBe(false);
    store.moveSector('sector-1', 100, 100);
    expect(store.dirty()).toBe(true);
    store.moveSector('sector-1', 10, 10);
    expect(store.dirty()).toBe(false);
    store.resizeCanvas(1300, 900);
    expect(store.dirty()).toBe(true);
    store.resizeCanvas(1200, 800);
    expect(store.dirty()).toBe(false);
  });

  it('guarda por lotes con versiones y limpia pendientes al éxito (RN-7)', () => {
    store.loadFloor('floor-1');
    vi.runAllTicks();

    store.moveSector('sector-1', 100, 50);
    store.rotateSector('sector-1', 90);
    expect(store.dirty()).toBe(true);
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
