import type { EstablishmentType } from '@mapit/api-client';
import { TYPE_DEFAULTS, type Size, type SpaceElementType } from '@mapit/map-engine';
import { STRINGS } from '../../../core/strings';
import type { ElementFinish } from '../../../core/spatial-layout';

export interface ElementModel {
  key: string;
  type: SpaceElementType;
  label: string;
  size: Size;
  capacity: number | null;
  finish?: ElementFinish;
  category?: string;
  arrangement?: { rows: number; columns: number; gap: number };
}

// Mirrors SpaceElementTypePolicy; the backend remains authoritative at Save.
export function elementTypesFor(vertical: EstablishmentType | null): readonly SpaceElementType[] {
  if (!vertical) return [];
  if (vertical === 'HOTEL') return ['ROOM', 'DECOR'];
  const common: SpaceElementType[] = ['TABLE', 'BAR', 'DECOR', 'SECTOR_ZONE', 'STAGE'];
  return vertical === 'EVENT_HALL' ? [...common, 'SEAT'] : common;
}

export function genericModels(type: SpaceElementType): ElementModel[] {
  const strings = STRINGS.spaces.editor.style;
  const variants: Partial<Record<SpaceElementType, readonly string[]>> = {
    TABLE: ['round', 'square', 'rectangle', 'oval'],
    BAR: ['straight', 'lShape', 'island'],
    DECOR: ['foliage', 'planter', 'palm'],
    SECTOR_ZONE: ['rectangle', 'rounded'],
  };
  return (variants[type] ?? ['default']).map((variant, index) => {
    const wide = type === 'TABLE' && (variant === 'rectangle' || variant === 'oval');
    return {
      key: index === 0 ? `base:${type}` : `model:${type}:${variant}`,
      type,
      label:
        variant === 'default'
          ? STRINGS.spaces.elements.types[type]
          : strings[variant as keyof typeof strings],
      size: type === 'TABLE' ? { width: wide ? 160 : 100, height: 100 } : TYPE_DEFAULTS[type].size,
      capacity: wide ? 6 : TYPE_DEFAULTS[type].capacity,
      finish: {
        variant,
        ...(type === 'TABLE'
          ? {
              boardColor: '#f5d69a',
              color: '#5e605c',
              boardMaterial: 'solid',
              boardEdge: 'none',
              chairStyle: 'modern',
            }
          : {}),
        showName: true,
        showCapacity: true,
      },
    };
  });
}

