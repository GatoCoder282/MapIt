import type { SpaceElement } from '../../map-layout.model';
import { SpriteCatalog, type SpriteResource } from './sprite-catalog';

const table: SpriteResource = {
  id: 'table-round',
  category: 'furniture',
  path: 'v1/furniture/table-round.webp',
  version: 1,
  originalSize: { width: 256, height: 256 },
  aspectRatio: 1,
  anchor: { x: 0.5, y: 0.5 },
  defaultSize: { width: 80, height: 80 },
  elementType: 'TABLE',
  verticals: [],
};
const element: SpaceElement = {
  id: 'mesa',
  type: 'TABLE',
  label: 'Mesa',
  position: { x: 0, y: 0 },
  size: { width: 80, height: 80 },
  rotation: 0,
  state: 'AVAILABLE',
  capacity: 4,
  reservable: true,
  attributes: {},
};

afterEach(() => vi.unstubAllGlobals());

it('matches valid resources by type and vertical and falls back for unknown types', async () => {
  const restaurant = { ...table, id: 'restaurant-table', verticals: ['RESTAURANT'] };
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            version: 1,
            sprites: [{ ...table, path: '../outside.webp' }, table, restaurant],
          }),
      }),
    ),
  );
  const catalog = new SpriteCatalog();
  await catalog.load();
  expect(catalog.lookup(element, 'RESTAURANT')).toEqual(restaurant);
  expect(catalog.lookup(element, undefined)).toEqual(table);
  expect(catalog.lookup({ ...element, type: 'BAR' }, undefined)).toBeUndefined();
  catalog.destroy();
});

it('reuses image results, memoizes a broken asset and cancels on destroy', async () => {
  const graphic = {
    onload: null as (() => void) | null,
    onerror: null as (() => void) | null,
    removeAttribute: vi.fn(),
  };
  vi.stubGlobal(
    'Image',
    vi.fn(function () {
      return graphic;
    }),
  );
  const catalog = new SpriteCatalog();
  const first = catalog.image(table.path);
  expect(catalog.image(table.path)).toBe(first);
  graphic.onload?.();
  expect(await first).toBe(graphic);
  const broken = catalog.image('v1/furniture/broken.png');
  graphic.onerror?.();
  expect(await broken).toBeNull();
  expect(catalog.image('v1/furniture/broken.png')).toBe(broken);
  const pending = catalog.image('v1/furniture/pending.png');
  catalog.destroy();
  expect(await pending).toBeNull();
  expect(graphic.removeAttribute).toHaveBeenCalledWith('src');
});
