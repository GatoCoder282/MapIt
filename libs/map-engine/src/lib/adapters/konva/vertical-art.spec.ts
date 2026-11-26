import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpaceElement } from '../../map-layout.model';
import { furnitureFinish } from './operational-art';

function element(type: SpaceElement['type'], variant: string): SpaceElement {
  return {
    id: 'element',
    type,
    label: 'Element',
    position: { x: 0, y: 0 },
    size: { width: 100, height: 100 },
    rotation: 0,
    capacity: null,
    reservable: false,
    state: 'AVAILABLE',
    attributes: { finishVariant: variant },
  };
}

describe('vertical furniture', () => {
  beforeEach(() => {
    const context = new Proxy(
      { getImageData: () => ({ data: new Uint8ClampedArray(4) }) },
      {
        get: (target, key): unknown => Reflect.get(target, key) ?? (() => {}),
      },
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    );
  });
  afterEach(() => vi.restoreAllMocks());
  it('renders beds matching single, double and twin configurations', () => {
    const single = furnitureFinish(element('ROOM', 'room-single'), false)!;
    const double = furnitureFinish(element('ROOM', 'room-double'), false)!;
    const twin = furnitureFinish(element('ROOM', 'room-twin'), false)!;
    expect(single.find('.bed')).toHaveLength(1);
    expect(twin.find('.bed')).toHaveLength(2);
    expect(Number(double.findOne('.bed')!.getAttr('width'))).toBeGreaterThan(
      Number(single.findOne('.bed')!.getAttr('width')),
    );
    single.destroy();
    double.destroy();
    twin.destroy();
  });
  it('keeps lounge furniture, sound equipment and plants visually distinct', () => {
    const lounge = furnitureFinish(element('TABLE', 'lounge'), false)!;
    const speaker = furnitureFinish(element('DECOR', 'speaker'), false)!;
    const plant = furnitureFinish(element('DECOR', 'foliage'), false)!;
    expect(lounge.find('.sofa')).toHaveLength(2);
    expect(lounge.find('.lounge-table')).toHaveLength(1);
    expect(speaker.find('.speaker')).toHaveLength(1);
    expect(speaker.find('Path')).toHaveLength(0);
    expect(plant.find('Path').length).toBeGreaterThan(0);
    lounge.destroy();
    speaker.destroy();
    plant.destroy();
  });
  it('renders DJ controls and numbered-seat furniture rather than generic rectangles', () => {
    const dj = furnitureFinish(element('STAGE', 'dj'), false)!;
    const chair = furnitureFinish(element('SEAT', 'chair'), false)!;
    const dance = furnitureFinish(element('SECTOR_ZONE', 'dance-floor'), false)!;
    expect(dj.find('.console')).toHaveLength(1);
    expect(dj.find('Circle')).toHaveLength(2);
    expect(chair.find('.chair-back')).toHaveLength(1);
    expect(dance.find('.dance-tile')).toHaveLength(16);
    dj.destroy();
    chair.destroy();
    dance.destroy();
  });
});
