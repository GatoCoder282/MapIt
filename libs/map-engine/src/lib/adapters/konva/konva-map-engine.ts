/* eslint-disable no-restricted-imports */
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Injectable, signal, type Signal, type WritableSignal } from '@angular/core';
import type {
  MapLayout,
  SectorPlacement as SectorPlacementModel,
  SpaceElement,
  SpaceElementId,
  Size,
  Point,
  ElementState,
  SpaceElementType,
  SpaceAvailability,
} from '../../map-layout.model';
import { constrainPlacement } from '../../map-geometry';
import { MAP_ENGINE, type MapEnginePort } from '../../map-engine.port';
import { SpriteCatalog, type SpriteResource } from './sprite-catalog';
import { furnitureFinish, roomFinish } from './operational-art';

const DEFAULT_SECTOR_SIZE: Size = { width: 1200, height: 800 };

// Type guard for Konva.Rect
function isKonvaRect(node: Konva.Node | undefined): node is Konva.Rect {
  return node instanceof Konva.Rect;
}

function isKonvaText(node: Konva.Node | undefined): node is Konva.Text {
  return node instanceof Konva.Text;
}

function isKonvaCircle(node: Konva.Node | undefined): node is Konva.Circle {
  return node instanceof Konva.Circle;
}

function isKonvaGroup(node: Konva.Node | undefined): node is Konva.Group {
  return node instanceof Konva.Group;
}

/**
 * Capas de apilado por tipo (de fondo a frente): zona → habitación → escenario →
 * mesas y el resto. Es determinista y se aplica en cada render: el orden en que
 * el API devuelve los elementos nunca puede dejar una zona tapando las mesas.
 */
const Z_LAYER: Partial<Record<SpaceElementType, number>> = {
  SECTOR_ZONE: 0,
  ROOM: 1,
  STAGE: 2,
};

function zLayerOf(type: SpaceElementType): number {
  return Z_LAYER[type] ?? 3;
}

// HU-4.01 v2 (apps/console/design/): el estado operativo vive en el TRAZO, nunca
// rellenando el marcador a sangre. El azul de selección (#2563EB) es solo interacción.
const STATE_COLORS: Record<ElementState, { fill: string; stroke: string }> = {
  AVAILABLE: { fill: '#10b981', stroke: '#059669' },
  OCCUPIED: { fill: '#ef4444', stroke: '#dc2626' },
  RESERVED: { fill: '#f59e0b', stroke: '#d97706' },
  CLEANING: { fill: '#3b82f6', stroke: '#2563eb' },
  OUT_OF_SERVICE: { fill: '#6b7280', stroke: '#4b5563' },
};

const AVAILABILITY_COLORS: Record<SpaceAvailability, ElementState> = {
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  UNAVAILABLE: 'OUT_OF_SERVICE',
};

function paintState(el: SpaceElement): ElementState {
  return el.availability ? AVAILABILITY_COLORS[el.availability] : el.state;
}

/** Paleta del editor (espejo de --mapit-editor-* de ui-kit; el adaptador es imperativo). */
const TABLE_FILL = '#f3d6ae';
const CHAIR_FILL = '#7597b7';

const EDITOR = {
  selection: '#2563eb',
  selectionFill: '#93c5fd',
  furniture: '#ffffff',
  furnitureStroke: '#94a3b8',
  furnitureStrokeHover: '#64748b',
  grid: '#e5e7eb',
  canvas: '#f8fafc',
  panelText: '#0f172a',
  panelMuted: '#64748b',
} as const;

function createElementNode(
  element: SpaceElement,
  sectorSize: { width: number; height: number },
): Konva.Group {
  const { width: elementWidth, height: elementHeight } = element.size;

  // Ensure valid initial positions (defensive: API might return undefined)
  const initialX =
    typeof element.position.x === 'number' && !isNaN(element.position.x) ? element.position.x : 0;
  const initialY =
    typeof element.position.y === 'number' && !isNaN(element.position.y) ? element.position.y : 0;

  const group: Konva.Group = new Konva.Group({
    id: element.id,
    x: initialX,
    y: initialY,
    width: elementWidth,
    height: elementHeight,
    rotation: element.rotation,
    draggable: true,
    dragBoundFunc: (absolute: Point) => {
      const transform = group.getParent()!.getAbsoluteTransform();
      const pos = transform.copy().invert().point(absolute);
      const bounds = (group.getAttr('sectorSize') as Size | undefined) ?? sectorSize;
      return transform.point(constrainPlacement(pos, group.size(), bounds, group.rotation()));
    },
    name: 'space-element',
  });

  // Override getClientRect so Transformer only wraps the .shape (not label/capacity)
  group.getClientRect = function (config) {
    const shape = this.findOne('.shape');
    return shape
      ? shape.getClientRect(config)
      : Konva.Group.prototype.getClientRect.call(this, config);
  };

  const { width, height } = element.size;
  const state = paintState(element);
  const colors = STATE_COLORS[state];

  // HU-4.01 v2: reposo = blanco con outline pizarra; el estado vive en el trazo (más
  // grueso) y nunca rellena el marcador. La selección la pinta el adaptador al
  // seleccionar (relleno azul claro + marco), no la creación del nodo.
  const isPlain = state === 'AVAILABLE';
  const shape = new Konva.Rect({
    width,
    height,
    fill: EDITOR.furniture,
    stroke: isPlain ? EDITOR.furnitureStroke : colors.stroke,
    strokeWidth: isPlain ? 1.5 : 3,
    cornerRadius: element.type === 'TABLE' || element.type === 'SEAT' ? 8 : 4,
    shadowColor: 'rgba(0,0,0,0.15)',
    shadowBlur: 4,
    shadowOffset: { x: 0, y: 2 },
    name: 'shape',
  });

  const label = new Konva.Text({
    text: element.label,
    x: (width - Math.max(width, 80)) / 2,
    y: height + 8,
    fontSize: 11,
    fontFamily: 'system-ui, sans-serif',
    fill: EDITOR.panelMuted,
    align: 'center',
    width: Math.max(width, 80),
    name: 'label',
  });

  group.add(shape);
  group.add(label);

  return group;
}

function createSectorNode(
  sector: SectorPlacementModel,
  canvasSize: { width: number; height: number },
): Konva.Group {
  const { width: sectorWidth, height: sectorHeight } = sector.size;

  const group: Konva.Group = new Konva.Group({
    id: sector.id,
    x: sector.position.x,
    y: sector.position.y,
    width: sectorWidth,
    height: sectorHeight,
    rotation: sector.rotation,
    draggable: true,
    dragBoundFunc: (absolute: Point) => {
      const transform = group.getParent()!.getAbsoluteTransform();
      const pos = transform.copy().invert().point(absolute);
      return transform.point(constrainPlacement(pos, group.size(), canvasSize, group.rotation()));
    },
    name: 'sector-node',
  });

  // Contorno de la zona (marco del sector dentro de la planta)
  group.add(
    new Konva.Rect({
      width: sectorWidth,
      height: sectorHeight,
      fill: 'rgba(148, 163, 184, 0.08)',
      stroke: '#64748b',
      strokeWidth: 2,
      dash: [6, 4],
      name: 'shape',
    }),
  );
  group.add(
    new Konva.Text({
      text: sector.label,
      x: 0,
      y: -22,
      width: Math.max(sectorWidth, 120),
      fontSize: 13,
      fontFamily: 'system-ui, sans-serif',
      fontStyle: 'bold',
      fill: '#334155',
      name: 'label',
    }),
  );

  // Elementos del sector en SOLO LECTURA (RN-2/D-3): se editan en la vista de sector.
  // Son composited dentro del grupo; su transformación la hace Konva con el grupo.
  sector.children.forEach((el) => {
    const state = paintState(el);
    const colors = STATE_COLORS[state];
    const plain = state === 'AVAILABLE';
    group.add(
      new Konva.Rect({
        x: el.position.x,
        y: el.position.y,
        width: el.size.width,
        height: el.size.height,
        rotation: el.rotation,
        fill: EDITOR.furniture,
        stroke: plain ? EDITOR.furnitureStroke : colors.stroke,
        strokeWidth: plain ? 1 : 2,
        cornerRadius: 4,
        opacity: 0.85,
        name: 'sector-child',
        listening: false,
      }),
    );
  });

  return group;
}

