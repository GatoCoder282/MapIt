import { LAYOUT_VACIO, type SpaceElement } from '@mapit/map-engine';
import { describe, expect, it } from 'vitest';
import { zoneSnapshot } from './zone-snapshot';

const element = (
  id: string,
  type: SpaceElement['type'],
  x: number,
  y: number,
  rotation = 0,
): SpaceElement => ({
  id,
  type,
  label: id,
  position: { x, y },
  size: { width: 10, height: 10 },
  rotation,
  state: 'AVAILABLE',
  capacity: null,
  reservable: false,
  attributes: {},
});

describe('zoneSnapshot', () => {
  it('shows only the items inside a rotated zone without changing the floor', () => {
    const zone = {
      ...element('zone', 'SECTOR_ZONE', 100, 100, 90),
      size: { width: 80, height: 60 },
    };
    const inside = element('inside', 'TABLE', 80, 120, 90);
    const outside = element('outside', 'TABLE', 120, 120);
    const otherZone = element('other', 'SECTOR_ZONE', 85, 125);
    const layout = { ...LAYOUT_VACIO, elements: [zone, inside, outside, otherZone] };
    const preview = zoneSnapshot(layout, zone.id);
    expect(preview?.size).toEqual(zone.size);
    expect(preview?.elements.map(({ id }) => id)).toEqual(['inside']);
    expect(preview?.elements[0]?.position.x).toBeCloseTo(20);
    expect(preview?.elements[0]?.position.y).toBeCloseTo(20);
    expect(preview?.elements[0]?.rotation).toBe(0);
    expect(inside.position).toEqual({ x: 80, y: 120 });
    expect(zoneSnapshot(layout, 'missing')).toBeNull();
  });
});
