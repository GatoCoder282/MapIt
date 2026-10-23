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
  ElementState,
  SpaceElementType,
} from '../../map-layout.model';
import { TYPE_DEFAULTS } from '../../map-layout.model';
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

/** Paleta del editor (espejo de --mapit-editor-* de ui-kit; el adaptador es imperativo). */
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
    dragBoundFunc: (pos: Konva.Vector2d) => {
      // Use the group from closure to get actual dimensions and rotation
      const rotation = group.rotation();
      const w = group.width();
      const h = group.height();

      // Convertir rotación a radianes
      const rad = (rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      // Calcular las 4 esquinas del objeto rotado respecto a su origen (0,0)
      // La caja AABB es el rectángulo que envuelve el objeto rotado
      const corners = [
        { x: 0, y: 0 }, // Arriba-Izquierda
        { x: w * cos, y: w * sin }, // Arriba-Derecha
        { x: -h * sin, y: h * cos }, // Abajo-Izquierda
        { x: w * cos - h * sin, y: w * sin + h * cos }, // Abajo-Derecha
      ];

      // Encontrar los deltas mínimos y máximos de la caja rotada (AABB)
      const minX = Math.min(...corners.map((c) => c.x));
      const maxX = Math.max(...corners.map((c) => c.x));
      const minY = Math.min(...corners.map((c) => c.y));
      const maxY = Math.max(...corners.map((c) => c.y));

      // Calcular los límites reales permitidos para pos.x y pos.y
      // sectorWidth y sectorHeight vienen del scope de la función
      const newX = Math.max(-minX, Math.min(pos.x, sectorWidth - maxX));
      const newY = Math.max(-minY, Math.min(pos.y, sectorHeight - maxY));

      return { x: newX, y: newY };
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
  const colors = STATE_COLORS[element.state];

  // HU-4.01 v2: reposo = blanco con outline pizarra; el estado vive en el trazo (más
  // grueso) y nunca rellena el marcador. La selección la pinta el adaptador al
  // seleccionar (relleno azul claro + marco), no la creación del nodo.
  const isPlain = element.state === 'AVAILABLE';
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
    x: width / 2,
    y: height + 16,
    fontSize: 11,
    fontFamily: 'system-ui, sans-serif',
    fill: EDITOR.panelMuted,
    align: 'center',
    width: Math.max(width, 80),
    name: 'label',
  });

  const radius = 14;
  const offset = 12; // Separación desde la esquina

  const capacityIndicator =
    element.capacity !== null && element.reservable
      ? new Konva.Circle({
          x: width - offset,
          y: offset,
          radius: radius,
          fill: EDITOR.selection,
          stroke: '#ffffff',
          strokeWidth: 2,
          name: 'capacity-bg',
        })
      : null;

  const capacityText = capacityIndicator
    ? new Konva.Text({
        x: width - offset, // Mismo centro que el círculo
        y: offset,
        text: String(element.capacity),
        fontSize: 14,
        fontStyle: 'bold',
        fontFamily: 'system-ui, sans-serif',
        fill: '#ffffff',
        align: 'center',
        verticalAlign: 'middle',
        width: radius * 2,
        offsetX: radius, // Desplaza la caja de texto a la izquierda por la mitad de su ancho
        offsetY: 7, // Desplaza hacia arriba la mitad del tamaño de la fuente (14/2)
        name: 'capacity-text',
      })
    : null;

  group.add(shape);
  group.add(label);
  if (capacityIndicator) group.add(capacityIndicator);
  if (capacityText) group.add(capacityText);

  return group;
}