function createTransformer(layer: Konva.Layer): Konva.Transformer {
  const transformer = new Konva.Transformer({
    enabledAnchors: [
      'top-left',
      'top-center',
      'top-right',
      'middle-right',
      'bottom-right',
      'bottom-center',
      'bottom-left',
      'middle-left',
    ],
    borderEnabled: true,
    rotateEnabled: true,
    rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315],
    anchorSize: 12,
    // HU-4.01 v2: manejadores círculos/píldoras blancas con borde azul
    // (anchorCornerRadius alto ≈ círculo; anchorShape no existe en este Konva).
    anchorCornerRadius: 6,
    anchorStroke: '#2563eb',
    anchorFill: '#ffffff',
    anchorStrokeWidth: 2,
    borderStroke: '#2563eb',
    borderStrokeWidth: 2,
    borderDash: [],
    keepRatio: false,
    centeredScaling: false,
    rotateAnchorOffset: 20,
    padding: 5,
    ignoreStroke: true,
    visible: false,
    name: 'transformer',
    flipEnabled: false,
  });
  layer.add(transformer);
  return transformer;
}

@Injectable({ providedIn: 'root' })
export class KonvaMapEngine implements MapEnginePort {
  private readonly cameraZoom = signal(1);
  readonly zoom = this.cameraZoom.asReadonly();
  private cameraLimits = { min: 0.05, max: 4 };
  private fitted = false;
  private panning = false;
  private showGrid = true;
  private layoutFinish = false;
  private catalog: SpriteCatalog | null = null;

  setLayoutFinish(enabled: boolean): void {
    this.layoutFinish = enabled;
    if (this.stage) {
      this.drawBackground(this.layout());
      this.load(this.layout());
    }
  }

  furniturePreview(element: SpaceElement): string | null {
    const graphic =
      element.type === 'SECTOR_ZONE'
        ? (furnitureFinish(element, this.isRoundFurniture(element)) ??
          new Konva.Group().add(
            new Konva.Rect({
              x: 5,
              y: 5,
              width: 90,
              height: 90,
              ...this.zoneStyle(element, 100),
            }),
          ))
        : furnitureFinish(element, this.isRoundFurniture(element));
    if (!graphic) return null;
    if (element.type === 'SECTOR_ZONE' && element.attributes['showMapName'] !== false) {
      const style = element.attributes['mapLabelStyle'];
      const text = new Konva.Text({
        x: 7,
        width: 86,
        padding: 6,
        align: 'center',
        text: element.label,
        ellipsis: true,
        wrap: 'none',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 10,
        fontStyle: 'bold',
        fill: style === 'filled' ? '#ffffff' : EDITOR.panelText,
      });
      const y = this.zoneLabelY(element, text.height(), 100);
      if (style !== 'text')
        graphic.add(
          new Konva.Rect({
            x: (100 - Math.min(text.getTextWidth() + 12, 86)) / 2,
            y,
            width: Math.min(text.getTextWidth() + 12, 86),
            height: text.height(),
            fill: style === 'filled' ? EDITOR.selection : '#ffffff',
            cornerRadius: 8,
          }),
        );
      graphic.add(text.y(y));
    }
    const { width, height } = element.size;
    const maxSide = Math.max(width, height);
    graphic.scale({ x: width / maxSide, y: height / maxSide });
    try {
      return graphic.toDataURL({
        x: ((100 * width) / maxSide - 116) / 2,
        y: ((100 * height) / maxSide - 116) / 2,
        width: 116,
        height: 116,
        pixelRatio: 2,
      });
    } finally {
      graphic.destroy();
    }
  }

  private zoneStyle(element: SpaceElement, side: number) {
    const { finishColor, finishVariant, fillOpacity, cornerRadius, zoneBorderColor, zoneBorder } =
      element.attributes;
    const color = typeof finishColor === 'string' && finishColor ? finishColor : '#93c5fd';
    const opacity = typeof fillOpacity === 'number' ? fillOpacity : 65;
    const alpha = Math.round((Math.min(100, Math.max(0, opacity)) * 255) / 100)
      .toString(16)
      .padStart(2, '0');
    const radius =
      finishVariant === 'rounded' ? (typeof cornerRadius === 'number' ? cornerRadius : 16) : 0;
    return {
      fill: color.slice(0, 7) + alpha,
      cornerRadius: Math.min(radius, side / 2),
      stroke: typeof zoneBorderColor === 'string' && zoneBorderColor ? zoneBorderColor : '#2563eb',
      strokeWidth: 2,
      strokeEnabled: zoneBorder !== 'none',
      dash: !zoneBorder || zoneBorder === 'dashed' ? [7, 5] : [],
    };
  }

  private zoneLabelY(element: SpaceElement, labelHeight: number, height: number): number {
    switch (element.attributes['mapLabelPosition']) {
      case 'top':
        return 8;
      case 'bottom':
        return Math.max(8, height - labelHeight - 8);
      default:
        return (height - labelHeight) / 2;
    }
  }

  private isRoundFurniture(el: SpaceElement): boolean {
    const variant = el.attributes['finishVariant'];
    return (
      variant === 'round' ||
      variant === 'oval' ||
      variant === 'vip-round' ||
      variant === 'high-table' ||
      (!variant &&
        (el.type === 'TABLE' || el.type === 'SEAT') &&
        Math.max(el.size.width, el.size.height) / Math.min(el.size.width, el.size.height) < 1.15)
    );
  }

  private viewportEvents: AbortController | null = null;

  fitToViewport(limits = this.cameraLimits): void {
    if (!this.stage) return;
    this.cameraLimits = limits;
    const { width, height } = this.layout().size;
    const margin = this.layoutFinish ? 52 : 40;
    const scale = this.clampZoom(
      Math.min((this.stage.width() - margin) / width, (this.stage.height() - margin) / height, 1),
    );
    this.fitted = true;
    const floor = this.layer?.findOne<Konva.Rect>('.sector-border');
    floor?.setAttrs({ fill: '#f8f5ee', stroke: '#3a4e65', strokeWidth: 2, shadowOpacity: 0 });
    this.applyCamera(scale, {
      x: (this.stage.width() - width * scale) / 2,
      y: (this.stage.height() - height * scale) / 2,
    });
  }

  viewportToModel(point: Point): Point {
    return this.elementsLayer?.getAbsoluteTransform().copy().invert().point(point) ?? point;
  }

  zoomBy(factor: number): void {
    if (!this.stage) return;
    this.zoomAt(factor, { x: this.stage.width() / 2, y: this.stage.height() / 2 });
  }

  setGridVisible(visible: boolean): void {
    this.showGrid = visible;
    this.layer?.findOne('.grid')?.visible(visible);
    this.layer?.batchDraw();
  }

  setPanning(enabled: boolean): void {
    this.panning = enabled;
    if (this.hostElement) {
      this.hostElement.style.cursor = enabled ? 'grab' : '';
      this.hostElement.style.touchAction = enabled ? 'none' : '';
    }
    this.elementsLayer?.listening(!enabled);
    this.syncEditableState();
    this.transformer?.visible(!enabled && this._editable() && this._selectedElement() !== null);
  }

