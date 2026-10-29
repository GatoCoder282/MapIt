/* eslint-disable no-restricted-imports */
import type Konva from 'konva';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MapLayout, SpaceElement } from '../../map-layout.model';
import { KonvaMapEngine } from './konva-map-engine';

const element: SpaceElement = {
  id: 'table-1',
  type: 'TABLE',
  label: 'Mesa 1',
  position: { x: 20, y: 20 },
  size: { width: 80, height: 80 },
  rotation: 0,
  state: 'AVAILABLE',
  availability: 'RESERVED',
  capacity: null,
  reservable: true,
  attributes: {},
};
const layout: MapLayout = {
  floorId: 'floor-1',
  name: 'Piso',
  size: { width: 400, height: 300 },
  elements: [element],
  schemaVersion: 1,
};

describe('KonvaMapEngine', () => {
  let engine: KonvaMapEngine;
  let host: HTMLDivElement;

  const layer = () => engine['elementsLayer']!;
  const node = (id = 'table-1') => layer().findOne<Konva.Group>(`#${id}`)!;

  beforeEach(() => {
    const context = new Proxy(
      {
        canvas: null as HTMLCanvasElement | null,
        measureText: () => ({ width: 30 }),
        createLinearGradient: () => ({ addColorStop() {} }),
        createRadialGradient: () => ({ addColorStop() {} }),
        createPattern: () => ({}),
        getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      },
      {
        get(target, key) {
          return (Reflect.get(target, key) as unknown) ?? (() => {});
        },
      },
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement,
    ) {
      context.canvas = this;
      return context as unknown as CanvasRenderingContext2D;
    });
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    TestBed.configureTestingModule({});
    engine = TestBed.inject(KonvaMapEngine);
    host = document.createElement('div');
    document.body.append(host);
    vi.spyOn(host, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      top: 0,
      left: 0,
      right: 400,
      bottom: 300,
      toJSON: () => ({}),
    });
  });

  afterEach(() => {
    engine.destroy();
    host.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('keeps readonly through mount and load, while programmatic selection does not click or edit', () => {
    const click = vi.fn();
    const drag = vi.fn();
    const rotate = vi.fn();
    const resize = vi.fn();
    engine.onElementClick(click);
    engine.onDragEnd(drag);
    engine.onRotateEnd(rotate);
    engine.onResizeEnd(resize);
    engine.setEditable(false);
    engine.mount(host, layout);
    engine.setSelectedElement('table-1');
    expect(engine.selectedElement()).toBe('table-1');
    expect(click).not.toHaveBeenCalled();
    expect(node().draggable()).toBe(false);
    expect(engine['transformer']!.visible()).toBe(false);
    expect(node().findOne<Konva.Rect>('.shape')!.fill()).toBe('#93c5fd');
    expect(engine.exportLayout().elements[0]?.state).toBe('AVAILABLE');
    const next = {
      ...layout,
      elements: [{ ...element, id: 'table-2', availability: 'UNAVAILABLE' as const }],
    };
    engine.load(next);
    expect(node('table-2').draggable()).toBe(false);
    engine.setSelectedElement('table-2');
    node('table-2').fire('dragstart');
    node('table-2').fire('dragend');
    engine['transformer']!.fire('transformend');
    expect([drag.mock.calls.length, rotate.mock.calls.length, resize.mock.calls.length]).toEqual([
      0, 0, 0,
    ]);
    expect(engine.exportLayout()).toEqual(next);
    engine.setSelectedElement('missing');
    expect(engine.selectedElement()).toBeNull();
    expect(node('table-2').findOne<Konva.Rect>('.shape')!.stroke()).toBe('#4b5563');
    engine.setElementState('table-2', 'OCCUPIED');
    expect(node('table-2').findOne<Konva.Rect>('.shape')!.stroke()).toBe('#4b5563');
    expect(engine.exportLayout().elements[0]?.availability).toBe('UNAVAILABLE');
    engine.setSelectedElement(null);
    engine.setEditable(true);
    expect(node('table-2').draggable()).toBe(true);
    engine.setSelectedElement('table-2');
    expect(engine['transformer']!.visible()).toBe(true);
    node('table-2').findOne<Konva.Rect>('.shape')!.fire('click', {}, true);
    expect(click).toHaveBeenCalledWith({ id: 'table-2' });
  });

  it('keeps floor sectors readonly on later loads, then restores editing and releases the host', () => {
    const sector = {
      id: 'sector-1',
      label: 'Sector',
      position: { x: 5, y: 5 },
      size: { width: 200, height: 150 },
      rotation: 0,
      children: [element],
    };
    const floor: MapLayout = {
      ...layout,
      kind: 'floor',
      elements: [],
      sectors: [sector],
    };
    const sectorDrag = vi.fn();
    const sectorRotate = vi.fn();
    const drop = vi.fn();
    engine.onSectorDragEnd?.(sectorDrag);
    engine.onSectorRotateEnd?.(sectorRotate);
    engine.onExternalDrop?.(drop);
    engine.mount(host, layout);
    engine.setEditable(false);
    engine.load(floor);
    expect(node('sector-1').draggable()).toBe(false);
    engine.load({ ...floor, sectors: [{ ...sector, id: 'sector-2' }] });
    expect(node('sector-2').draggable()).toBe(false);
    node('sector-2').findOne<Konva.Rect>('.shape')!.fire('click', {}, true);
    expect(engine['sectorTransformer']!.visible()).toBe(false);
    node('sector-2').fire('dragstart');
    node('sector-2').fire('dragend');
    engine['sectorTransformer']!.fire('transformend');
    expect(sectorDrag).not.toHaveBeenCalled();
    expect(sectorRotate).not.toHaveBeenCalled();
    engine.setEditable(true);
    expect(node('sector-2').draggable()).toBe(true);
    expect(engine['sectorTransformer']!.visible()).toBe(true);
    engine.destroy();
    host.dispatchEvent(new Event('drop'));
    expect(drop).not.toHaveBeenCalled();
    engine.destroy();
  });
});
