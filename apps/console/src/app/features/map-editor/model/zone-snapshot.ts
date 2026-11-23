import type { MapLayout } from '@mapit/map-engine';

export function zoneSnapshot(layout: MapLayout, zoneId: string | null): MapLayout | null {
  const zone = layout.elements.find(({ id, type }) => id === zoneId && type === 'SECTOR_ZONE');
  if (!zone) return null;
  const angle = (-zone.rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const elements = layout.elements.flatMap((item) => {
    if (item.type === 'SECTOR_ZONE') return [];
    const dx = item.position.x - zone.position.x;
    const dy = item.position.y - zone.position.y;
    const position = { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
    const rotation = item.rotation - zone.rotation;
    const radians = (rotation * Math.PI) / 180;
    const halfWidth = item.size.width / 2;
    const halfHeight = item.size.height / 2;
    const centerX = position.x + halfWidth * Math.cos(radians) - halfHeight * Math.sin(radians);
    const centerY = position.y + halfWidth * Math.sin(radians) + halfHeight * Math.cos(radians);
    return centerX >= 0 && centerY >= 0 && centerX <= zone.size.width && centerY <= zone.size.height
      ? [{ ...item, position, rotation }]
      : [];
  });
  return { ...layout, name: zone.label, size: zone.size, elements };
}
