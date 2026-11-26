import type { Point, Size } from './map-layout.model';

function rotatedBounds(size: Size, rotation: number) {
  const radians = (rotation * Math.PI) / 180;
  const sin = Math.sin(radians);
  const cos = Math.cos(radians);
  const across = size.width * cos;
  const down = size.height * sin;
  const right = size.width * sin;
  const below = size.height * cos;
  const xs = [0, across, -down, across - down];
  const ys = [0, right, below, right + below];
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys),
  };
}

export function constrainPlacement(
  point: Point,
  size: Size,
  bounds: Size,
  rotation: number,
): Point {
  const { left, right, top, bottom } = rotatedBounds(size, rotation);
  return {
    x: Math.max(0, -left, Math.min(point.x, bounds.width - right)),
    y: Math.max(0, -top, Math.min(point.y, bounds.height - bottom)),
  };
}

export function placementFits(point: Point, size: Size, bounds: Size, rotation: number): boolean {
  const { left, right, top, bottom } = rotatedBounds(size, rotation);
  const tolerance = 1e-6;
  return (
    point.x + left >= -tolerance &&
    point.y + top >= -tolerance &&
    point.x + right <= bounds.width + tolerance &&
    point.y + bottom <= bounds.height + tolerance
  );
}
