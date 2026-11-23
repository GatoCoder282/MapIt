/* eslint-disable no-restricted-imports */
import Konva from 'konva';
import type { SpaceElement } from '../../map-layout.model';

/** Furniture uses the same 100 × 100 coordinate space as the restaurant finishes. */
export function verticalFurniture(element: SpaceElement): Konva.Group | null {
  const variant = String(element.attributes['finishVariant'] ?? '');
  const group = new Konva.Group({ name: 'operational-art', listening: false });
  const color =
    typeof element.attributes['finishColor'] === 'string' && element.attributes['finishColor']
      ? element.attributes['finishColor']
      : '#64748b';
  const board =
    typeof element.attributes['boardColor'] === 'string' && element.attributes['boardColor']
      ? element.attributes['boardColor']
      : '#e2e8f0';
  const rect = (x: number, y: number, width: number, height: number, fill = board, name = '') =>
    group.add(
      new Konva.Rect({
        x,
        y,
        width,
        height,
        fill,
        name,
        stroke: '#475569',
        strokeWidth: 1.5,
        cornerRadius: 4,
      }),
    );
  const line = (points: number[], stroke = color) =>
    group.add(
      new Konva.Line({ points, stroke, strokeWidth: 3, lineCap: 'round', lineJoin: 'round' }),
    );
  const circle = (x: number, y: number, radius: number, fill = color) =>
    group.add(new Konva.Circle({ x, y, radius, fill, stroke: '#475569', strokeWidth: 1.3 }));
  const sofa = (x: number, y: number, width: number, height: number) => {
    rect(x, y, width, height, color, 'sofa');
    rect(x + 5, y + 8, width - 10, height - 12, board);
    line([x + width / 2, y + 10, x + width / 2, y + height - 5]);
    rect(x - 2, y + 6, 7, height - 4, color);
    rect(x + width - 5, y + 6, 7, height - 4, color);
  };
  if (element.type === 'ROOM') {
    rect(4, 4, 92, 92, '#f8f1e8', 'room');
    line([4, 4, 96, 4, 96, 96, 68, 96]);
    line([4, 4, 4, 96, 30, 96]);
    line([30, 96, 30, 75], '#94a3b8');
    const twin = variant === 'room-twin' || variant === 'room-family';
    const bedWidth = twin || variant === 'room-single' ? 27 : 52;
    const bed = (x: number) => {
      rect(x, 16, bedWidth, 54, color, 'bed');
      rect(x + 2, 19, bedWidth - 4, 11, '#ffffff');
      rect(x + 2, 33, bedWidth - 4, 34, '#cbd5e1');
      line([x + 3, 48, x + bedWidth - 3, 48], '#94a3b8');
    };
    bed(twin ? 14 : (100 - bedWidth) / 2);
    if (twin) bed(59);
    if (variant === 'room-suite' || variant === 'room-family') sofa(58, 77, 29, 12);
    if (variant === 'room-accessible') {
      circle(77, 76, 9, '#dbeafe');
      line([77, 63, 77, 76, 87, 76, 91, 84], '#2563eb');
      circle(77, 59, 3, '#2563eb');
    }
  } else if (element.type === 'SEAT') {
    rect(18, 12, 64, 24, color, 'chair-back');
    rect(22, 38, 56, 44, board, 'chair-seat');
    rect(13, 34, 10, 43, color);
    rect(77, 34, 10, 43, color);
  } else if (element.type === 'TABLE' && ['booth', 'lounge', 'reserved-sofa'].includes(variant)) {
    sofa(8, 8, 84, 28);
    if (variant === 'booth') sofa(8, 66, 84, 27);
    if (variant === 'lounge') sofa(8, 42, 28, 50);
    rect(
      variant === 'lounge' ? 48 : 22,
      42,
      variant === 'lounge' ? 38 : 56,
      19,
      '#d8b482',
      'lounge-table',
    );
  } else if (element.type === 'STAGE') {
    rect(6, 12, 88, 72, color, 'stage');
    rect(11, 17, 78, 61, board);
    if (variant === 'dj' || variant === 'control') {
      rect(16, 28, 68, 35, '#334155', 'console');
      circle(32, 45, 11, '#94a3b8');
      circle(68, 45, 11, '#94a3b8');
      for (const x of [47, 52]) line([x, 34, x, 56], '#e2e8f0');
    } else {
      for (const y of [85, 91]) rect(30, y, 40, 5, '#94a3b8');
      line([14, 24, 86, 24]);
    }
  } else if (
    element.type === 'SECTOR_ZONE' &&
    ['dance-floor', 'ceremony', 'reception-area', 'activity-area', 'corridor'].includes(variant)
  ) {
    if (variant === 'dance-floor') {
      for (let row = 0; row < 4; row++)
        for (let column = 0; column < 4; column++)
          rect(
            12 + column * 19,
            12 + row * 19,
            18,
            18,
            (row + column) % 2 ? '#c4b5fd' : '#ede9fe',
            'dance-tile',
          );
    } else if (variant === 'ceremony') {
      line([23, 76, 23, 22, 77, 22, 77, 76]);
      circle(23, 22, 8, '#a7c4a0');
      circle(77, 22, 8, '#a7c4a0');
      line([35, 88, 35, 39, 65, 39, 65, 88], '#cbd5e1');
    } else {
      line([28, 10, 28, 90], '#94a3b8');
      line([72, 10, 72, 90], '#94a3b8');
      line([50, 74, 50, 28, 41, 37, 50, 28, 59, 37]);
    }
  } else if (element.type === 'DECOR') {
    switch (variant) {
      case 'sofa':
      case 'lobby':
      case 'recreation':
        sofa(8, 24, 84, 49);
        break;
      case 'armchair':
        sofa(23, 16, 54, 69);
        break;
      case 'partition':
        rect(8, 38, 84, 16, color, 'partition');
        line([16, 29, 16, 64]);
        line([84, 29, 84, 64]);
        break;
      case 'speaker':
        rect(23, 8, 54, 84, '#334155', 'speaker');
        circle(50, 32, 13, '#94a3b8');
        circle(50, 67, 19);
        circle(50, 67, 7, '#1e293b');
        break;
      case 'screen':
        rect(7, 15, 86, 55, '#334155', 'screen');
        rect(12, 20, 76, 45, '#bfdbfe');
        line([50, 72, 50, 88, 27, 88, 73, 88]);
        break;
      case 'entrance':
      case 'emergency-exit':
        rect(12, 9, 76, 82, variant === 'emergency-exit' ? '#dcfce7' : '#e2e8f0', 'door');
        line([27, 84, 27, 20, 72, 20, 72, 84]);
        line(
          [38, 51, 67, 51, 56, 40, 67, 51, 56, 62],
          variant === 'emergency-exit' ? '#15803d' : color,
        );
        break;
      case 'restroom':
        for (const x of [29, 71]) {
          circle(x, 22, 7);
          rect(x - 8, 36, 16, 28, color);
          line([x, 64, x, 84]);
        }
        line([50, 12, 50, 88], '#cbd5e1');
        break;
      case 'stairs':
        for (let step = 0; step < 6; step++)
          rect(15, 12 + step * 12, 70, 12, step % 2 ? '#cbd5e1' : '#e2e8f0', 'step');
        line([50, 78, 50, 24, 43, 31, 50, 24, 57, 31]);
        break;
      case 'elevator':
        rect(16, 10, 68, 80, color, 'elevator');
        rect(23, 24, 54, 60);
        line([50, 25, 50, 84]);
        line([32, 18, 39, 12, 46, 18]);
        line([55, 12, 62, 18, 69, 12]);
        break;
      case 'pool':
        rect(7, 14, 86, 72, '#e0f2fe', 'pool');
        rect(13, 20, 74, 60, '#7dd3fc');
        for (const y of [38, 52, 66])
          line([23, y, 35, y - 3, 47, y + 3, 59, y - 3, 76, y], '#0284c7');
        line([72, 10, 72, 32, 79, 32, 79, 10]);
        break;
      case 'gym':
        line([16, 50, 84, 50]);
        for (const x of [16, 28, 64, 76])
          rect(
            x,
            x === 16 || x === 76 ? 31 : 22,
            8,
            x === 16 || x === 76 ? 38 : 56,
            color,
            'weight',
          );
        break;
      case 'spa':
        rect(16, 14, 68, 72, '#d1e3d0', 'spa');
        circle(40, 60, 16, '#94a3b8');
        circle(59, 45, 13, '#94a3b8');
        circle(43, 29, 10, '#94a3b8');
        break;
      case 'cleaning':
        rect(20, 37, 56, 39, '#bfdbfe', 'cleaning-cart');
        line([62, 36, 79, 12]);
        circle(28, 84, 6);
        circle(69, 84, 6);
        line([25, 25, 25, 37, 46, 37, 46, 25, 25, 25]);
        break;
      case 'storage':
      case 'wardrobe':
        rect(13, 10, 74, 80, color, variant);
        if (variant === 'wardrobe') {
          line([50, 12, 50, 88]);
          circle(43, 51, 2, '#e2e8f0');
          circle(57, 51, 2, '#e2e8f0');
        } else
          for (const y of [30, 54, 78]) {
            rect(20, y - 12, 24, 12);
            rect(55, y - 12, 24, 12);
            line([17, y + 3, 83, y + 3]);
          }
        break;
      case 'reception':
      case 'hotel-bar':
      case 'catering':
      case 'buffet':
      case 'service-point':
        rect(9, 25, 82, 50, '#b99a77', variant);
        rect(7, 20, 86, 18, '#ead6b9');
        if (variant === 'reception' || variant === 'service-point') {
          rect(40, 10, 25, 16, '#334155');
          line([52, 26, 52, 33]);
        } else for (const x of [27, 50, 73]) circle(x, 53, 8, '#f8fafc');
        break;
      case 'dining-table':
      case 'meeting':
      case 'breakfast':
      case 'conference':
      case 'auxiliary-table':
        rect(21, 23, 58, 54, '#d8b482', 'meeting-table');
        for (const x of [29, 66]) for (const y of [10, 82]) rect(x, y, 13, 9, color);
        break;
      case 'podium':
        rect(29, 47, 42, 38, color, 'podium');
        rect(20, 29, 60, 23, '#d8b482');
        line([57, 30, 64, 14, 74, 14]);
        break;
      case 'security':
        group.add(
          new Konva.Line({
            points: [50, 9, 82, 22, 77, 64, 50, 90, 23, 64, 18, 22],
            closed: true,
            fill: '#dbeafe',
            stroke: color,
            strokeWidth: 3,
            name: 'shield',
          }),
        );
        line([33, 49, 45, 63, 68, 35]);
        break;
      case 'ornament':
        circle(50, 50, 32, '#ead6b9');
        circle(50, 50, 19, '#c4b5fd');
        line([50, 17, 50, 83]);
        line([17, 50, 83, 50]);
        break;
      default:
        return null;
    }
  } else return null;
  return group;
}
