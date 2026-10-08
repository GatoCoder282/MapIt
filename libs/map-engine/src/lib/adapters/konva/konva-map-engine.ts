/* eslint-disable no-restricted-imports */
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Injectable, signal, type Signal, type WritableSignal } from '@angular/core';
import type {
  MapLayout,
  SpaceElement,
  SpaceElementId,
  Size,
  ElementState,
  SpaceElementType,
} from '../../map-layout.model';
import { MAP_ENGINE, type MapEnginePort } from '../../map-engine.port';

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

const TYPE_DEFAULTS: Record<
  SpaceElementType,
  { size: Size; capacity: number | null; reservable: boolean }
> = {
  TABLE: { size: { width: 80, height: 80 }, capacity: 4, reservable: true },
  BAR: { size: { width: 200, height: 60 }, capacity: null, reservable: false },
  SECTOR_ZONE: { size: { width: 300, height: 200 }, capacity: null, reservable: false },
  STAGE: { size: { width: 400, height: 200 }, capacity: null, reservable: false },
  SEAT: { size: { width: 40, height: 40 }, capacity: 1, reservable: true },
  ROOM: { size: { width: 100, height: 100 }, capacity: 2, reservable: true },
  DECOR: { size: { width: 60, height: 60 }, capacity: null, reservable: false },
};

function isKonvaGroup(node: Konva.Node | undefined): node is Konva.Group {
  return node instanceof Konva.Group;
}

const STATE_COLORS: Record<ElementState, { fill: string; stroke: string }> = {
  AVAILABLE: { fill: '#10b981', stroke: '#059669' },
  OCCUPIED: { fill: '#ef4444', stroke: '#dc2626' },
  RESERVED: { fill: '#f59e0b', stroke: '#d97706' },
  CLEANING: { fill: '#3b82f6', stroke: '#2563eb' },
  OUT_OF_SERVICE: { fill: '#6b7280', stroke: '#4b5563' },
};

function createElementNode(
  element: SpaceElement,
  sectorSize: { width: number; height: number },
): Konva.Group {
  const _defaults = TYPE_DEFAULTS[element.type] ?? TYPE_DEFAULTS.TABLE;
  const { width: elementWidth, height: elementHeight } = element.size;
  const { width: sectorWidth, height: sectorHeight } = sectorSize;

  // Ensure valid initial positions (defensive: API might return undefined)
  const initialX =
    typeof element.position.x === 'number' && !isNaN(element.position.x) ? element.position.x : 0;
  const initialY =
    typeof element.position.y === 'number' && !isNaN(element.position.y) ? element.position.y : 0;

  const group = new Konva.Group({
    id: element.id,
    x: initialX,
    y: initialY,
    width: elementWidth,
    height: elementHeight,
    rotation: element.rotation,
    draggable: true,
    dragBoundFunc: (pos) => {
      const newX = Math.max(0, Math.min(pos.x, sectorWidth - elementWidth));
      const newY = Math.max(0, Math.min(pos.y, sectorHeight - elementHeight));
      return { x: newX, y: newY };
    },
    name: 'space-element',
  });

  const { width, height } = element.size;
  const colors = STATE_COLORS[element.state];

  const shape = new Konva.Rect({
    width,
    height,
    fill: colors.fill,
    stroke: colors.stroke,
    strokeWidth: 2,
    cornerRadius: element.type === 'TABLE' || element.type === 'SEAT' ? 8 : 4,
    shadowColor: 'rgba(0,0,0,0.15)',
    shadowBlur: 4,
    shadowOffset: { x: 0, y: 2 },
    name: 'shape',
  });

  const label = new Konva.Text({
    text: element.label,
    x: width / 2,
    y: height + 16,
    fontSize: 11,
    fontFamily: 'system-ui, sans-serif',
    fill: '#374151',
    align: 'center',
    width: Math.max(width, 80),
    name: 'label',
  });

  const capacityIndicator =
    element.capacity !== null && element.reservable
      ? new Konva.Circle({
          x: width - 10,
          y: 10,
          radius: 10,
          fill: '#1f2937',
          stroke: '#fff',
          strokeWidth: 2,
          name: 'capacity-bg',
        })
      : null;

  const capacityText = capacityIndicator
    ? new Konva.Text({
        x: width - 10,
        y: 10,
        text: String(element.capacity),
        fontSize: 11,
        fontFamily: 'system-ui, sans-serif',
        fill: '#fff',
        align: 'center',
        verticalAlign: 'middle',
        name: 'capacity-text',
      })
    : null;

  group.add(shape);
  group.add(label);
  if (capacityIndicator) group.add(capacityIndicator);
  if (capacityText) group.add(capacityText);

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
    anchorSize: 10,
    anchorCornerRadius: 5,
    anchorStroke: '#333333',
    anchorFill: '#ffffff',
    anchorStrokeWidth: 1,
    borderStroke: '#007bff',
    borderDash: [3, 3],
    keepRatio: false,
    centeredScaling: false,
    rotateAnchorOffset: 20,
    padding: 5,
    ignoreStroke: true,
    visible: false,
    name: 'transformer',
  });
  layer.add(transformer);
  return transformer;
}

