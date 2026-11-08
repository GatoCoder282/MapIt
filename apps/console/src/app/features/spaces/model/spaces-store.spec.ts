import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideZonelessChangeDetection } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of, Subject } from 'rxjs';
import type { Floor, Sector } from '@mapit/api-client';
import { SpacesStore } from './spaces-store';
import { SpacesApiService } from '../data/spaces-api';
import { EstablishmentContext } from '../../../core/establishment-context';

describe('SpacesStore operational establishment context', () => {
  let active: ReturnType<typeof signal<{ id: string; type: string } | null>>;
  let api: {
    listFloors: ReturnType<typeof vi.fn>;
    listSectorsByFloor: ReturnType<typeof vi.fn>;
    listSpaceElementsBySector: ReturnType<typeof vi.fn>;
    createEstablishment: ReturnType<typeof vi.fn>;
    createFloor: ReturnType<typeof vi.fn>;
    updateFloor: ReturnType<typeof vi.fn>;
    updateSector: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    active = signal<{ id: string; type: string } | null>({ id: 'A', type: 'RESTAURANT' });
    api = {
      listFloors: vi.fn(() => of([])),
      listSpaceElementsBySector: vi.fn(() => of([])),
      createFloor: vi.fn(() => of({} as Floor)),
      updateFloor: vi.fn(() => of({} as Floor)),
      listSectorsByFloor: vi.fn(() => of([])),
      updateSector: vi.fn(() => of({})),
      createEstablishment: vi.fn(() => of({ id: 'created', type: 'RESTAURANT' })),
    };
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        SpacesStore,
        { provide: SpacesApiService, useValue: api },
        {
          provide: EstablishmentContext,
          useValue: { active: () => active(), status: () => 'ready' },
        },
      ],
    });
  });

  it('derives active establishment and exposes dirty draft state', () => {
    const store = TestBed.inject(SpacesStore);
    TestBed.flushEffects();
    expect(store.establishmentId()).toBe('A');
    expect(api.listFloors).toHaveBeenCalledWith('A');
    expect(store.establishmentId()).toBe('A');
    expect(api.listFloors).toHaveBeenLastCalledWith('A');
    expect(store.dirty()).toBe(false);
    store.setFloorName('Planta nueva');
    expect(store.dirty()).toBe(true);
    store.startNewFloor();
    expect(store.dirty()).toBe(false);
  });

  it('clears scoped data and discards a stale floor response across A→B→A', () => {
    const first = new Subject<Floor[]>();
    api.listFloors.mockReturnValueOnce(first);
    const store = TestBed.inject(SpacesStore);
    TestBed.flushEffects();
    active.set({ id: 'B', type: 'HOTEL' });
    TestBed.flushEffects();
    active.set({ id: 'A', type: 'RESTAURANT' });
    TestBed.flushEffects();
    first.next([
      {
        id: 'stale',
        name: 'Stale',
        slug: 'stale',
        level: 0,
        createdAt: '',
        updatedAt: '',
        establishmentId: 'A',
      } as Floor,
    ]);
    expect(store.floors()).toEqual([]);
  });

  it('does not load resources while context is absent', () => {
    active.set(null);
    const store = TestBed.inject(SpacesStore);
    TestBed.flushEffects();
    store.loadFloors();
    expect(store.establishmentId()).toBeNull();
    expect(api.listFloors).not.toHaveBeenCalled();
  });

  it('keeps an unchanged edit clean and keeps busy until all writes complete', () => {
    const store = TestBed.inject(SpacesStore);
    TestBed.flushEffects();
    const floor = { id: 'floor-1', name: 'Ground', level: 0 } as Floor;
    api.listFloors.mockReturnValue(of([floor]));
    store.loadFloors();
    store.editFloor(floor);
    expect(store.dirty()).toBe(false);
    store.setFloorName('Changed');
    expect(store.dirty()).toBe(true);

    const first = new Subject<Floor>();
    const second = new Subject<Floor>();
    api.createFloor.mockReturnValueOnce(first).mockReturnValueOnce(second);
    store.startNewFloor();
    store.setFloorName('One');
    store.saveFloor();
    store.setFloorName('Two');
    store.saveFloor();
    expect(store.busy()).toBe(true);
    first.complete();
    expect(store.busy()).toBe(true);
    second.complete();
    expect(store.busy()).toBe(false);
  });

  it('ignores floor and sector write errors from a previous establishment', () => {
    const store = TestBed.inject(SpacesStore);
    TestBed.flushEffects();
    const floor = { id: 'floor-1', name: 'Ground', level: 0 } as Floor;
    api.listFloors.mockReturnValue(of([floor]));
    api.listSectorsByFloor.mockReturnValue(of([{ id: 'sector-1', name: 'Room' }]));
    store.loadFloors();
    store.loadSectorsByFloor('floor-1');

    const floorFailure = new Subject<Floor>();
    api.updateFloor.mockReturnValue(floorFailure);
    store.editFloor(floor);
    store.setFloorName('Changed');
    store.saveFloor();

    const sectorFailure = new Subject<never>();
    api.updateSector.mockReturnValue(sectorFailure);
    store.editSector({ id: 'sector-1', name: 'Room' } as Sector);
    store.saveSector('floor-1', 'Changed room').subscribe({ error: () => undefined });

    active.set({ id: 'B', type: 'HOTEL' });
    TestBed.flushEffects();
    floorFailure.error({ status: 500 });
    sectorFailure.error({ status: 500 });
    expect(store.error()).toBeNull();
    expect(store.busy()).toBe(false);
  });

  it('does not let save responses erase a newer floor or sector draft', () => {
    const store = TestBed.inject(SpacesStore);
    TestBed.flushEffects();
    const floor = { id: 'floor-1', name: 'Ground', level: 0 } as Floor;
    const sector = { id: 'sector-1', name: 'Room' } as Sector;
    api.listFloors.mockReturnValue(of([floor]));
    api.listSectorsByFloor.mockReturnValue(of([sector]));
    store.loadFloors();
    store.loadSectorsByFloor('floor-1');

    const floorSave = new Subject<Floor>();
    api.updateFloor.mockReturnValue(floorSave);
    store.editFloor(floor);
    store.setFloorName('Saved floor');
    store.saveFloor();
    store.startNewFloor();
    store.setFloorName('New floor draft');
    floorSave.next({ ...floor, name: 'Saved floor' });
    floorSave.complete();
    expect(store.floorDraft().name).toBe('New floor draft');

    const sectorSave = new Subject<Sector>();
    api.updateSector.mockReturnValue(sectorSave);
    store.editSector(sector);
    store.setSectorName('Saved sector');
    store.saveSector('floor-1', 'Saved sector').subscribe();
    store.startNewSector();
    store.setSectorName('New sector draft');
    sectorSave.next({ ...sector, name: 'Saved sector' });
    sectorSave.complete();
    expect(store.sectorDraft().name).toBe('New sector draft');
  });
});