  private clampZoom(value: number): number {
    return Math.max(this.cameraLimits.min, Math.min(this.cameraLimits.max, value));
  }

  private zoomAt(factor: number, point: Point): void {
    const model = this.viewportToModel(point);
    const scale = this.clampZoom(this.zoom() * factor);
    this.fitted = false;
    this.applyCamera(scale, { x: point.x - model.x * scale, y: point.y - model.y * scale });
  }

  private applyCamera(scale: number, position: Point): void {
    this.cameraZoom.set(scale);
    for (const layer of [this.layer, this.elementsLayer]) {
      layer?.position(position);
      layer?.scale({ x: scale, y: scale });
      layer?.batchDraw();
    }
    this.transformer?.forceUpdate();
    this.sectorTransformer?.forceUpdate();
    this.layer?.findOne<Konva.Rect>('.sector-border')?.strokeWidth(Math.min(11, 5 / scale));
  }

  private setupViewport(host: HTMLElement): void {
    this.viewportEvents = new AbortController();
    const options = { signal: this.viewportEvents.signal };
    const point = (event: MouseEvent): Point => {
      const rect = host.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    let pan: { id: number; start: Point; origin: Point } | null = null;
    host.addEventListener(
      'pointerdown',
      (event) => {
        if (!this.panning || !event.isPrimary || event.button !== 0 || !this.elementsLayer) return;
        pan = { id: event.pointerId, start: point(event), origin: this.elementsLayer.position() };
        host.setPointerCapture(event.pointerId);
      },
      options,
    );
    host.addEventListener(
      'pointermove',
      (event) => {
        if (!this.panning || !pan || event.pointerId !== pan.id) return;
        const current = point(event);
        this.fitted = false;
        this.applyCamera(this.zoom(), {
          x: pan.origin.x + current.x - pan.start.x,
          y: pan.origin.y + current.y - pan.start.y,
        });
      },
      options,
    );
    host.addEventListener(
      'lostpointercapture',
      () => {
        pan = null;
      },
      options,
    );
  }
  private stage: Konva.Stage | null = null;
  private layer: Konva.Layer | null = null;
  private transformer: Konva.Transformer | null = null;
  private elementsLayer: Konva.Layer | null = null;
  private hostElement: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;

  private readonly _layout: WritableSignal<MapLayout> = signal({
    floorId: '',
    name: '',
    size: DEFAULT_SECTOR_SIZE,
    elements: [],
    schemaVersion: 1,
  });
  readonly layout: Signal<MapLayout> = this._layout.asReadonly();

  private readonly _selectedElement: WritableSignal<SpaceElementId | null> = signal(null);
  readonly selectedElement: Signal<SpaceElementId | null> = this._selectedElement.asReadonly();

  private readonly _editable: WritableSignal<boolean> = signal(true);
  readonly editable: Signal<boolean> = this._editable.asReadonly();

  private dragEndCallbacks: ((payload: { id: SpaceElementId; x: number; y: number }) => void)[] =
    [];
  private dragMoveCallbacks: ((payload: { id: SpaceElementId; x: number; y: number }) => void)[] =
    [];
  private dragStartCallbacks: ((id: SpaceElementId) => void)[] = [];
  private rotateEndCallbacks: ((payload: { id: SpaceElementId; rotation: number }) => void)[] = [];
  private resizeEndCallbacks: ((payload: {
    id: SpaceElementId;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
  }) => void)[] = [];
  private clickCallbacks: ((payload: { id: SpaceElementId | null }) => void)[] = [];

  // HU-4.01: eventos del modo planta (sectores) y drops externos (biblioteca).
  private sectorDragEndCallbacks: ((payload: {
    id: SpaceElementId;
    x: number;
    y: number;
  }) => void)[] = [];
  private sectorRotateEndCallbacks: ((payload: {
    id: SpaceElementId;
    rotation: number;
  }) => void)[] = [];
  private sectorClickCallbacks: ((payload: { id: SpaceElementId | null }) => void)[] = [];
  private sectorResizeCallbacks: ((payload: {
    id: SpaceElementId;
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void)[] = [];
  private externalDropCallbacks: ((payload: { key: string; x: number; y: number }) => void)[] = [];
  private sectorTransformer: Konva.Transformer | null = null;
  private selectedSectorId: SpaceElementId | null = null;
  private sectorDragStartPos: { x: number; y: number } | null = null;

  // Flag to prevent transformend callbacks during programmatic transformer operations
  private _isProgrammaticTransform = false;

  // Track drag start position to detect actual movement vs click
  private _dragStartPos: { x: number; y: number } | null = null;

  mount(host: HTMLElement, layout: MapLayout): void {
    if (this.stage) {
      this.destroy();
    }
    this.hostElement = host;

    this.stage = new Konva.Stage({
      container: host as HTMLDivElement,
      width: host.clientWidth || layout.size.width,
      height: host.clientHeight || layout.size.height,
    });
    this.layer = new Konva.Layer({ listening: false });

    this.elementsLayer = new Konva.Layer();

    this.stage.add(this.layer);
    this.stage.add(this.elementsLayer);

    this.transformer = createTransformer(this.elementsLayer);

    // HU-4.01: transformer del modo planta � solo rotación de sectores (su tamaño
    // intrínseco se edita en la vista de sector, D-3) y sin anclas de resize.
    const sectorTr = new Konva.Transformer({
      enabledAnchors: ['middle-right', 'bottom-center', 'bottom-right'],
      keepRatio: false,
      flipEnabled: false,
      rotateEnabled: true,
      rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315],
      borderEnabled: true,
      borderStroke: '#0f766e',
      borderDash: [4, 4],
      visible: false,
      name: 'sector-transformer',
    });
    this.elementsLayer.add(sectorTr);
    this.sectorTransformer = sectorTr;

    // HU-4.01 (I-5): el handler se registra UNA vez al montar, no por nodo: así
    // deseleccionar un sector nunca deja muda la rotación al siguiente clic.
    sectorTr.on('transformend', () => {
      if (!this._editable() || this._isProgrammaticTransform) return;
      const target = sectorTr.nodes()[0];
      if (!target) return;
      const sector = this.layout().sectors?.find((item) => item.id === target.id());
      if (!sector) return;
      const width = Math.max(20, Math.round(sector.size.width * target.scaleX()));
      const height = Math.max(20, Math.round(sector.size.height * target.scaleY()));
      target.scale({ x: 1, y: 1 });
      const rotation = ((Math.round(target.rotation()) % 360) + 360) % 360;
      target.rotation(rotation);
      if (width !== sector.size.width || height !== sector.size.height) {
        const { x, y } = target.position();
        this.sectorResizeCallbacks.forEach((cb) => cb({ id: target.id(), x, y, width, height }));
      } else {
        this.sectorRotateEndCallbacks.forEach((cb) => cb({ id: target.id(), rotation }));
      }
      sectorTr.forceUpdate();
      this.elementsLayer?.batchDraw();
    });

    this.load(layout);

    const catalog = new SpriteCatalog();
    this.catalog = catalog;
    void catalog.load().then(() => {
      if (this.catalog !== catalog) return;
      for (const el of this.layout().elements) {
        const node = this.elementsLayer?.findOne<Konva.Group>('#' + el.id);
        if (node) this.syncSprite(node, el);
      }
    });
    this.setupViewport(host);
    this.setupStageEvents();
    this.setupExternalDrop(host);
    this.setupResizeObserver();
  }

  private setupResizeObserver(): void {
    if (!this.stage || !this.hostElement) return;
    this.resizeObserver = new ResizeObserver(() => {
      if (this.hostElement && this.stage) {
        const { width, height } = this.hostElement.getBoundingClientRect();
        if (!width || !height) return;
        this.stage.size({ width, height });
        if (this.fitted) this.fitToViewport();
      }
    });
    this.resizeObserver.observe(this.hostElement);
  }

  private setupStageEvents(): void {
    if (!this.stage || !this.elementsLayer || !this.transformer) return;

    this.stage.on('click tap', (e: KonvaEventObject<MouseEvent>) => {
      if (!this.panning && e.target === this.stage) {
        this.deselectElement();
        this.deselectSector();
        this.clickCallbacks.forEach((cb) => cb({ id: null }));
        this.sectorClickCallbacks.forEach((cb) => cb({ id: null }));
      }
    });

    this.elementsLayer.on('click tap', (e: KonvaEventObject<MouseEvent>) => {
      if (this.panning) return;
      // Ignore clicks on transformer handles
      if (this.transformer && e.target.getAncestors?.().includes(this.transformer)) return;
      if (this.sectorTransformer && e.target.getAncestors?.().includes(this.sectorTransformer))
        return;

      const sectorNode = e.target.findAncestor('.sector-node');
      if (sectorNode) {
        this.selectSector(sectorNode.id());
        this.sectorClickCallbacks.forEach((cb) => cb({ id: sectorNode.id() }));
        return;
      }

      const group = e.target.findAncestor('.space-element');
      if (group) {
        this.selectElement(group.id());
        this.clickCallbacks.forEach((cb) => cb({ id: group.id() }));
      }
    });
  }

  /**
   * HU-4.01: convierte un drop HTML5 (desde la biblioteca) en coordenadas de lienzo.
   */
  private setupExternalDrop(host: HTMLElement): void {
    host.addEventListener('dragover', this.handleDragOver);
    host.addEventListener('drop', this.handleDrop);
  }

  private readonly handleDragOver = (event: DragEvent): void => {
    if (!this._editable() || this.panning) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  };

  private readonly handleDrop = (event: DragEvent): void => {
    if (!this._editable() || this.panning || !this.hostElement) return;
    event.preventDefault();
    const key = event.dataTransfer?.getData('text/plain');
    if (!key) return;
    const rect = this.hostElement.getBoundingClientRect();
    const model = this.viewportToModel({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
    const x = Math.max(0, Math.round(model.x));
    const y = Math.max(0, Math.round(model.y));
    this.externalDropCallbacks.forEach((cb) => cb({ key, x, y }));
  };

  drawBackground(layout: MapLayout): void {
    if (!this.layer) return;
    this.layer.destroyChildren();

    const { width, height } = layout.size;
    this.layer.add(
      this.layoutFinish
        ? roomFinish(layout.size, layout.appearance)
        : new Konva.Rect({
            width,
            height,
            name: 'sector-border',
            fill: this.fitted ? '#f8f5ee' : EDITOR.furniture,
            stroke: this.fitted ? '#3a4e65' : EDITOR.furnitureStroke,
            strokeWidth: 2,
          }),
    );
    this.layer.add(
      new Konva.Shape({
        name: 'grid',
        visible: this.showGrid,
        stroke: EDITOR.grid,
        strokeWidth: 1,
        sceneFunc: (context, shape) => {
          context.beginPath();
          for (let x = 50; x < width; x += 50) {
            context.moveTo(x, 0);
            context.lineTo(x, height);
          }
          for (let y = 50; y < height; y += 50) {
            context.moveTo(0, y);
            context.lineTo(width, y);
          }
          context.strokeShape(shape);
        },
      }),
    );
    this.layer.batchDraw();
  }

  load(layout: MapLayout): void {
    if (!this.elementsLayer) return;

    const previous = this._layout();
    this._layout.set(layout);
    if (
      !this.layer?.hasChildren() ||
      previous.size.width !== layout.size.width ||
      previous.size.height !== layout.size.height ||
      previous.appearance !== layout.appearance
    ) {
      this.drawBackground(layout);
      if (this.fitted) this.fitToViewport();
    }

    if (layout.kind === 'floor') {
      this.loadFloorSectors(layout);
      return;
    }

    this.clearSectorNodes();
    const sectorSize = { width: layout.size.width, height: layout.size.height };

    // 1. Actualizar nodos existentes o crear nuevos (SIN DESTRUIR LA CAPA)
    layout.elements.forEach((el) => {
      const node = this.elementsLayer!.findOne(`#${el.id}`) as Konva.Group;

      if (node && isKonvaGroup(node)) {
        this.syncAppearance(node, el, sectorSize);
        // Nodo existente: sincronizar TODA la geometría (posición, rotación, tamaño)
        node.position({ x: el.position.x, y: el.position.y });
        node.rotation(el.rotation);
        node.size(el.size);

        // Actualizar tamaño de la figura principal (.shape)
        const shape = node.findOne('.shape') as Konva.Rect;
        if (shape) {
          shape.width(el.size.width);
          shape.height(el.size.height);
          this.paintElement(shape, el);
        }
      } else {
        // Nodo nuevo: crearlo, agregarlo a la capa y ATAR handlers
        const newNode = createElementNode(el, sectorSize);
        this.elementsLayer!.add(newNode);

        // CRÍTICO: Atar los eventos de arrastre/clic a este nuevo nodo
        this.attachDragHandlers(newNode);
        this.syncAppearance(newNode, el, sectorSize);
      }
    });
    // 2. Limpieza de seguridad: borrar nodos que ya no existen en el layout
    const layoutIds = new Set(layout.elements.map((e) => e.id));
    this.elementsLayer.getChildren().forEach((child) => {
      // Ignorar el transformer y herramientas internas
      if (child.id() && !layoutIds.has(child.id())) {
        child.destroy();
      }
    });

    if (this._selectedElement() && !layoutIds.has(this._selectedElement()!)) {
      this.transformer?.nodes([]);
      this.transformer?.hide();
      this._selectedElement.set(null);
    } else if (this._selectedElement()) {
      const selected = this.elementsLayer.findOne<Konva.Group>(`#${this._selectedElement()}`);
      if (selected) this.applySelectionPaint(selected, true);
    }

    // 3. Apilado por tipo (zona → habitación → escenario → mesas y el resto al
    // frente), en cada render. `sort` es estable: dentro de la misma capa se
    // conserva el orden del layout. Los transformers siempre quedan encima.
    [...layout.elements]
      .sort((a, b) => zLayerOf(a.type) - zLayerOf(b.type))
      .forEach((el, index) => {
        this.elementsLayer!.findOne(`#${el.id}`)?.zIndex(index);
      });
    this.transformer?.moveToTop();
    this.sectorTransformer?.moveToTop();

    this.syncEditableState();
    if (this._selectedElement()) this.selectElement(this._selectedElement()!);

    this.elementsLayer.batchDraw();
  }

  private syncAppearance(node: Konva.Group, el: SpaceElement, bounds: Size): void {
    node.setAttr('sectorSize', bounds);
    const shape = node.findOne<Konva.Rect>('.shape')!;
    const minSide = Math.min(el.size.width, el.size.height);
    const isRound = this.isRoundFurniture(el);
    shape.cornerRadius(isRound ? minSide / 2 : 6);
    node.findOne<Konva.Text>('.label')?.visible(el.attributes['showMapName'] !== false);
    this.syncRestingLabel(node, el);
    this.syncFurnitureFallback(node, el, isRound);
    this.syncCapacity(node, el);
    this.paintElement(shape, el);
    this.syncSprite(node, el);
  }

  private syncRestingLabel(node: Konva.Group, el: SpaceElement): void {
    const label = node.findOne<Konva.Text>('.label');
    if (!label) return;
    const zone = el.type === 'SECTOR_ZONE';
    const style = el.attributes['mapLabelStyle'] ?? (zone ? 'outline' : undefined);
    const y = zone ? this.zoneLabelY(el, label.height(), el.size.height) : el.size.height + 8;
    const labelWidth = Math.max(el.size.width, 80);
    label.setAttrs({
      text: el.label,
      x: (el.size.width - labelWidth) / 2,
      y,
      width: labelWidth,
      fill:
        style === 'filled' ? '#ffffff' : style === 'outline' ? EDITOR.selection : EDITOR.panelMuted,
    });
    let badge = node.findOne<Konva.Rect>('.editor-label-bg');
    if (!label.visible() || (style !== 'filled' && style !== 'outline')) {
      badge?.destroy();
      return;
    }
    if (!badge) {
      badge = new Konva.Rect({ name: 'editor-label-bg', listening: false, cornerRadius: 8 });
      node.add(badge);
      badge.zIndex(label.zIndex());
    }
    const width = Math.min(label.getTextWidth(), labelWidth) + 10;
    badge.setAttrs({
      x: (el.size.width - width) / 2,
      y: label.y() - 3,
      width,
      height: label.height() + 6,
      fill: style === 'filled' ? EDITOR.selection : '#ffffff',
      stroke: EDITOR.selection,
      strokeWidth: 1,
    });
  }

  private syncCapacity(node: Konva.Group, element: SpaceElement): void {
    let badge = node.findOne<Konva.Circle>('.capacity-bg');
    let text = node.findOne<Konva.Text>('.capacity-text');
    if (
      !element.reservable ||
      element.capacity === null ||
      element.attributes['showMapCapacity'] === false
    ) {
      badge?.destroy();
      text?.destroy();
      return;
    }
    if (!badge || !text) {
      badge = new Konva.Circle({
        name: 'capacity-bg',
        radius: 14,
        fill: EDITOR.selection,
        stroke: '#ffffff',
        strokeWidth: 2,
        listening: false,
      });
      text = new Konva.Text({
        name: 'capacity-text',
        fontSize: 14,
        fontStyle: 'bold',
        fontFamily: 'system-ui, sans-serif',
        fill: '#ffffff',
        align: 'center',
        width: 28,
        offsetX: 14,
        offsetY: 7,
        listening: false,
      });
      node.add(badge, text);
    }
    const position = { x: element.size.width - 12, y: 12 };
    badge.position(position);
    text.position(position);
    text.text(String(element.capacity));
  }

  private syncFurnitureFallback(node: Konva.Group, el: SpaceElement, round: boolean): void {
    let previous = node.findOne<Konva.Group>('.table-fallback');
    if (this.layoutFinish) {
      const key = JSON.stringify([
        el.type,
        round,
        el.size.height > el.size.width,
        el.attributes['finishColor'],
        el.attributes['finishVariant'],
        el.attributes['boardColor'],
        el.attributes['boardMaterial'],
        el.attributes['boardEdge'],
        el.attributes['chairStyle'],
        el.attributes['chairArms'],
        el.attributes['seatColor'],
        el.attributes['visualScale'],
      ]);
      if (previous?.getAttr('finish') !== key) {
        previous?.destroy();
        previous = furnitureFinish(el, round) ?? undefined;
        if (previous) {
          previous.addName('table-fallback');
          previous.setAttr('finish', key);
          node.add(previous);
          previous.zIndex(1);
        }
      }
      previous?.scale({ x: el.size.width / 100, y: el.size.height / 100 });
      previous?.visible(!node.findOne('.map-sprite'));
      return;
    }
    if (previous?.hasName('operational-art')) previous.destroy();
    if (el.type !== 'TABLE' || el.availability) return;
    const decor =
      node.findOne<Konva.Group>('.table-fallback') ??
      new Konva.Group({ name: 'table-fallback', listening: false });
    if (!decor.getParent()) {
      const seat = (x: number, y: number, width: number, height: number) =>
        new Konva.Rect({
          x,
          y,
          width,
          height,
          cornerRadius: 8,
          fill: CHAIR_FILL,
          stroke: '#587896',
          strokeWidth: 1.3,
        });
      decor.add(
        seat(35, 4, 30, 16),
        seat(35, 80, 30, 16),
        seat(4, 35, 16, 30),
        seat(80, 35, 16, 30),
        new Konva.Rect({
          x: 17,
          y: 17,
          width: 66,
          height: 66,
          name: 'table-top',
          fill: TABLE_FILL,
          stroke: '#ba9671',
          strokeWidth: 1.3,
        }),
      );
      node.add(decor);
      decor.zIndex(1);
    }
    decor.scale({ x: el.size.width / 100, y: el.size.height / 100 });
    decor.findOne<Konva.Rect>('.table-top')?.cornerRadius(round ? 33 : 9);
    decor.visible(!node.findOne('.map-sprite'));
  }

  private syncSprite(node: Konva.Group, el: SpaceElement): void {
    const catalog = this.catalog;
    const sprite = catalog?.lookup(el, this.layout().vertical);
    const old = node.findOne<Konva.Image>('.map-sprite');
    if (!catalog || !sprite) {
      old?.destroy();
      node.findOne('.table-fallback')?.show();
      node.setAttr('spritePath', '');
      return;
    }
    const variant = el.attributes['spriteVariant'];
    const path =
      (typeof variant === 'string' ? sprite.variants?.[variant] : undefined) ?? sprite.path;
    if (node.getAttr('spritePath') === path) {
      if (old) this.sizeSprite(old, sprite, el.size);
      return;
    }
    old?.destroy();
    node.findOne('.table-fallback')?.show();
    node.setAttr('spritePath', path);
    void catalog.image(path).then((image) => {
      if (
        !image ||
        this.catalog !== catalog ||
        !node.getStage() ||
        node.getAttr('spritePath') !== path
      )
        return;
      const current = this.layout().elements.find((item) => item.id === el.id);
      if (!current) return;
      const graphic = new Konva.Image({ image, name: 'map-sprite', listening: false });
      this.sizeSprite(graphic, sprite, current.size);
      node.add(graphic);
      graphic.zIndex(1);
      node.findOne('.table-fallback')?.hide();
      node.getLayer()?.batchDraw();
    });
  }

  private sizeSprite(node: Konva.Image, sprite: SpriteResource, size: Size): void {
    const width = Math.min(size.width, size.height * sprite.aspectRatio);
    const height = width / sprite.aspectRatio;
    node.size({ width, height });
    node.position({
      x: (size.width - width) * sprite.anchor.x,
      y: (size.height - height) * sprite.anchor.y,
    });
  }

  // ===== HU-4.01: modo planta (sectores como nodos compuestos) =====

  private loadFloorSectors(layout: MapLayout): void {
    this.clearElementNodes();
    const canvasSize = { width: layout.size.width, height: layout.size.height };
    const wanted = layout.sectors ?? [];

    wanted.forEach((sector) => {
      const node = this.elementsLayer!.findOne(`#${sector.id}`);
      if (node && isKonvaGroup(node)) {
        node.position({ x: sector.position.x, y: sector.position.y });
        node.rotation(sector.rotation);
        node.width(sector.size.width);
        node.height(sector.size.height);
        const shape = node.findOne('.shape');
        if (isKonvaRect(shape)) {
          shape.width(sector.size.width);
          shape.height(sector.size.height);
        }
        // Re-sincronizar hijos en solo lectura (la vista planta refleja siempre,
        // nunca edita): se reconstruyen los rect del interior del sector.
        node.find('.sector-child').forEach((child) => child.destroy());
        sector.children.forEach((el) => {
          const state = paintState(el);
          const colors = STATE_COLORS[state];
          const plain = state === 'AVAILABLE';
          node.add(
            new Konva.Rect({
              x: el.position.x,
              y: el.position.y,
              width: el.size.width,
              height: el.size.height,
              rotation: el.rotation,
              fill: EDITOR.furniture,
              stroke: plain ? EDITOR.furnitureStroke : colors.stroke,
              strokeWidth: plain ? 1 : 2,
              cornerRadius: 4,
              opacity: 0.85,
              name: 'sector-child',
              listening: false,
            }),
          );
        });
      } else {
        const newNode = createSectorNode(sector, canvasSize);
        this.elementsLayer!.add(newNode);
        this.attachSectorHandlers(newNode);
      }
    });

    const wantedIds = new Set(wanted.map((s) => s.id));
    this.elementsLayer!.getChildren().forEach((child) => {
      if (child.id() && child.hasName('sector-node') && !wantedIds.has(child.id())) {
        child.destroy();
      }
    });
    if (this.selectedSectorId && !wantedIds.has(this.selectedSectorId)) this.deselectSector();
    this.syncEditableState();
    if (this.selectedSectorId) this.selectSector(this.selectedSectorId);
    this.elementsLayer!.batchDraw();
  }

  private clearSectorNodes(): void {
    if (!this.elementsLayer) return;
    this.elementsLayer.getChildren().forEach((child) => {
      if (child.hasName('sector-node')) child.destroy();
    });
    if (this.sectorTransformer) {
      this.sectorTransformer.nodes([]);
      this.sectorTransformer.hide();
    }
    this.selectedSectorId = null;
  }

  private clearElementNodes(): void {
    if (!this.elementsLayer) return;
    this.elementsLayer.getChildren().forEach((child) => {
      if (child.hasName('space-element')) child.destroy();
    });
    if (this.transformer) {
      this.transformer.nodes([]);
      this.transformer.hide();
    }
    this._selectedElement.set(null);
  }

  private selectSector(id: SpaceElementId): void {
    if (!this.elementsLayer || !this.sectorTransformer) return;
    const node = this.elementsLayer.findOne(`#${id}`);
    if (!node || !node.hasName('sector-node')) return;

    this.deselectElement();
    this.selectedSectorId = id;
    this.sectorTransformer.nodes(this._editable() ? [node] : []);
    if (this._editable()) this.sectorTransformer.show();
    else this.sectorTransformer.hide();
    this.elementsLayer.batchDraw();
  }

  setSelectedSector(id: SpaceElementId | null): void {
    if (id === null) this.deselectSector();
    else this.selectSector(id);
  }

  private deselectSector(): void {
    this.selectedSectorId = null;
    if (!this.sectorTransformer) return;
    this.sectorTransformer.nodes([]);
    this.sectorTransformer.hide();
    this.elementsLayer?.batchDraw();
  }

  private attachSectorHandlers(node: Konva.Group): void {
    node.off('.sectorDrag');
    node.on('dragstart.sectorDrag', () => {
      if (!this._editable()) return;
      node.moveToTop();
      node.opacity(0.92);
      document.body.style.cursor = 'grabbing';
      this.sectorDragStartPos = { x: node.x(), y: node.y() };
    });
    node.on('dragend.sectorDrag', () => {
      if (!this._editable()) return;
      node.opacity(1);
      document.body.style.cursor = '';
      const moved =
        this.sectorDragStartPos !== null &&
        (Math.abs(node.x() - this.sectorDragStartPos.x) > 0.5 ||
          Math.abs(node.y() - this.sectorDragStartPos.y) > 0.5);
      this.sectorDragStartPos = null;
      if (moved) {
        node.position({ x: Math.round(node.x()), y: Math.round(node.y()) });
        this.sectorDragEndCallbacks.forEach((cb) =>
          cb({ id: node.id(), x: node.x(), y: node.y() }),
        );
      }
    });
  }

  private selectElement(id: SpaceElementId): void {
    if (!this.elementsLayer || !this.transformer) return;

    const node = this.elementsLayer.findOne(`#${id}`) as Konva.Group;
    if (!node || !isKonvaGroup(node) || !node.hasName('space-element')) return;

    // SOLO ignorar si el nodo YA está en medio de un arrastre físico
    if (node.isDragging()) {
      return;
    }

    // Si el elemento ya estaba seleccionado internamente pero es un nodo nuevo (sin transformer adjunto),
    // permitimos que el flujo continúe para reconectar los handlers.
    if (this._selectedElement() === id) {
      // Verificar si el transformer ya está en este nodo
      const currentNodes = this.transformer.nodes();
      if (currentNodes.length > 0 && currentNodes[0] === node && this._editable()) {
        this.showNamePill(node);
        this.transformer.forceUpdate();
        return; // Ya está completamente configurado
      }
      // Si llegamos aquí, es un nodo nuevo recreado - necesitamos reconectar handlers
    }

    // Limpia la selección anterior si existe
    this.deselectElement();

    // Save current position before attaching transformer (defensive)
    const savedX = node.x();
    const savedY = node.y();

    this._selectedElement.set(id);

    // HU-4.01 v2: selección = relleno azul claro + trazo azul + pill de nombre encima.
    this.applySelectionPaint(node, true);
    this.showNamePill(node);

    this.transformer.nodes(this._editable() ? [node] : []);
    if (this._editable() && !this.panning) this.transformer.show();
    else this.transformer.hide();

    // Ensure transformer is in the elementsLayer before moving to top
    if (!this.transformer.getLayer()) {
      this.elementsLayer.add(this.transformer);
    }

    // Prevent transformend callback during programmatic transformer operations
    this._isProgrammaticTransform = true;
    try {
      this.transformer.moveToTop();
    } finally {
      this._isProgrammaticTransform = false;
    }

    // Restore position in case transformer attachment affected it (defensive)
    if (node.x() !== savedX || node.y() !== savedY) {
      node.position({ x: savedX, y: savedY });
    }

    this.elementsLayer.batchDraw();

    if (this._editable()) {
      node.draggable(!this.panning);
      this.attachDragHandlers(node);
      this.attachTransformHandlers(node);
    }
  }

  private deselectElement(): void {
    if (!this.transformer || !this.elementsLayer) return;

    const prevId = this._selectedElement();
    if (prevId) {
      const prevNode = this.elementsLayer.findOne(`#${prevId}`);
      if (prevNode) {
        prevNode.off('.mapDrag');
        prevNode.off('.mapTransform');
        this.applySelectionPaint(prevNode as Konva.Group, false);
        this.hideNamePill(prevNode);
      }
    }
    // Clean transformer listeners to avoid ghost references
    this.transformer.off('transformend');
    this._selectedElement.set(null);
    this.transformer.nodes([]);
    this.transformer.hide();
    this.elementsLayer.batchDraw();
  }

  setSelectedElement(id: SpaceElementId | null): void {
    if (id && this.elementsLayer?.findOne(`#${id}`)?.hasName('space-element'))
      this.selectElement(id);
    else this.deselectElement();
  }

  /** HU-4.01 v2: pinta/despeja el tratamiento de selección del marcador. */
  private applySelectionPaint(node: Konva.Group, selected: boolean): void {
    const shape = node.findOne('.shape');
    if (!isKonvaRect(shape)) return;
    const el = this._layout().elements.find((e) => e.id === node.id());
    if (selected) {
      if (el?.type === 'SECTOR_ZONE') {
        shape.setAttrs({
          ...this.zoneStyle(el, Math.min(el.size.width, el.size.height)),
          stroke: EDITOR.selection,
          strokeEnabled: true,
        });
        return;
      }
      shape.fill(this.layoutFinish ? '#61a0ff35' : EDITOR.selectionFill);
      if (this.layoutFinish) shape.cornerRadius(10);
      shape.stroke(EDITOR.selection);
      shape.strokeWidth(2);
      return;
    }
    if (el) this.paintElement(shape, el);
  }

  private paintElement(shape: Konva.Rect, el: SpaceElement): void {
    if (el.type === 'SECTOR_ZONE') {
      shape.setAttrs({
        ...this.zoneStyle(el, Math.min(el.size.width, el.size.height)),
        shadowEnabled: false,
      });
      return;
    }
    const state = this.layoutFinish ? 'AVAILABLE' : paintState(el);
    if (this.layoutFinish && shape.getParent()?.findOne('.operational-art')) {
      shape.setAttrs({ fill: 'transparent', stroke: 'transparent', shadowEnabled: false });
      return;
    }
    shape.shadowEnabled(true);
    shape.fill(EDITOR.furniture);
    shape.stroke(state === 'AVAILABLE' ? EDITOR.furnitureStroke : STATE_COLORS[state].stroke);
    shape.strokeWidth(state === 'AVAILABLE' ? 1.5 : 3);
  }

  /** Pill de nombre sobre el seleccionado (referencia v2): pill azul sólido + texto blanco. */
  private showNamePill(node: Konva.Group): void {
    this.hideNamePill(node);
    const el = this._layout().elements.find((e) => e.id === node.id());
    if (!el || el.type === 'SECTOR_ZONE') return;
    if (el.attributes['showMapName'] === false) return;

    const labelStyle = el.attributes['mapLabelStyle'];
    const text = new Konva.Text({
      text: el.label,
      fontSize: 11,
      fontStyle: 'bold',
      fontFamily: 'system-ui, sans-serif',
      fill: labelStyle === 'outline' || labelStyle === 'text' ? EDITOR.selection : '#ffffff',
      name: 'pill-text',
    });
    const paddingX = 10;
    const pillWidth = text.width() + paddingX * 2;
    const pillHeight = 22;
    const pill = new Konva.Rect({
      width: pillWidth,
      height: pillHeight,
      fill: labelStyle === 'outline' ? '#ffffff' : EDITOR.selection,
      ...(labelStyle === 'outline' ? { stroke: EDITOR.selection } : {}),
      strokeWidth: 1,
      visible: labelStyle !== 'text',
      cornerRadius: pillHeight / 2,
      shadowColor: 'rgba(0,0,0,0.16)',
      shadowBlur: 6,
      shadowOffset: { x: 0, y: 2 },
      name: 'pill-bg',
    });
    text.x((pillWidth - text.width()) / 2);
    text.y((pillHeight - text.height()) / 2 + 1);

    const pillGroup = new Konva.Group({
      x: node.width() / 2 - pillWidth / 2,
      y: -pillHeight - 10,
      listening: false,
      name: 'name-pill',
    });
    pillGroup.add(pill);
    pillGroup.add(text);
    node.add(pillGroup);
  }

  private hideNamePill(node: Konva.Node): void {
    if (!(node instanceof Konva.Container)) return;

    const pills = node.find<Konva.Group>('.name-pill');
    pills.forEach((pill) => pill.destroy());
  }

  private attachDragHandlers(node: Konva.Group): void {
    const originalShadowColor = 'rgba(0,0,0,0.15)';
    const originalShadowBlur = 4;

    // SI EL NODO YA SE ESTÁ ARRASTRANDO NATIVAMENTE EN KONVA, NO TOCAR SUS LISTENERS
    if (node.isDragging()) return;

    // Clean up any previous handlers with our namespace
    node.off('.mapDrag');

    node.on('dragstart.mapDrag', () => {
      if (!this._editable()) return;
      const shape = node.findOne('.shape');
      if (isKonvaRect(shape)) {
        shape.shadowColor('rgba(0,0,0,0.3)');
        shape.shadowBlur(12);
        shape.shadowOffset({ x: 0, y: 6 });
      }
      node.moveToTop();
      node.opacity(0.9);
      document.body.style.cursor = 'grabbing';

      // Record start position to detect actual drag vs click
      this._dragStartPos = { x: node.x(), y: node.y() };

      // Emit drag start event for isDragging state
      this.dragStartCallbacks.forEach((cb) => cb(node.id()));
    });

    node.on('dragmove.mapDrag', () => {
      if (!this._editable()) return;
      // Emit real-time position for optimistic UI update
      const currentX = node.x();
      const currentY = node.y();
      if (
        typeof currentX === 'number' &&
        !isNaN(currentX) &&
        typeof currentY === 'number' &&
        !isNaN(currentY)
      ) {
        const x = Math.max(0, currentX);
        const y = Math.max(0, currentY);
        this.dragMoveCallbacks.forEach((cb) => cb({ id: node.id(), x, y }));
      }
    });

    node.on('dragend.mapDrag', () => {
      if (!this._editable()) return;
      node.opacity(1);
      const shape = node.findOne('.shape');
      if (isKonvaRect(shape)) {
        shape.shadowColor(originalShadowColor);
        shape.shadowBlur(originalShadowBlur);
        shape.shadowOffset({ x: 0, y: 2 });
      }

      // Only emit dragEnd if position actually changed (ignore clicks)
      const currentX = node.x();
      const currentY = node.y();
      const hasMoved =
        this._dragStartPos !== null &&
        (Math.abs(currentX - this._dragStartPos.x) > 0.5 ||
          Math.abs(currentY - this._dragStartPos.y) > 0.5);

      this._dragStartPos = null;
      document.body.style.cursor = '';

      if (hasMoved) {
        // Safeguard: only update position if valid
        if (
          typeof currentX === 'number' &&
          !isNaN(currentX) &&
          typeof currentY === 'number' &&
          !isNaN(currentY)
        ) {
          const x = Math.max(0, Math.round(currentX));
          const y = Math.max(0, Math.round(currentY));
          if (x !== currentX || y !== currentY) {
            node.position({ x, y });
          }
        }
        this.dragEndCallbacks.forEach((cb) => cb({ id: node.id(), x: node.x(), y: node.y() }));
      }
    });
  }

  private attachTransformHandlers(node: Konva.Group): void {
    if (!this.transformer) return;

    // Clean up previous transformend listeners to avoid multiple callbacks
    this.transformer.off('transformend');
    this.transformer.on('transformend', () => {
      // Skip if this is a programmatic transform (e.g., during element selection)
      if (!this._editable() || this._isProgrammaticTransform) return;

      // Get the current transform state from the transformer
      const rotation = ((Math.round(node.rotation()) % 360) + 360) % 360;
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const scaleX = this.transformer!.getNode()!.scaleX();
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const scaleY = this.transformer!.getNode()!.scaleY();

      const shape = node.findOne('.shape');
      if (!isKonvaRect(shape)) return;

      // Calculate real size after scale - bake the scale into actual dimensions
      const newWidth = Math.max(20, Math.round(shape.width() * Math.abs(scaleX)));
      const newHeight = Math.max(20, Math.round(shape.height() * Math.abs(scaleY)));

      node.rotation(rotation);
      if (this.isElementOutOfBounds(node, newWidth, newHeight)) {
        const original = this.layout().elements.find((el) => el.id === node.id());
        if (original) {
          node.position(original.position);
          node.rotation(original.rotation);
        }
        node.scale({ x: 1, y: 1 });
        this.transformer?.forceUpdate();
        this.elementsLayer!.batchDraw();
        return;
      }

      // Bake the scale into the node: reset scale to 1 and set actual width/height
      node.scaleX(1);
      node.scaleY(1);
      node.width(newWidth);
      node.height(newHeight);

      // Apply new size to the shape
      shape.width(newWidth);
      shape.height(newHeight);

      // Update label position
      const label = node.findOne('.label');
      if (!isKonvaText(label)) return;
      label.x((newWidth - Math.max(newWidth, 80)) / 2);
      label.y(newHeight + 8);
      label.width(Math.max(newWidth, 80));

      // Update capacity indicator positions
      const capBg = node.findOne('.capacity-bg');
      const capText = node.findOne('.capacity-text');
      if (isKonvaCircle(capBg) && isKonvaText(capText)) {
        capBg.x(newWidth - 12);
        capBg.y(12);
        capText.x(newWidth - 12);
        capText.y(12);
      }

      // Emit complete transform payload (position + rotation + size)
      // Note: resize from left/top anchors changes x,y position
      this.rotateEndCallbacks.forEach((cb) => cb({ id: node.id(), rotation }));
      this.resizeEndCallbacks.forEach((cb) =>
        cb({
          id: node.id(),
          x: node.x(),
          y: node.y(),
          width: newWidth,
          height: newHeight,
          rotation,
        }),
      );

      this.elementsLayer!.batchDraw();

      // Forzar al transformador a recalcular la caja delimitadora con los nuevos anchos/altos sin escala
      if (this.transformer) {
        this.transformer.forceUpdate();
      }

      // Redibujar la capa para aplicar el cambio visual instantáneamente
      this.elementsLayer!.batchDraw();
    });
  }

  private isElementOutOfBounds(node: Konva.Group, width: number, height: number): boolean {
    const radians = (node.rotation() * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const size = this.layout().size;
    return [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ].some(({ x, y }) => {
      const worldX = node.x() + x * cos - y * sin;
      const worldY = node.y() + x * sin + y * cos;
      return (
        worldX < -0.001 ||
        worldY < -0.001 ||
        worldX > size.width + 0.001 ||
        worldY > size.height + 0.001
      );
    });
  }

  setElementState(id: SpaceElementId, state: ElementState): void {
    if (!this.elementsLayer) return;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const node = this.elementsLayer.findOne(`#${id}`) as Konva.Group | undefined;
    if (!node) return;

    const shape = node.findOne('.shape');
    if (!isKonvaRect(shape)) return;
    const colors = STATE_COLORS[state];
    // HU-4.01 v2: el estado vive en el trazo; no teñir el relleno a sangre.
    const el = this._layout().elements.find((item) => item.id === id);
    if (!el?.availability && this._selectedElement() !== id) {
      shape.stroke(colors.stroke);
      shape.strokeWidth(state === 'AVAILABLE' ? 1.5 : 3);
    }
    this.elementsLayer.batchDraw();

    this._layout.update((current) => ({
      ...current,
      elements: current.elements.map((el) => (el.id === id ? { ...el, state } : el)),
    }));
  }

  setEditable(editable: boolean): void {
    this._editable.set(editable);
    this.syncEditableState();
    if (!this.elementsLayer) return;
    if (this._selectedElement()) this.selectElement(this._selectedElement()!);
    if (this.selectedSectorId) this.selectSector(this.selectedSectorId);
    this.elementsLayer.batchDraw();
  }

  private syncEditableState(): void {
    if (!this.elementsLayer) return;
    for (const child of this.elementsLayer.getChildren()) {
      if (!child.hasName('space-element') && !child.hasName('sector-node')) continue;
      const node = child as Konva.Group;
      node.draggable(this._editable() && !this.panning);
      if (this._editable()) {
        if (node.hasName('sector-node')) this.attachSectorHandlers(node);
        else this.attachDragHandlers(node);
      } else {
        node.off('.mapDrag');
        node.off('.sectorDrag');
      }
    }
    if (!this._editable()) {
      this.transformer?.nodes([]);
      this.transformer?.hide();
      this.sectorTransformer?.nodes([]);
      this.sectorTransformer?.hide();
    }
  }

  exportLayout(): MapLayout {
    return this._layout();
  }

  destroy(): void {
    // I-4: el motor es singleton app-wide; sin esta limpieza cada montaje apila
    // callbacks y un solo drop crearía N duplicados/altas fantasma.
    this.dragEndCallbacks = [];
    this.dragMoveCallbacks = [];
    this.dragStartCallbacks = [];
    this.rotateEndCallbacks = [];
    this.resizeEndCallbacks = [];
    this.clickCallbacks = [];
    this.sectorDragEndCallbacks = [];
    this.sectorRotateEndCallbacks = [];
    this.sectorClickCallbacks = [];
    this.sectorResizeCallbacks = [];
    this.externalDropCallbacks = [];
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.hostElement?.removeEventListener('dragover', this.handleDragOver);
    this.hostElement?.removeEventListener('drop', this.handleDrop);
    this.catalog?.destroy();
    this.catalog = null;
    this.layoutFinish = false;
    this.viewportEvents?.abort();
    this.viewportEvents = null;
    this.setPanning(false);
    this.fitted = false;
    this.cameraZoom.set(1);
    this.showGrid = true;
    this._selectedElement.set(null);
    this.selectedSectorId = null;
    this.sectorTransformer = null;
    if (this.stage) {
      this.stage.off('click tap');
      if (this.elementsLayer) {
        this.elementsLayer.off('click tap');
      }
      this.stage.destroy();
      this.stage = null;
      this.layer = null;
      this.elementsLayer = null;
      this.transformer = null;
      this.hostElement = null;
    }
  }

  onDragEnd(cb: (payload: { id: SpaceElementId; x: number; y: number }) => void): void {
    this.dragEndCallbacks.push(cb);
  }

  onDragMove(cb: (payload: { id: SpaceElementId; x: number; y: number }) => void): void {
    this.dragMoveCallbacks.push(cb);
  }

  onDragStart(cb: (id: SpaceElementId) => void): void {
    this.dragStartCallbacks.push(cb);
  }

  onRotateEnd(cb: (payload: { id: SpaceElementId; rotation: number }) => void): void {
    this.rotateEndCallbacks.push(cb);
  }

  onResizeEnd(
    cb: (payload: {
      id: SpaceElementId;
      x: number;
      y: number;
      width: number;
      height: number;
      rotation?: number;
    }) => void,
  ): void {
    this.resizeEndCallbacks.push(cb);
  }

  onElementClick(cb: (payload: { id: SpaceElementId | null }) => void): void {
    this.clickCallbacks.push(cb);
  }

  // ===== HU-4.01: API del modo planta =====

  onSectorDragEnd(cb: (payload: { id: SpaceElementId; x: number; y: number }) => void): void {
    this.sectorDragEndCallbacks.push(cb);
  }

  onSectorRotateEnd(cb: (payload: { id: SpaceElementId; rotation: number }) => void): void {
    this.sectorRotateEndCallbacks.push(cb);
  }

  onSectorResizeEnd(
    cb: (payload: {
      id: SpaceElementId;
      x: number;
      y: number;
      width: number;
      height: number;
    }) => void,
  ): void {
    this.sectorResizeCallbacks.push(cb);
  }

  onSectorClick(cb: (payload: { id: SpaceElementId | null }) => void): void {
    this.sectorClickCallbacks.push(cb);
  }

  onExternalDrop(cb: (payload: { key: string; x: number; y: number }) => void): void {
    this.externalDropCallbacks.push(cb);
  }
}

export function provideKonvaMapEngine() {
  return { provide: MAP_ENGINE, useClass: KonvaMapEngine };
}