function createSectorNode(
  sector: SectorPlacementModel,
  canvasSize: { width: number; height: number },
): Konva.Group {
  const { width: sectorWidth, height: sectorHeight } = sector.size;

  const group = new Konva.Group({
    id: sector.id,
    x: sector.position.x,
    y: sector.position.y,
    width: sectorWidth,
    height: sectorHeight,
    rotation: sector.rotation,
    draggable: true,
    dragBoundFunc: (pos: Konva.Vector2d) => {
      const rad = (group.rotation() * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const corners = [
        { x: 0, y: 0 },
        { x: sectorWidth * cos, y: sectorWidth * sin },
        { x: -sectorHeight * sin, y: sectorHeight * cos },
        { x: sectorWidth * cos - sectorHeight * sin, y: sectorWidth * sin + sectorHeight * cos },
      ];
      const minX = Math.min(...corners.map((c) => c.x));
      const maxX = Math.max(...corners.map((c) => c.x));
      const minY = Math.min(...corners.map((c) => c.y));
      const maxY = Math.max(...corners.map((c) => c.y));
      return {
        x: Math.max(-minX, Math.min(pos.x, canvasSize.width - maxX)),
        y: Math.max(-minY, Math.min(pos.y, canvasSize.height - maxY)),
      };
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
    const colors = STATE_COLORS[el.state];
    const plain = el.state === 'AVAILABLE';
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

function createTransformer(layer: Konva.Layer, engine: KonvaMapEngine): Konva.Transformer {
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
    boundBoxFunc: (oldBox, newBox) => {
      const sectorWidth = engine.layout()?.size?.width || 0;
      const sectorHeight = engine.layout()?.size?.height || 0;

      if (
        newBox.x < 0 ||
        newBox.y < 0 ||
        newBox.x + newBox.width > sectorWidth ||
        newBox.y + newBox.height > sectorHeight
      ) {
        return oldBox;
      }
      return newBox;
    },
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
  private externalDropCallbacks: ((payload: { key: string; x: number; y: number }) => void)[] = [];
  private sectorTransformer: Konva.Transformer | null = null;
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
    this.layer = new Konva.Layer();

    this.elementsLayer = new Konva.Layer();

    this.stage.add(this.layer);
    this.stage.add(this.elementsLayer);

    this.transformer = createTransformer(this.elementsLayer, this);
    // Ensure transformer is in the elementsLayer
    this.elementsLayer.add(this.transformer);

    // HU-4.01: transformer del modo planta � solo rotación de sectores (su tamaño
    // intrínseco se edita en la vista de sector, D-3) y sin anclas de resize.
    const sectorTr = new Konva.Transformer({
      enabledAnchors: [],
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
      if (this._isProgrammaticTransform) return;
      const target = sectorTr.nodes()[0];
      if (!target) return;
      // Solo rotación: el tamaño intrínseco no se edita en la vista de planta (D-3).
      target.scale({ x: 1, y: 1 });
      const rotation = ((Math.round(target.rotation()) % 360) + 360) % 360;
      target.rotation(rotation);
      this.sectorRotateEndCallbacks.forEach((cb) => cb({ id: target.id(), rotation }));
      sectorTr.forceUpdate();
      this.elementsLayer?.batchDraw();
    });

    this.drawBackground(layout);
    this.load(layout);

    this.setupStageEvents();
    this.setupExternalDrop(host);
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
        this.deselectSector();
        this.clickCallbacks.forEach((cb) => cb({ id: null }));
        this.sectorClickCallbacks.forEach((cb) => cb({ id: null }));
      }
    });

    this.elementsLayer.on('click tap', (e: KonvaEventObject<MouseEvent>) => {
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
   * El stage vive en (0,0) del host: sin pan/zoom actual, basta la resta del rect.
   */
  private setupExternalDrop(host: HTMLElement): void {
    host.addEventListener('dragover', (event: DragEvent) => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    });
    host.addEventListener('drop', (event: DragEvent) => {
      event.preventDefault();
      const key = event.dataTransfer?.getData('text/plain');
      if (!key) return;
      const rect = host.getBoundingClientRect();
      const x = Math.max(0, Math.round(event.clientX - rect.left));
      const y = Math.max(0, Math.round(event.clientY - rect.top));
      this.externalDropCallbacks.forEach((cb) => cb({ key, x, y }));
    });
  }

  drawBackground(layout: MapLayout): void {
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
      stroke: EDITOR.furnitureStroke,
      strokeWidth: 2,
      fill: 'transparent',
      name: 'sector-border',
    });
    gridLayer.add(border);

    // Sin título dentro del lienzo: el nombre del sector ya vive en el header
    // del editor; dibujarlo aquí duplicaba la información sobre el grid.

    // Add gridLayer BEFORE elementsLayer so it renders underneath
    this.stage!.add(gridLayer);
    this.stage!.add(this.layer);
    this.stage!.add(this.elementsLayer!);
  }

  load(layout: MapLayout): void {
    if (!this.elementsLayer) return;

    this._layout.set(layout);

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
        // Nodo existente: sincronizar TODA la geometría (posición, rotación, tamaño)
        node.position({ x: el.position.x, y: el.position.y });
        node.rotation(el.rotation);

        // Actualizar tamaño de la figura principal (.shape)
        const shape = node.findOne('.shape') as Konva.Rect;
        if (shape) {
          shape.width(el.size.width);
          shape.height(el.size.height);
        }

        // Actualizar label (centrado horizontal)
        const label = node.findOne('.label') as Konva.Text;
        if (label) {
          label.x(el.size.width / 2);
          label.y(el.size.height + 16);
          label.width(Math.max(el.size.width, 80));
        }

        // Actualizar capacity-bg y capacity-text si existen
        const capBg = node.findOne('.capacity-bg') as Konva.Circle;
        const capText = node.findOne('.capacity-text') as Konva.Text;
        if (capBg && capText) {
          capBg.x(el.size.width - 10);
          capBg.y(10);
          capText.x(el.size.width - 10);
          capText.y(10);
        }
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

    this.elementsLayer.batchDraw();
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
          const colors = STATE_COLORS[el.state];
          const plain = el.state === 'AVAILABLE';
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
    if (this.sectorTransformer) this.sectorTransformer.nodes([]);
    this.sectorTransformer.nodes([node]);
    this.sectorTransformer.show();
    this.elementsLayer.batchDraw();
  }

  private deselectSector(): void {
    if (!this.sectorTransformer) return;
    this.sectorTransformer.nodes([]);
    this.sectorTransformer.hide();
    this.elementsLayer?.batchDraw();
  }

  private attachSectorHandlers(node: Konva.Group): void {
    node.off('.sectorDrag');
    node.on('dragstart.sectorDrag', () => {
      node.moveToTop();
      node.opacity(0.92);
      document.body.style.cursor = 'grabbing';
      this.sectorDragStartPos = { x: node.x(), y: node.y() };
    });
    node.on('dragend.sectorDrag', () => {
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

    // HU-4.01 v2: selección = relleno azul claro + trazo azul + pill de nombre encima.
    this.applySelectionPaint(node, true);
    this.showNamePill(node);

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

  /** HU-4.01 v2: pinta/despeja el tratamiento de selección del marcador. */
  private applySelectionPaint(node: Konva.Group, selected: boolean): void {
    const shape = node.findOne('.shape');
    if (!isKonvaRect(shape)) return;
    if (selected) {
      shape.fill(EDITOR.selectionFill);
      shape.stroke(EDITOR.selection);
      shape.strokeWidth(2);
      return;
    }
    const el = this._layout().elements.find((e) => e.id === node.id());
    const stateStroke = el ? STATE_COLORS[el.state].stroke : EDITOR.furnitureStroke;
    const plain = !el || el.state === 'AVAILABLE';
    shape.fill(EDITOR.furniture);
    shape.stroke(plain ? EDITOR.furnitureStroke : stateStroke);
    shape.strokeWidth(plain ? 1.5 : 3);
  }

  /** Pill de nombre sobre el seleccionado (referencia v2): pill azul sólido + texto blanco. */
  private showNamePill(node: Konva.Group): void {
    this.hideNamePill(node);
    const el = this._layout().elements.find((e) => e.id === node.id());
    if (!el) return;

    const text = new Konva.Text({
      text: el.label,
      fontSize: 11,
      fontStyle: 'bold',
      fontFamily: 'system-ui, sans-serif',
      fill: '#ffffff',
      name: 'pill-text',
    });
    const paddingX = 10;
    const pillWidth = text.width() + paddingX * 2;
    const pillHeight = 22;
    const pill = new Konva.Rect({
      width: pillWidth,
      height: pillHeight,
      fill: EDITOR.selection,
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

    // Clean up previous transformend listeners to avoid multiple callbacks
    this.transformer.off('transformend');
    this.transformer.on('transformend', () => {
      // Skip if this is a programmatic transform (e.g., during element selection)
      if (this._isProgrammaticTransform) return;

      // Get the current transform state from the transformer
      const rotation = Math.round(this.transformer!.rotation() % 360);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const scaleX = this.transformer!.getNode()!.scaleX();
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const scaleY = this.transformer!.getNode()!.scaleY();

      const shape = node.findOne('.shape');
      if (!isKonvaRect(shape)) return;

      // Calculate real size after scale - bake the scale into actual dimensions
      const newWidth = Math.max(20, Math.round(shape.width() * Math.abs(scaleX)));
      const newHeight = Math.max(20, Math.round(shape.height() * Math.abs(scaleY)));

      // Check bounds before applying - use node's x,y and new dimensions
      // Check bounds before applying - use node's x,y and new dimensions
      if (this.isElementOutOfBounds(node, newWidth, newHeight)) {
        // Revert scale only, keep rotation
        node.scale({ x: 1, y: 1 });
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
      label.x(newWidth / 2);
      label.y(newHeight + 16);
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
        cb({ id: node.id(), x: node.x(), y: node.y(), width: newWidth, height: newHeight }),
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

      const sectorSize = this.layout().size;
      if (worldX < 0 || worldX > sectorSize.width || worldY < 0 || worldY > sectorSize.height) {
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
    // HU-4.01 v2: el estado vive en el trazo; no teñir el relleno a sangre.
    shape.stroke(colors.stroke);
    shape.strokeWidth(state === 'AVAILABLE' ? 1.5 : 3);
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
    this.externalDropCallbacks = [];
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

  // ===== HU-4.01: API del modo planta =====

  onSectorDragEnd(cb: (payload: { id: SpaceElementId; x: number; y: number }) => void): void {
    this.sectorDragEndCallbacks.push(cb);
  }

  onSectorRotateEnd(cb: (payload: { id: SpaceElementId; rotation: number }) => void): void {
    this.sectorRotateEndCallbacks.push(cb);
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