interface ModelSpec {
  type: SpaceElementType;
  variant: string;
  size: Size;
  capacity: number | null;
}
const models = {
  vipRound: { type: 'TABLE', variant: 'vip-round', size: { width: 120, height: 120 }, capacity: 4 },
  vipRectangle: {
    type: 'TABLE',
    variant: 'vip-rectangle',
    size: { width: 180, height: 110 },
    capacity: 6,
  },
  highTable: { type: 'TABLE', variant: 'high-table', size: { width: 80, height: 80 }, capacity: 4 },
  booth: { type: 'TABLE', variant: 'booth', size: { width: 180, height: 160 }, capacity: 6 },
  reservedSofa: {
    type: 'TABLE',
    variant: 'reserved-sofa',
    size: { width: 180, height: 110 },
    capacity: 4,
  },
  lounge: { type: 'TABLE', variant: 'lounge', size: { width: 200, height: 160 }, capacity: 8 },
  danceFloor: {
    type: 'SECTOR_ZONE',
    variant: 'dance-floor',
    size: { width: 260, height: 240 },
    capacity: null,
  },
  dj: { type: 'STAGE', variant: 'dj', size: { width: 180, height: 80 }, capacity: null },
  stage: { type: 'STAGE', variant: 'stage', size: { width: 300, height: 120 }, capacity: null },
  platform: {
    type: 'STAGE',
    variant: 'platform',
    size: { width: 200, height: 100 },
    capacity: null,
  },
  control: { type: 'STAGE', variant: 'control', size: { width: 160, height: 80 }, capacity: null },
  sofa: { type: 'DECOR', variant: 'sofa', size: { width: 160, height: 70 }, capacity: null },
  armchair: { type: 'DECOR', variant: 'armchair', size: { width: 70, height: 70 }, capacity: null },
  partition: {
    type: 'DECOR',
    variant: 'partition',
    size: { width: 180, height: 25 },
    capacity: null,
  },
  speaker: { type: 'DECOR', variant: 'speaker', size: { width: 45, height: 65 }, capacity: null },
  screen: { type: 'DECOR', variant: 'screen', size: { width: 160, height: 30 }, capacity: null },
  entrance: {
    type: 'DECOR',
    variant: 'entrance',
    size: { width: 100, height: 40 },
    capacity: null,
  },
  emergencyExit: {
    type: 'DECOR',
    variant: 'emergency-exit',
    size: { width: 100, height: 40 },
    capacity: null,
  },
  restroom: {
    type: 'DECOR',
    variant: 'restroom',
    size: { width: 100, height: 100 },
    capacity: null,
  },
  stairs: { type: 'DECOR', variant: 'stairs', size: { width: 110, height: 150 }, capacity: null },
  elevator: {
    type: 'DECOR',
    variant: 'elevator',
    size: { width: 100, height: 100 },
    capacity: null,
  },
  wardrobe: {
    type: 'DECOR',
    variant: 'wardrobe',
    size: { width: 140, height: 70 },
    capacity: null,
  },
  security: {
    type: 'DECOR',
    variant: 'security',
    size: { width: 100, height: 70 },
    capacity: null,
  },
  roomSingle: {
    type: 'ROOM',
    variant: 'room-single',
    size: { width: 180, height: 160 },
    capacity: 1,
  },
  roomDouble: {
    type: 'ROOM',
    variant: 'room-double',
    size: { width: 200, height: 180 },
    capacity: 2,
  },
  roomTwin: { type: 'ROOM', variant: 'room-twin', size: { width: 220, height: 180 }, capacity: 2 },
  roomSuite: {
    type: 'ROOM',
    variant: 'room-suite',
    size: { width: 260, height: 220 },
    capacity: 2,
  },
  roomFamily: {
    type: 'ROOM',
    variant: 'room-family',
    size: { width: 280, height: 220 },
    capacity: 4,
  },
  roomAccessible: {
    type: 'ROOM',
    variant: 'room-accessible',
    size: { width: 240, height: 220 },
    capacity: 2,
  },
  reception: {
    type: 'DECOR',
    variant: 'reception',
    size: { width: 160, height: 70 },
    capacity: null,
  },
  lobby: { type: 'DECOR', variant: 'lobby', size: { width: 200, height: 160 }, capacity: null },
  meeting: { type: 'DECOR', variant: 'meeting', size: { width: 200, height: 160 }, capacity: null },
  conference: {
    type: 'DECOR',
    variant: 'conference',
    size: { width: 240, height: 180 },
    capacity: null,
  },
  pool: { type: 'DECOR', variant: 'pool', size: { width: 240, height: 160 }, capacity: null },
  gym: { type: 'DECOR', variant: 'gym', size: { width: 160, height: 120 }, capacity: null },
  spa: { type: 'DECOR', variant: 'spa', size: { width: 160, height: 140 }, capacity: null },
  recreation: {
    type: 'DECOR',
    variant: 'recreation',
    size: { width: 180, height: 140 },
    capacity: null,
  },
  cleaning: {
    type: 'DECOR',
    variant: 'cleaning',
    size: { width: 100, height: 100 },
    capacity: null,
  },
  storage: { type: 'DECOR', variant: 'storage', size: { width: 100, height: 100 }, capacity: null },
  diningTable: {
    type: 'DECOR',
    variant: 'dining-table',
    size: { width: 100, height: 100 },
    capacity: null,
  },
  hotelBar: {
    type: 'DECOR',
    variant: 'hotel-bar',
    size: { width: 200, height: 60 },
    capacity: null,
  },
  breakfast: {
    type: 'DECOR',
    variant: 'breakfast',
    size: { width: 200, height: 80 },
    capacity: null,
  },
  seat: { type: 'SEAT', variant: 'chair', size: { width: 40, height: 40 }, capacity: 1 },
  auditorium: { type: 'SEAT', variant: 'chair', size: { width: 40, height: 40 }, capacity: 1 },
  banquet: { type: 'TABLE', variant: 'round', size: { width: 100, height: 100 }, capacity: 8 },
  ceremony: {
    type: 'SECTOR_ZONE',
    variant: 'ceremony',
    size: { width: 220, height: 180 },
    capacity: null,
  },
  receptionArea: {
    type: 'SECTOR_ZONE',
    variant: 'reception-area',
    size: { width: 220, height: 160 },
    capacity: null,
  },
  activityArea: {
    type: 'SECTOR_ZONE',
    variant: 'activity-area',
    size: { width: 220, height: 180 },
    capacity: null,
  },
  corridor: {
    type: 'SECTOR_ZONE',
    variant: 'corridor',
    size: { width: 220, height: 70 },
    capacity: null,
  },
  auxiliaryTable: {
    type: 'DECOR',
    variant: 'auxiliary-table',
    size: { width: 60, height: 60 },
    capacity: null,
  },
  podium: { type: 'DECOR', variant: 'podium', size: { width: 60, height: 60 }, capacity: null },
  buffet: { type: 'DECOR', variant: 'buffet', size: { width: 180, height: 70 }, capacity: null },
  catering: {
    type: 'DECOR',
    variant: 'catering',
    size: { width: 200, height: 70 },
    capacity: null,
  },
  servicePoint: {
    type: 'DECOR',
    variant: 'service-point',
    size: { width: 120, height: 60 },
    capacity: null,
  },
  ornament: { type: 'DECOR', variant: 'ornament', size: { width: 60, height: 60 }, capacity: null },
} satisfies Record<string, ModelSpec>;
type ModelKey = keyof typeof models;
interface CategorySpec {
  key: keyof typeof STRINGS.spaces.editor.catalog.categories;
  models: readonly (ModelKey | SpaceElementType)[];
}
const definitions = {
  RESTAURANT: [
    { key: 'tables', models: ['TABLE'] },
    { key: 'bars', models: ['BAR'] },
    { key: 'decor', models: ['DECOR'] },
    { key: 'zonesStages', models: ['SECTOR_ZONE', 'STAGE'] },
  ],
  NIGHTCLUB: [
    {
      key: 'vip',
      models: ['vipRound', 'vipRectangle', 'highTable', 'booth', 'reservedSofa', 'lounge'],
    },
    { key: 'production', models: ['danceFloor', 'dj', 'stage', 'platform'] },
    { key: 'bars', models: ['BAR'] },
    { key: 'lounge', models: ['sofa', 'armchair', 'partition', 'DECOR', 'speaker'] },
    {
      key: 'access',
      models: ['entrance', 'emergencyExit', 'restroom', 'stairs', 'wardrobe', 'security'],
    },
  ],
  HOTEL: [
    {
      key: 'rooms',
      models: ['roomSingle', 'roomDouble', 'roomTwin', 'roomSuite', 'roomFamily', 'roomAccessible'],
    },
    { key: 'common', models: ['reception', 'lobby', 'sofa', 'armchair'] },
    { key: 'dining', models: ['diningTable', 'hotelBar', 'breakfast'] },
    { key: 'meetings', models: ['meeting', 'conference'] },
    { key: 'wellness', models: ['pool', 'gym', 'spa', 'recreation'] },
    {
      key: 'facilities',
      models: ['elevator', 'stairs', 'restroom', 'storage', 'cleaning', 'entrance', 'DECOR'],
    },
  ],
  EVENT_HALL: [
    { key: 'eventTables', models: ['TABLE', 'highTable', 'banquet'] },
    { key: 'seats', models: ['seat', 'auditorium'] },
    { key: 'eventProduction', models: ['stage', 'platform', 'control', 'dj', 'screen', 'speaker'] },
    { key: 'areas', models: ['danceFloor', 'receptionArea', 'ceremony', 'activityArea'] },
    { key: 'furniture', models: ['sofa', 'armchair', 'auxiliaryTable', 'podium'] },
    { key: 'catering', models: ['BAR', 'buffet', 'catering', 'servicePoint'] },
    { key: 'circulation', models: ['entrance', 'emergencyExit', 'corridor', 'stairs', 'restroom'] },
    { key: 'decor', models: ['DECOR', 'partition', 'ornament'] },
  ],
} satisfies Record<EstablishmentType, readonly CategorySpec[]>;

