import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FeatureFlagService, provideFeatureFlags } from '@mapit/feature-flags';
import { signal } from '@angular/core';
import { afterEach, expect, it, vi } from 'vitest';
import { STRINGS } from '../../../core/strings';
import { SpacesStore } from '../../../core/establishment-structure/spaces-store';
import { SectorListComponent } from './sector-list';

afterEach(() => {
  TestBed.resetTestingModule();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('el proxy controla el enlace del editor y la lista de sectores sin recargar', async () => {
  vi.useFakeTimers();
  const loadSectorsByFloor = vi.fn();
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        toggles: [
          { name: 'spaces.sectors', enabled: true },
          { name: 'map-editor.enabled', enabled: false },
        ],
      }),
  });
  vi.stubGlobal('fetch', fetchMock);
  TestBed.configureTestingModule({
    imports: [SectorListComponent],
    providers: [
      provideRouter([]),
      provideFeatureFlags({ intervaloRefrescoMs: 100 }),
      {
        provide: SpacesStore,
        useValue: {
          strings_: STRINGS.spaces,
          saving: signal(false),
          sectorsByFloorId: () => [{ id: 'sector-1', name: 'Salón' }],
          sectorsLoading: () => false,
          loadSectorsByFloor,
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(SectorListComponent);
  fixture.componentRef.setInput('floorId', 'floor-1');
  fixture.componentRef.setInput('floorName', 'Planta');
  fixture.detectChanges();
  await vi.advanceTimersByTimeAsync(0);
  TestBed.tick();
  const host = fixture.nativeElement as HTMLElement;
  expect(host.querySelector('a')).toBeNull();
  expect(host.textContent).toContain('Salón');
  fetchMock.mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        toggles: [
          { name: 'spaces.sectors', enabled: true },
          { name: 'map-editor.enabled', enabled: true },
        ],
      }),
  });
  await vi.advanceTimersByTimeAsync(100);
  TestBed.tick();
  expect(host.querySelector('a')?.getAttribute('href')).toContain('/spaces/editor/sector-1');
  expect(host.querySelector('a')?.getAttribute('aria-label')).toContain('Salón');
  fetchMock.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ toggles: [{ name: 'spaces.sectors', enabled: false }] }),
  });
  await vi.advanceTimersByTimeAsync(100);
  TestBed.tick();
  expect(TestBed.inject(FeatureFlagService).isEnabledNow('spaces.sectors')).toBe(false);
  expect(host.querySelector('a')).toBeNull();
  expect(host.textContent?.trim()).toBe('');

  loadSectorsByFloor.mockClear();
  fixture.componentRef.setInput('floorId', 'floor-2');
  TestBed.tick();
  expect(loadSectorsByFloor).not.toHaveBeenCalled();

  fetchMock.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ toggles: [{ name: 'spaces.sectors', enabled: true }] }),
  });
  await vi.advanceTimersByTimeAsync(100);
  TestBed.tick();
  expect(loadSectorsByFloor).toHaveBeenCalledExactlyOnceWith('floor-2');
  expect(host.textContent).toContain('Salón');
});
