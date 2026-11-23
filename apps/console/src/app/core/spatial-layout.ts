import type { SectorAppearance, SectorElementAppearance, SpaceElement } from '@mapit/api-client';
import {
  TYPE_DEFAULTS,
  type SpaceElement as LayoutElement,
  type RoomAppearance,
} from '@mapit/map-engine';
import { STRINGS } from './strings';

export function mapApiElementToLayoutElement(el: SpaceElement): LayoutElement {
  const defaults = TYPE_DEFAULTS[el.type] ?? TYPE_DEFAULTS.TABLE;
  return {
    id: el.id,
    type: el.type,
    label:
      el.name ?? el.label ?? STRINGS.spaces.elements.types[el.type] + ' · ' + el.id.slice(0, 6),
    position: { x: el.x, y: el.y },
    size: { width: el.width ?? defaults.size.width, height: el.height ?? defaults.size.height },
    rotation: el.rotation ?? 0,
    state: el.state,
    capacity: el.capacity ?? null,
    reservable: defaults.reservable,
    attributes: {},
  };
}

export type ElementFinish = Readonly<SectorElementAppearance>;

export function withElementFinish(element: LayoutElement, finish?: ElementFinish): LayoutElement {
  if (!finish) return element;
  const {
    color,
    variant,
    boardColor,
    boardMaterial,
    boardEdge,
    chairStyle,
    chairArms,
    showName,
    showCapacity,
    labelStyle,
  } = finish;
  return {
    ...element,
    attributes: {
      ...element.attributes,
      finishColor: color ?? '',
      finishVariant: variant ?? '',
      boardColor: boardColor ?? '',
      boardMaterial: boardMaterial ?? '',
      boardEdge: boardEdge ?? '',
      chairStyle: chairStyle ?? '',
      chairArms: chairArms ?? false,
      showMapName: showName ?? true,
      showMapCapacity: showCapacity ?? true,
      ...(labelStyle ? { mapLabelStyle: labelStyle } : {}),
      ...(finish.labelPosition ? { mapLabelPosition: finish.labelPosition } : {}),
      ...(finish.seatColor ? { seatColor: finish.seatColor } : {}),
      ...(finish.visualScale ? { visualScale: finish.visualScale } : {}),
      ...(finish.fillOpacity !== undefined ? { fillOpacity: finish.fillOpacity } : {}),
      ...(finish.cornerRadius !== undefined ? { cornerRadius: finish.cornerRadius } : {}),
      ...(finish.zoneBorder ? { zoneBorder: finish.zoneBorder } : {}),
      ...(finish.zoneBorderColor ? { zoneBorderColor: finish.zoneBorderColor } : {}),
    },
  };
}

export interface LayoutStyle {
  readonly room?: RoomAppearance;
  readonly elements: Readonly<Record<string, ElementFinish>>;
}

export const DEFAULT_ROOM_APPEARANCE: RoomAppearance = {
  floorColor: '#f1dfcd',
  wallColor: '#202d34',
  floorPattern: 'plain',
};

export function normalizeLayoutStyle(source?: SectorAppearance | null): LayoutStyle {
  const room = source?.room;
  const pattern = room?.floorPattern;
  const elements: Record<string, ElementFinish> = {};
  for (const id of Object.keys(source?.elements ?? {}).sort()) {
    const settings = source?.elements?.[id] ?? {};
    const fields = Object.entries(settings)
      .filter(([, value]) => value !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    if (fields.length) elements[id] = Object.fromEntries(fields);
  }
  return {
    ...(room
      ? {
          room: {
            floorColor: room.floorColor ?? DEFAULT_ROOM_APPEARANCE.floorColor,
            wallColor: room.wallColor ?? DEFAULT_ROOM_APPEARANCE.wallColor,
            floorPattern: pattern === 'tile' || pattern === 'wood' ? pattern : 'plain',
          },
        }
      : {}),
    elements,
  };
}
