/* eslint-disable no-restricted-imports */
import Konva from 'konva';
import type { RoomAppearance, Size, SpaceElement } from '../../map-layout.model';
import { verticalFurniture } from './vertical-art';

export function roomFinish({ width, height }: Size, appearance?: RoomAppearance): Konva.Group {
  const room = new Konva.Group({ listening: false });
  const beam = Math.min(17, width * 0.035, height * 0.035);
  room.add(
    new Konva.Rect({
      width,
      height,
      cornerRadius: 7,
      ...(appearance
        ? { fill: appearance.floorColor }
        : {
            fillLinearGradientEndPoint: { x: width * 0.65, y: height },
            fillLinearGradientColorStops: [0, '#fff3df', 0.52, '#f8e2d7', 1, '#e5c9b7'],
          }),
      shadowColor: '#233d54',
      shadowBlur: 24,
      shadowOpacity: 0.46,
      shadowOffsetY: 10,
    }),
    new Konva.Rect({
      x: beam / 2,
      y: beam / 2,
      width: width - beam,
      height: height - beam,
      cornerRadius: 5,
      stroke: appearance?.wallColor ?? '#202d34',
      strokeWidth: beam,
      shadowColor: '#4e2c1d',
      shadowOpacity: 0.45,
      shadowBlur: 12,
      shadowOffsetY: 5,
    }),
    new Konva.Rect({
      x: 2,
      y: 2,
      width: width - 4,
      height: height - 4,
      cornerRadius: 5,
      stroke: '#526067',
      strokeWidth: 2,
    }),
  );
  if (appearance && appearance.floorPattern !== 'plain') {
    const tile = appearance.floorPattern === 'tile';
    const step = Math.max(tile ? 55 : 20, Math.max(width, height) / 45);
    const pattern = new Konva.Group({
      x: beam,
      y: beam,
      clipWidth: width - 2 * beam,
      clipHeight: height - 2 * beam,
    });
    pattern.add(
      new Konva.Shape({
        stroke: '#392c26',
        opacity: 0.2,
        strokeWidth: 1,
        sceneFunc: (context, shape) => {
          context.beginPath();
          const span = tile ? step : 5 * step;
          for (let row = 0; row * step < height; row++) {
            const y = row * step;
            context.moveTo(0, y);
            context.lineTo(width, y);
            for (let x = tile ? span : (row % 3) * step * 1.5; x < width; x += span) {
              context.moveTo(x, y);
              context.lineTo(x, y + step);
            }
          }
          context.strokeShape(shape);
        },
      }),
    );
    room.add(pattern);
    pattern.zIndex(1);
  }
  if (width < 160 || height < 120) return room;

  // The highlights are a finish on the existing perimeter, without openings or new geometry.
  for (const y of [3, height - beam + 3]) {
    const span = width * 0.73;
    const x = (width - span) / 2;
    room.add(new Konva.Rect({ x, y, width: span, height: beam - 6, fill: '#71858a' }));
    room.add(
      new Konva.Line({ points: [x, y + 3, x + span, y + 3], stroke: '#d6e9e7', strokeWidth: 2 }),
    );
    for (let i = 0; i <= 7; i++) {
      room.add(
        new Konva.Rect({
          x: x + (span * i) / 7 - 3,
          y: y - 2,
          width: 7,
          height: beam - 2,
          fill: '#29363d',
          cornerRadius: 1,
        }),
      );
    }
  }
  return room;
}

function woodTop(config: Konva.RectConfig, color?: string): Konva.Rect {
  return new Konva.Rect({
    ...config,
    fillLinearGradientEndPoint: { x: config.width ?? 70, y: config.height ?? 70 },
    fillLinearGradientColorStops: color
      ? [0, '#fff4dc', 0.5, color, 1, color]
      : [0, '#fff4dc', 0.39, '#f9e5bf', 1, '#d7a473'],
    stroke: '#b47f51',
    strokeWidth: 1.3,
    shadowColor: '#533220',
    shadowBlur: 5,
    shadowOffsetY: 3,
    shadowOpacity: 0.48,
  });
}

