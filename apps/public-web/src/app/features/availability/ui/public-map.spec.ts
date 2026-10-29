import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MAP_ENGINE } from '@mapit/map-engine';
import { publicMapFixture } from '../../../core/public-map.fixture';
import { publicMapLayout } from '../data/public-map-layout';
import { PublicMap } from './public-map';

describe('PublicMap lifecycle and selection', () => {
  let click: (payload: { id: string | null }) => void;
  const port = {
    mount: vi.fn(),
    load: vi.fn(),
    destroy: vi.fn(),
    setEditable: vi.fn(),
    setSelectedElement: vi.fn(),
    selectedElement: signal<string | null>(null),
    onElementClick: vi.fn((cb: (payload: { id: string | null }) => void) => {
      click = cb;
    }),
  };
  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [PublicMap],
      providers: [{ provide: MAP_ENGINE, useValue: port }],
    });
  });
  afterEach(() => TestBed.resetTestingModule());
  it('mounts readonly, syncs keyboard/list ID, loads without remount and destroys once', async () => {
    const fixture = TestBed.createComponent(PublicMap);
    const map = publicMapFixture();
    fixture.componentRef.setInput(
      'layout',
      publicMapLayout(map.floors[0]!, map.floors[0]!.sectors[0]!),
    );
    fixture.componentRef.setInput('selectedId', 'space-a');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(port.setEditable.mock.invocationCallOrder[0]).toBeLessThan(
      port.mount.mock.invocationCallOrder[0]!,
    );
    expect(port.setSelectedElement).toHaveBeenLastCalledWith('space-a');
    fixture.componentRef.setInput('selectedId', 'space-b');
    fixture.detectChanges();
    expect(port.setSelectedElement).toHaveBeenLastCalledWith('space-b');
    expect(port.load).not.toHaveBeenCalled();
    fixture.componentRef.setInput(
      'layout',
      publicMapLayout(map.floors[0]!, map.floors[0]!.sectors[1]!),
    );
    fixture.detectChanges();
    expect(port.mount).toHaveBeenCalledOnce();
    expect(port.load).toHaveBeenCalledOnce();
    fixture.destroy();
    expect(port.destroy).toHaveBeenCalledOnce();
  });
  it('emits the same eligible ID on click and reverts blocked IDs without changing availability', () => {
    const fixture = TestBed.createComponent(PublicMap);
    const map = publicMapFixture();
    fixture.componentRef.setInput(
      'layout',
      publicMapLayout(map.floors[0]!, map.floors[0]!.sectors[0]!),
    );
    fixture.detectChanges();
    const selected = vi.fn();
    fixture.componentInstance.selected.subscribe(selected);
    click({ id: 'space-a' });
    expect(selected).toHaveBeenCalledWith('space-a');
    click({ id: 'reserved' });
    click({ id: 'unavailable' });
    expect(selected).toHaveBeenCalledTimes(1);
    expect(port.setSelectedElement).toHaveBeenLastCalledWith(null);
  });
});