export function mapDefinition(vertical: EstablishmentType | null) {
  if (!vertical) return { categories: [], models: [] };
  const categories = definitions[vertical].map((group) => ({
    key: group.key,
    label: STRINGS.spaces.editor.catalog.categories[group.key],
  }));
  const catalog = definitions[vertical].flatMap((group) =>
    group.models.flatMap((key): ElementModel[] => {
      if (Object.hasOwn(TYPE_DEFAULTS, key))
        return genericModels(key as SpaceElementType).map((model) => ({
          ...model,
          category: group.key,
        }));
      const spec = models[key as ModelKey];
      const name = key as ModelKey;
      return [
        {
          key: 'model:' + (name === 'auditorium' || name === 'banquet' ? name : spec.variant),
          type: spec.type,
          label: STRINGS.spaces.editor.catalog.models[name],
          size: spec.size,
          capacity: spec.capacity,
          category: group.key,
          finish: {
            variant: spec.variant,
            ...(spec.type === 'TABLE'
              ? {
                  boardColor: vertical === 'NIGHTCLUB' ? '#d8b482' : '#f5d69a',
                  color: vertical === 'NIGHTCLUB' ? '#704495' : '#5e605c',
                  boardMaterial: 'solid',
                  boardEdge: 'none',
                  chairStyle: 'modern',
                }
              : {}),
            ...(spec.type === 'ROOM' ? { color: '#d8c6aa', boardColor: '#f4eee3' } : {}),
            showName: true,
            showCapacity: true,
          },
          ...(name === 'auditorium'
            ? { arrangement: { rows: 3, columns: 4, gap: 12 } }
            : name === 'banquet'
              ? { arrangement: { rows: 2, columns: 3, gap: 24 } }
              : {}),
        },
      ];
    }),
  );
  return {
    categories: categories.map((category) => ({
      ...category,
      type: catalog.find((model) => model.category === category.key)!.type,
    })),
    models: catalog,
  };
}
