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

export interface MapLayout {
  readonly floorId: string;
  readonly name: string;
  readonly size: Size;
  readonly elements: readonly SpaceElement[];
  /** Versión del esquema del layout, para migrar mapas guardados. */
  readonly schemaVersion: number;
}

export const LAYOUT_VACIO: MapLayout = {
  floorId: '',
  name: '',
  size: { width: 1200, height: 800 },
  elements: [],
  schemaVersion: 1,
};
