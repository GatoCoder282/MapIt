import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, type Route } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthSession } from '@mapit/auth';
import { FeatureFlagService, provideFeatureFlags } from '@mapit/feature-flags';
import { afterEach, expect, it, vi } from 'vitest';
import { routes } from './app.routes';

@Component({ template: '<p>Route loaded</p>' })
class RouteHost {}

const operationalRoutes = routes.find(
  (route) => route.canActivate?.length && route.path === '',
)!.children!;
const spaceRoutes = operationalRoutes.find((route) => route.path === 'spaces')!.children!;

afterEach(() => {
  TestBed.resetTestingModule();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it.each([
  ['map', '/map', 'operations.space-monitor'],
  ['floors/:establishmentId', '/floors/est-1', 'spaces.floors'],
  ['floors/:floorId/sectors', '/floors/floor-1/sectors', 'spaces.sectors'],
  ['editor', '/editor', 'map-editor.enabled'],
  ['editor/:sectorId', '/editor/sector-1', 'map-editor.enabled'],
])('la ruta %s permite ON y redirige OFF con los guards reales', async (path, url, flag) => {
  vi.useFakeTimers();
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ toggles: [{ name: flag, enabled: true }] }),
  });
  vi.stubGlobal('fetch', fetchMock);
  const route = [...operationalRoutes, ...spaceRoutes].find(
    (candidate) => candidate.path === path,
  )!;
  const testRoute: Route = {
    path: route.path!,
    canActivate: route.canActivate!,
    component: RouteHost,
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([testRoute, { path: 'home', component: RouteHost }]),
      provideFeatureFlags({ intervaloRefrescoMs: 100 }),
      { provide: AuthSession, useValue: { user: () => ({ role: 'ADMIN' }) } },
    ],
  });
  TestBed.inject(FeatureFlagService);
  TestBed.tick();
  await vi.advanceTimersByTimeAsync(0);
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url, RouteHost);
  expect(TestBed.inject(Router).url).toBe(url);
  await harness.navigateByUrl('/home', RouteHost);
  fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ toggles: [] }) });
  await vi.advanceTimersByTimeAsync(100);
  await harness.navigateByUrl(url, RouteHost);
  expect(TestBed.inject(Router).url).toBe('/home');
});

it('conserva piso, sector y fragmento del enlace anterior de monitoreo', async () => {
  const monitor = spaceRoutes.find((route) => route.path === 'monitor')!;
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'spaces', children: [monitor] },
        { path: 'map', component: RouteHost },
      ]),
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl('/spaces/monitor?floorId=f1&sectorId=s1#table', RouteHost);
  expect(TestBed.inject(Router).url).toBe('/map?floorId=f1&sectorId=s1#table');
});

it.each(['/spaces/structure/floor-1', '/spaces/floors/floor-1/editor'])(
  'opens the shared editor from %s and preserves its floor and sector',
  async (url) => {
    const structure = spaceRoutes.find((route) => route.path === 'structure')!;
    const legacyFloor = spaceRoutes.find((route) => route.path === 'floors/:floorId/editor')!;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'spaces',
            children: [
              {
                path: 'structure',
                children: structure.children!.filter((route) => route.redirectTo),
              },
              legacyFloor,
              { path: 'editor', component: RouteHost },
            ],
          },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url + '?sectorId=sector-1', RouteHost);
    expect(TestBed.inject(Router).url).toBe('/spaces/editor?floorId=floor-1&sectorId=sector-1');
  },
);
