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

  it('renders the oval table model with rounded geometry and six seats', () => {
    engine.mount(host, {
      ...layout,
      elements: [
        { ...element, size: { width: 160, height: 100 }, attributes: { finishVariant: 'oval' } },
      ],
    });
    engine.setLayoutFinish(true);
    expect(node().findOne<Konva.Rect>('.shape')!.cornerRadius()).toBe(50);
    const artwork = node().findOne<Konva.Group>('.operational-art')!;
    expect(artwork.getChildren().filter((child) => child.getClassName() === 'Group')).toHaveLength(
      6,
    );
  });

  afterEach(() => {
    engine.destroy();
    host.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('keeps model coordinates stable through fit, zoom and external drop', () => {
    const onDrop = vi.fn();
    engine.mount(host, layout);
    engine.onExternalDrop(onDrop);
    engine.fitToViewport({ min: 0.1, max: 2 });
    const center = { x: 200, y: 150 };
    expect(engine.viewportToModel(center)).toEqual(center);
    engine.zoomBy(3);
    expect(engine.zoom()).toBe(2);
    expect(engine.viewportToModel(center)).toEqual(center);
    const event = new MouseEvent('drop', { clientX: 120, clientY: 130, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: { getData: () => 'base:TABLE' } });
    host.dispatchEvent(event);
    expect(onDrop).toHaveBeenCalledWith({ key: 'base:TABLE', x: 160, y: 140 });
    const table = node();
    const dragBound = table.dragBoundFunc();
    const limited = dragBound.call(table, { x: 600, y: 600 }, new Event('pointermove'));
    expect(engine.viewportToModel(limited)).toEqual({ x: 320, y: 220 });
    expect(engine.exportLayout()).toEqual(layout);
    engine.setPanning(true);
    expect(table.draggable()).toBe(false);
    engine.setPanning(false);
    expect(table.draggable()).toBe(true);
  });

  it('draws the editor finish and refreshes the capacity badge on the same element', () => {
    engine.mount(host, layout);
    engine.setLayoutFinish(true);
    expect(node().findOne('.operational-art')).toBeDefined();
    expect(node().findOne('.state-marker')).toBeUndefined();
    expect(node().findOne('.capacity-text')).toBeUndefined();
    engine.load({ ...layout, elements: [{ ...element, capacity: 4 }] });
    const capacity = () => node().findOne<Konva.Text>('.capacity-text');
    expect(capacity()?.text()).toBe('4');
    engine.load({ ...layout, elements: [{ ...element, capacity: 6 }] });
    expect(capacity()?.text()).toBe('6');
    engine.load(layout);
    expect(capacity()).toBeUndefined();
  });

  it('applies advanced label preferences without changing the operational element', () => {
    const table = { ...element, capacity: 4, attributes: { mapLabelStyle: 'outline' } };
    engine.mount(host, { ...layout, elements: [table] });
    engine.setLayoutFinish(true);
    expect(node().findOne('.editor-label-bg')).toBeDefined();
    engine.setSelectedElement(table.id);
    expect(node().findOne<Konva.Rect>('.pill-bg')?.fill()).toBe('#ffffff');

    const hidden = {
      ...table,
      attributes: { ...table.attributes, showMapName: false, showMapCapacity: false },
    };
    engine.load({ ...layout, elements: [hidden] });
    expect(node().findOne('.label')?.visible()).toBe(false);
    expect(node().findOne('.editor-label-bg')).toBeUndefined();
    expect(node().findOne('.name-pill')).toBeUndefined();
    expect(node().findOne('.capacity-text')).toBeUndefined();
    expect(engine.exportLayout().elements[0]).toMatchObject({ capacity: 4, state: 'AVAILABLE' });
  });

  it('renders the stored zone border, fill and label position while selected', () => {
    const zone: SpaceElement = {
      ...element,
      type: 'SECTOR_ZONE',
      reservable: false,
      capacity: null,
      attributes: {
        finishVariant: 'rounded',
        finishColor: '#93c5fd',
        fillOpacity: 50,
        cornerRadius: 18,
        zoneBorder: 'dashed',
        zoneBorderColor: '#388556',
        mapLabelPosition: 'top',
      },
    };
    engine.mount(host, { ...layout, elements: [zone] });
    engine.setLayoutFinish(true);
    engine.setSelectedElement(zone.id);
    const shape = node().findOne<Konva.Rect>('.shape')!;
    expect(shape.fill()).toBe('#93c5fd80');
    expect(shape.cornerRadius()).toBe(18);
    expect(shape.dash()).toEqual([7, 5]);
    expect(node().findOne('.label')?.getAttr('y')).toBe(8);
    engine.setSelectedElement(null);
    expect(shape.stroke()).toBe('#388556');
    expect(engine.exportLayout().elements[0]?.position).toEqual(zone.position);
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