export function furnitureFinish(element: SpaceElement, round: boolean): Konva.Group | null {
  const vertical = verticalFurniture(element);
  if (vertical) return vertical;
  const group = new Konva.Group({ name: 'operational-art', listening: false });
  const variant = element.attributes['finishVariant'];
  const attrColor = element.attributes['finishColor'];
  const color = typeof attrColor === 'string' && attrColor ? attrColor : undefined;
  if (element.type === 'TABLE') {
    const material = element.attributes['boardMaterial'];
    const board = element.attributes['boardColor'];
    const boardColor =
      typeof board === 'string' && board ? board : material === 'stone' ? '#d4d9df' : undefined;
    const edge = element.attributes['boardEdge'];
    const classic = element.attributes['chairStyle'] === 'classic';
    const arms = element.attributes['chairArms'] === true;
    const angles = round ? [45, 135, 225, 315] : [0, 90, 180, 270];
    const seats =
      variant === 'rectangle' || variant === 'oval'
        ? [
            { x: 33, angle: 0 },
            { x: 67, angle: 0 },
            { x: 33, angle: 180 },
            { x: 67, angle: 180 },
            { x: 50, angle: 90 },
            { x: 50, angle: 270 },
          ]
        : angles.map((angle) => ({ x: 50, angle }));
    for (const { x, angle } of seats) {
      const seat = new Konva.Group({ x, y: 50, rotation: angle });
      seat.add(
        new Konva.Rect({
          x: -15,
          y: -48,
          width: 30,
          height: 21,
          cornerRadius: classic ? 3 : 7,
          fillLinearGradientEndPoint: { x: 30, y: 21 },
          fillLinearGradientColorStops: [0, color ?? '#56676a', 1, '#263134'],
          shadowColor: '#442923',
          shadowBlur: 3,
          shadowOffsetY: 2,
          shadowOpacity: 0.5,
        }),
        new Konva.Line({
          points: [-11, -46, 11, -46],
          stroke: '#96a2a0',
          strokeWidth: 2,
          lineCap: 'round',
        }),
      );
      if (arms) {
        for (const x of [-17, 13]) {
          seat.add(
            new Konva.Rect({
              x,
              y: -43,
              width: 4,
              height: 17,
              cornerRadius: 2,
              fill: color ?? '#56676a',
              stroke: '#263134',
              strokeWidth: 0.8,
            }),
          );
        }
      }
      group.add(seat);
    }
    group.add(
      woodTop(
        {
          x: 15,
          y: variant === 'rectangle' ? 22 : 15,
          width: 70,
          height: variant === 'rectangle' ? 56 : 70,
          cornerRadius: round ? 35 : 5,
        },
        boardColor,
      ).setAttrs({
        ...(material === 'solid' ? { fillPriority: 'color', fill: boardColor ?? '#d8b482' } : {}),
        ...(edge === 'dark'
          ? { stroke: '#4a3830', strokeWidth: 3 }
          : edge === 'none'
            ? { strokeEnabled: false }
            : {}),
      }),
      new Konva.Rect({
        x: 17,
        y: variant === 'rectangle' ? 24 : 17,
        width: 66,
        height: variant === 'rectangle' ? 52 : 66,
        cornerRadius: round ? 33 : 4,
        stroke: edge === 'dark' ? '#6c5242' : '#fff7e9',
        visible: edge !== 'none',
        strokeWidth: 1.4,
      }),
    );
  } else if (element.type === 'BAR') {
    const upright = element.size.height > element.size.width;
    const bar = new Konva.Group(upright ? { y: 100, rotation: -90 } : {});
    const island = variant === 'island';
    const corner = variant === 'lShape';
    const style = element.attributes['chairStyle'] || (variant === 'counter' ? 'none' : 'round');
    const material = element.attributes['boardMaterial'];
    const edge = element.attributes['boardEdge'];
    const cover = element.attributes['boardColor'];
    const seat = element.attributes['seatColor'];
    const coverColor =
      typeof cover === 'string' && cover
        ? cover
        : (color ?? (material === 'stone' ? '#e2ded8' : '#edbd73'));
    const seatColor = typeof seat === 'string' && seat ? seat : '#dfbd94';
    const topY = island && style !== 'none' ? 27 : 9;
    const topHeight = style === 'none' ? 78 : island ? 46 : 54;
    const cornerRadius = island ? 11 : 5;
    const drawCounter = (x: number, y: number, width: number, height: number) => {
      bar.add(woodTop({ x, y: y + 5, width, height, cornerRadius }, color ?? '#b27743'));
      const lip = woodTop({ x, y, width, height, cornerRadius }, coverColor);
      if (material === 'solid') lip.setAttrs({ fillPriority: 'color', fill: coverColor });
      if (material === 'stone') {
        lip.fillLinearGradientColorStops([0, coverColor, 0.6, '#f5f3ed', 1, coverColor]);
      }
      if (edge === 'none') lip.strokeEnabled(false);
      else if (edge === 'dark' || edge === 'gold') {
        lip.stroke(edge === 'gold' ? '#c3923d' : '#473227');
        lip.strokeWidth(2);
      }
      bar.add(lip);
    };
    if (corner) drawCounter(68, 30, 30, 58);
    drawCounter(2, topY, 96, topHeight);
    if (style !== 'none') {
      const positions = corner ? [13, 31, 50] : [12, 31, 50, 69, 88];
      for (const y of island ? [12, 90] : [83]) {
        for (const x of positions) {
          bar.add(
            woodTop(
              {
                x: x - 6,
                y: y - 9,
                width: 12,
                height: 18,
                cornerRadius: style === 'square' ? 2 : 9,
              },
              seatColor,
            ),
          );
          if (style === 'backed')
            bar.add(
              new Konva.Line({
                points: [x - 5, y + (y < 20 ? -8 : 8), x + 5, y + (y < 20 ? -8 : 8)],
                stroke: '#64472f',
                strokeWidth: 2,
                lineCap: 'round',
              }),
            );
        }
      }
    }
    group.add(bar);
  } else if (element.type === 'DECOR') {
    const visualScale = element.attributes['visualScale'];
    const scale = visualScale === 'small' ? 0.72 : visualScale === 'large' ? 1.03 : 1;
    const plant = new Konva.Group({
      x: 50,
      y: 50,
      offsetX: 50,
      offsetY: 50,
      scaleX: scale,
      scaleY: scale,
    });
    const material = element.attributes['boardMaterial'];
    const foliage = element.attributes['boardColor'];
    const leaves = typeof foliage === 'string' && foliage ? foliage : '#90b82e';
    const pot =
      color ?? (material === 'cement' ? '#a2a6a7' : material === 'clay' ? '#a25b3d' : '#655342');
    plant.add(
      new Konva.Circle({
        x: 50,
        y: 50,
        radius: variant === 'planter' ? 38 : 29,
        fill: pot,
        stroke: material === 'clay' ? '#7f4027' : material === 'cement' ? '#808784' : '#eee4d6',
        strokeWidth: material === 'cement' ? 3 : 2,
        shadowColor: '#20310e',
        shadowBlur: 12,
        shadowOffsetY: 7,
        shadowOpacity: 0.55,
      }),
    );
    const palm = variant === 'palm';
    for (let index = 0; index < (variant === 'planter' ? 7 : palm ? 9 : 13); index++) {
      const inner = index >= 8;
      const length = variant === 'planter' ? 34 : inner ? 30 : 47;
      plant.add(
        new Konva.Path({
          x: 50,
          y: 49,
          rotation: index * 137.5,
          data: palm
            ? `M 0 2 Q -11 -${length - 14} 10 -${length} Q 3 -${length - 15} 5 -5 Z`
            : `M 0 3 C -17 -7 -15 -${length - 7} 0 -${length} C 12 -${length - 13} 18 -8 0 3 Z`,
          fillLinearGradientStartPoint: { x: -10, y: -length / 2 },
          fillLinearGradientEndPoint: { x: 10, y: -length / 2 },
          fillLinearGradientColorStops: [0, '#2d4713', 0.48, leaves, 0.55, '#729522', 1, '#396115'],
          shadowColor: '#243b15',
          shadowBlur: 3,
          shadowOffsetY: 2,
          shadowOpacity: 0.48,
        }),
      );
    }
    group.add(plant);
  } else {
    return null;
  }
  return group;
}