@Injectable({ providedIn: 'root' })
export class KonvaMapEngine implements MapEnginePort {
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
  }) => void)[] = [];
  private clickCallbacks: ((payload: { id: SpaceElementId | null }) => void)[] = [];

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
    this.layer = new Konva.Layer();

    this.elementsLayer = new Konva.Layer();

    this.stage.add(this.layer);
    this.stage.add(this.elementsLayer);

    this.transformer = createTransformer(this.elementsLayer);
    // Ensure transformer is in the elementsLayer
    this.elementsLayer.add(this.transformer);

    this.drawBackground(layout);
    this.load(layout);

    this.setupStageEvents();
    this.setupResizeObserver();
  }

  private setupResizeObserver(): void {
    if (!this.stage || !this.hostElement) return;
    this.resizeObserver = new ResizeObserver(() => {
      if (this.hostElement && this.stage) {
        const { width, height } = this.hostElement.getBoundingClientRect();
        this.stage.size({ width, height });
      }
    });
    this.resizeObserver.observe(this.hostElement);
  }

  private setupStageEvents(): void {
    if (!this.stage || !this.elementsLayer || !this.transformer) return;

    this.stage.on('click tap', (e: KonvaEventObject<MouseEvent>) => {
      if (e.target === this.stage) {
        this.deselectElement();
        this.clickCallbacks.forEach((cb) => cb({ id: null }));
      }
    });

    this.elementsLayer.on('click tap', (e: KonvaEventObject<MouseEvent>) => {
      // Ignore clicks on transformer handles
      if (this.transformer && e.target.getAncestors?.().includes(this.transformer)) return;

      const group = e.target.findAncestor('.space-element');
      if (group) {
        this.selectElement(group.id());
        this.clickCallbacks.forEach((cb) => cb({ id: group.id() }));
      }
    });
  }

  private drawBackground(layout: MapLayout): void {
    if (!this.layer) return;
    this.layer.destroyChildren();

    const { width, height } = layout.size;
    const gridSize = 50;

    const gridLayer = new Konva.Layer({
      listening: false, // Prevent grid/border from intercepting pointer events
    });
    for (let x = 0; x <= width; x += gridSize) {
      gridLayer.add(
        new Konva.Rect({ x, y: 0, width: 1, height, stroke: '#e5e7eb', strokeWidth: 0.5 }),
      );
    }
    for (let y = 0; y <= height; y += gridSize) {
      gridLayer.add(
        new Konva.Rect({ x: 0, y, width, height: 1, stroke: '#e5e7eb', strokeWidth: 0.5 }),
      );
    }

    const border = new Konva.Rect({
      x: 0,
      y: 0,
      width,
      height,
      stroke: '#9ca3af',
      strokeWidth: 2,
      fill: 'transparent',
      name: 'sector-border',
    });
    gridLayer.add(border);

    const title = new Konva.Text({
      x: 16,
      y: 12,
      text: layout.name || 'Sector',
      fontSize: 14,
      fontFamily: 'system-ui, sans-serif',
      fontWeight: 600,
      fill: '#374151',
    });
    gridLayer.add(title);

    // Add gridLayer BEFORE elementsLayer so it renders underneath
    this.stage!.add(gridLayer);
    this.stage!.add(this.layer);
    this.stage!.add(this.elementsLayer!);
  }

  load(layout: MapLayout): void {
    if (!this.elementsLayer) return;

    this._layout.set(layout);
    const sectorSize = { width: layout.size.width, height: layout.size.height };

    // 1. Actualizar nodos existentes o crear nuevos (SIN DESTRUIR LA CAPA)
    layout.elements.forEach((el) => {
      const node = this.elementsLayer!.findOne(`#${el.id}`) as Konva.Group;

      if (node && isKonvaGroup(node)) {
        // Nodo existente: solo actualizar posición visual
        node.position({ x: el.position.x, y: el.position.y });
      } else {
        // Nodo nuevo: crearlo, agregarlo a la capa y ATAR handlers
        const newNode = createElementNode(el, sectorSize);
        this.elementsLayer!.add(newNode);

        // CRÍTICO: Atar los eventos de arrastre/clic a este nuevo nodo
        this.attachDragHandlers(newNode);
        this.attachTransformHandlers(newNode);
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

    this.elementsLayer.batchDraw();
  }

  private selectElement(id: SpaceElementId): void {
    if (!this.elementsLayer || !this.transformer) return;

    const node = this.elementsLayer.findOne(`#${id}`) as Konva.Group;
    if (!node || !isKonvaGroup(node)) return;

    // SOLO ignorar si el nodo YA está en medio de un arrastre físico
    if (node.isDragging()) {
      return;
    }

    // Si el elemento ya estaba seleccionado internamente pero es un nodo nuevo (sin transformer adjunto),
    // permitimos que el flujo continúe para reconectar los handlers.
    if (this._selectedElement() === id) {
      // Verificar si el transformer ya está en este nodo
      const currentNodes = this.transformer.nodes();
      if (currentNodes.length > 0 && currentNodes[0] === node) {
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

    this.transformer.nodes([node]);
    this.transformer.show();

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
      node.draggable(true);
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
      }
    }
    this._selectedElement.set(null);
    this.transformer.nodes([]);
    this.transformer.hide();
    this.elementsLayer.batchDraw();
  }

  private attachDragHandlers(node: Konva.Group): void {
    const originalShadowColor = 'rgba(0,0,0,0.15)';
    const originalShadowBlur = 4;
    const _originalZIndex = node.zIndex();

    // SI EL NODO YA SE ESTÁ ARRASTRANDO NATIVAMENTE EN KONVA, NO TOCAR SUS LISTENERS
    if (node.isDragging()) return;

    // Clean up any previous handlers with our namespace
    node.off('.mapDrag');

    node.on('dragstart.mapDrag', () => {
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

    node.on('dragmove.mapDrag', (_e) => {
      // Emit real-time position for optimistic UI update
      const currentX = node.x();
      const currentY = node.y();
      if (
        typeof currentX === 'number' &&
        !isNaN(currentX) &&
        typeof currentY === 'number' &&
        !isNaN(currentY)
      ) {
        const x = Math.max(0, Math.round(currentX));
        const y = Math.max(0, Math.round(currentY));
        this.dragMoveCallbacks.forEach((cb) => cb({ id: node.id(), x, y }));
      }
    });

    node.on('dragend.mapDrag', () => {
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

    this.transformer.on('transformend', () => {
      // Skip if this is a programmatic transform (e.g., during element selection)
      if (this._isProgrammaticTransform) return;

      const rotation = Math.round(this.transformer!.rotation() % 360);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const scaleX = this.transformer!.getNode()!.scaleX();
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const scaleY = this.transformer!.getNode()!.scaleY();

      const shape = node.findOne('.shape');
      if (!isKonvaRect(shape)) return;

      // Calculate real size after scale
      const newWidth = Math.max(20, Math.round(shape.width() * scaleX));
      const newHeight = Math.max(20, Math.round(shape.height() * scaleY));

      // Check bounds before applying
      if (this.isElementOutOfBounds(node, newWidth, newHeight)) {
        // Revert rotation and scale
        node.rotation(0);
        node.scale({ x: 1, y: 1 });
        this.transformer!.rotation(0);
        this.elementsLayer!.batchDraw();
        return;
      }

      // Apply new size and reset scale
      shape.width(newWidth);
      shape.height(newHeight);
      node.scale({ x: 1, y: 1 });

      // Update label position
      const label = node.findOne('.label');
      if (!isKonvaText(label)) return;
      label.x(newWidth / 2);
      label.y(newHeight + 16);
      label.width(Math.max(newWidth, 80));

      const capBg = node.findOne('.capacity-bg');
      const capText = node.findOne('.capacity-text');
      if (isKonvaCircle(capBg) && isKonvaText(capText)) {
        capBg.x(newWidth - 10);
        capBg.y(10);
        capText.x(newWidth - 10);
        capText.y(10);
      }

      // Emit complete transform payload (position + rotation + size)
      // Note: resize from left/top anchors changes x,y position
      this.rotateEndCallbacks.forEach((cb) => cb({ id: node.id(), rotation }));
      this.resizeEndCallbacks.forEach((cb) =>
        cb({ id: node.id(), x: node.x(), y: node.y(), width: newWidth, height: newHeight }),
      );

      this.elementsLayer!.batchDraw();
    });
  }

  private isElementOutOfBounds(node: Konva.Group, width: number, height: number): boolean {
    const _x = node.x();
    const _y = node.y();
    const rotation = node.rotation();

    // For simplicity, check if the bounding box of the rotated element fits in the sector
    // This is a conservative check - we check if the rotated element's bounding box fits
    const halfW = width / 2;
    const halfH = height / 2;
    // const sectorSize = { width: this._layout().size.width, height: this._layout().size.height };

    // Calculate the four corners of the rotated rectangle
    // const cos = Math.cos((rotation * Math.PI) / 180);
    // const sin = Math.sin((rotation * Math.PI) / 180);

    const corners = [
      { x: -halfW, y: -halfH },
      { x: halfW, y: -halfH },
      { x: halfW, y: halfH },
      { x: -halfW, y: halfH },
    ];

    for (const corner of corners) {
      const rx =
        corner.x * Math.cos((rotation * Math.PI) / 180) -
        corner.y * Math.sin((rotation * Math.PI) / 180);
      const ry =
        corner.x * Math.sin((rotation * Math.PI) / 180) +
        corner.y * Math.cos((rotation * Math.PI) / 180);
      const worldX = node.x() + rx;
      const worldY = node.y() + ry;

      if (
        worldX < 0 ||
        worldX > this._layout().size.width ||
        worldY < 0 ||
        worldY > this._layout().size.height
      ) {
        return true;
      }
    }
    return false;
  }

  setElementState(id: SpaceElementId, state: ElementState): void {
    if (!this.elementsLayer) return;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const node = this.elementsLayer.findOne(`#${id}`) as Konva.Group | undefined;
    if (!node) return;

    const shape = node.findOne('.shape');
    if (!isKonvaRect(shape)) return;
    const colors = STATE_COLORS[state];
    shape.fill(colors.fill);
    shape.stroke(colors.stroke);
    this.elementsLayer.batchDraw();

    this._layout.update((current) => ({
      ...current,
      elements: current.elements.map((el) => (el.id === id ? { ...el, state } : el)),
    }));
  }

  setEditable(editable: boolean): void {
    this._editable.set(editable);
    if (!this.elementsLayer || !this.transformer) return;

    if (!editable) {
      this.deselectElement();
      this.elementsLayer.children.forEach((child) => {
        if (child.hasName('space-element')) {
          (child as Konva.Group).draggable(false);
        }
      });
    } else if (this._selectedElement()) {
      this.selectElement(this._selectedElement()!);
    }
    this.elementsLayer.batchDraw();
  }

  exportLayout(): MapLayout {
    return this._layout();
  }

  destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
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
    }) => void,
  ): void {
    this.resizeEndCallbacks.push(cb);
  }

  onElementClick(cb: (payload: { id: SpaceElementId | null }) => void): void {
    this.clickCallbacks.push(cb);
  }
}

export function provideKonvaMapEngine() {
  return { provide: MAP_ENGINE, useClass: KonvaMapEngine };
}
