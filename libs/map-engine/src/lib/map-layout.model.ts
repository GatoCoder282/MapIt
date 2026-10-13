/**
 * Modelo del mapa. **Es NUESTRO, no el de ningún proveedor.**
 *
 * Esto es deliberado: el motor de renderizado aún no está decidido (Konva propio
 * vs. un SDK tipo Seats.io). Si se adopta un SDK externo, se escribe un mapper
 * dentro de su adaptador y ni el backend, ni la base de datos, ni el contrato
 * OpenAPI cambian. Ver plan §4 y ADR-0006.
 *
 * Cumple CU-08/RF05: el mapa se persiste como estructura de datos, nunca como imagen.
 */

export type SpaceElementId = string;

/** Estados de un elemento del espacio (RF06). */
export type ElementState = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING' | 'OUT_OF_SERVICE';

/**
 * Tipos base de elemento. La genericidad de MapIt vive aquí: una misma base
 * representa una mesa de restaurante, una zona VIP de discoteca, una butaca
 * numerada de un teatro o una habitación de hotel.
 */
export type SpaceElementType =
  'TABLE' | 'BAR' | 'SECTOR_ZONE' | 'STAGE' | 'SEAT' | 'ROOM' | 'DECOR';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface SpaceElement {
  readonly id: SpaceElementId;
  readonly type: SpaceElementType;
  readonly label: string;
  readonly position: Point;
  readonly size: Size;
  /** Rotación en grados. */
  readonly rotation: number;
  readonly state: ElementState;
  /** Cuántas personas admite. `null` para elementos no reservables (decoración). */
  readonly capacity: number | null;
  readonly reservable: boolean;
  /** Atributos libres por plantilla de vertical (CU-07). */
  readonly attributes: Readonly<Record<string, string | number | boolean>>;
}

/**
 * Sector colocado en la vista de planta (HU-4.01).
 *
 * <p>Es una lente sobre las mismas filas del dominio (RN-3): `position` y `rotation`
 * son la colocación dentro del lienzo de la planta (se escriben con
 * `saveFloorLayout`), `size` es la dimensión intrínseca del sector y `children`
 * sus elementos en solo-lectura (se editan en la vista de sector, D-3).
 */
export interface SectorPlacement {
  readonly id: SpaceElementId;
  readonly label: string;
  readonly position: Point;
  readonly size: Size;
  /** Rotación en grados, normalizada a [0, 360). */
  readonly rotation: number;
  /** Elementos del sector en solo-lectura dentro del marco del sector. */
  readonly children: readonly SpaceElement[];
}

/** Contexto de edición del lienzo (HU-4.01): sector (detalle) o planta (composición). */
export type MapLayoutKind = 'sector' | 'floor';

export interface MapLayout {
  readonly floorId: string;
  readonly name: string;
  readonly size: Size;
  readonly elements: readonly SpaceElement[];
  /** Versión del esquema del layout, para migrar mapas guardados. */
  readonly schemaVersion: number;
  /**
   * HU-4.01: contexto del editor. `sector` (por defecto) = distribución interna;
   * `floor` = composición de sectores sobre el lienzo de la planta.
   */
  readonly kind?: MapLayoutKind;
  /** Solo en modo `floor`: sectores colocados con sus elementos (solo lectura). */
  readonly sectors?: readonly SectorPlacement[];
}

export const LAYOUT_VACIO: MapLayout = {
  floorId: '',
  name: '',
  size: { width: 1200, height: 800 },
  elements: [],
  schemaVersion: 1,
  kind: 'sector',
  sectors: [],
};

/**
 * Catálogo de defaults por tipo: tamaño inicial, capacidad y reservabilidad.
 *
 * Es la fuente única (editor, canvas y reservas leen de aquí). Solo se puede
 * reservar lo que sirve al cliente (mesa, sillas de barra, butaca numerada,
 * habitación); zona, escenario y decoración son infraestructura del local.
 */
export const TYPE_DEFAULTS: Record<
  SpaceElementType,
  { size: Size; capacity: number | null; reservable: boolean }
> = {
  TABLE: { size: { width: 80, height: 80 }, capacity: 4, reservable: true },
  BAR: { size: { width: 200, height: 60 }, capacity: null, reservable: true },
  SECTOR_ZONE: { size: { width: 300, height: 200 }, capacity: null, reservable: false },
  STAGE: { size: { width: 400, height: 200 }, capacity: null, reservable: false },
  SEAT: { size: { width: 40, height: 40 }, capacity: 1, reservable: true },
  ROOM: { size: { width: 100, height: 100 }, capacity: 2, reservable: true },
  DECOR: { size: { width: 60, height: 60 }, capacity: null, reservable: false },
};
