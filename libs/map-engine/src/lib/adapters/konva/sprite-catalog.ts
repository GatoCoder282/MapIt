import type { Point, Size, SpaceElement, SpaceElementType } from '../../map-layout.model';

const ROOT = '/assets/map/sprites/';
const RESOURCE_PATH =
  /^v1\/(?:furniture|architecture|decor|floors|icons)\/[a-z0-9][a-z0-9-]*\.(?:webp|png|svg)$/;

export interface SpriteResource {
  id: string;
  category: 'furniture' | 'architecture' | 'decor' | 'floors' | 'icons';
  path: string;
  version: number;
  originalSize: Size;
  aspectRatio: number;
  anchor: Point;
  defaultSize: Size;
  elementType: SpaceElementType;
  verticals: string[];
  variants?: Record<string, string>;
}

function isSprite(value: unknown): value is SpriteResource {
  if (!value || typeof value !== 'object') return false;
  const sprite = value as Partial<SpriteResource>;
  return (
    typeof sprite.id === 'string' &&
    typeof sprite.path === 'string' &&
    RESOURCE_PATH.test(sprite.path) &&
    sprite.version === 1 &&
    typeof sprite.aspectRatio === 'number' &&
    Number.isFinite(sprite.aspectRatio) &&
    sprite.aspectRatio > 0 &&
    sprite.aspectRatio < 100 &&
    typeof sprite.anchor?.x === 'number' &&
    sprite.anchor.x >= 0 &&
    sprite.anchor.x <= 1 &&
    typeof sprite.anchor.y === 'number' &&
    sprite.anchor.y >= 0 &&
    sprite.anchor.y <= 1 &&
    Array.isArray(sprite.verticals)
  );
}

export class SpriteCatalog {
  private readonly lifetime = new AbortController();
  private readonly images = new Map<string, Promise<HTMLImageElement | null>>();
  private sprites: readonly SpriteResource[] = [];

  async load(): Promise<void> {
    try {
      const response = await fetch(ROOT + 'manifest.json', { signal: this.lifetime.signal });
      if (!response.ok) return;
      const manifest = (await response.json()) as { version?: number; sprites?: unknown[] };
      if (manifest.version === 1 && Array.isArray(manifest.sprites)) {
        this.sprites = manifest.sprites.filter(isSprite);
      }
    } catch {
      // The map remains usable when the catalog is missing or malformed.
    }
  }

  lookup(element: SpaceElement, vertical: string | undefined): SpriteResource | undefined {
    const matches = (sprite: SpriteResource) =>
      sprite.elementType === element.type &&
      (!sprite.verticals.length || (vertical !== undefined && sprite.verticals.includes(vertical)));
    const id = element.attributes['spriteId'];
    return (
      this.sprites.find((sprite) => sprite.id === id && matches(sprite)) ??
      this.sprites.find((sprite) => matches(sprite) && sprite.verticals.length > 0) ??
      this.sprites.find(matches)
    );
  }

  image(path: string): Promise<HTMLImageElement | null> {
    if (!RESOURCE_PATH.test(path) || this.lifetime.signal.aborted) return Promise.resolve(null);
    const existing = this.images.get(path);
    if (existing) return existing;
    const pending = new Promise<HTMLImageElement | null>((resolve) => {
      const image = new Image();
      const finish = (result: HTMLImageElement | null) => {
        this.lifetime.signal.removeEventListener('abort', abort);
        image.onload = null;
        image.onerror = null;
        resolve(result);
      };
      const abort = () => {
        finish(null);
        image.removeAttribute('src');
      };
      image.onload = () => finish(image);
      image.onerror = () => finish(null);
      this.lifetime.signal.addEventListener('abort', abort, { once: true });
      image.src = ROOT + path;
    });
    this.images.set(path, pending);
    return pending;
  }

  destroy(): void {
    this.lifetime.abort();
    this.images.clear();
    this.sprites = [];
  }
}
