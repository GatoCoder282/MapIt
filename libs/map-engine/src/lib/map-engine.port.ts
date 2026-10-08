import { InjectionToken, type Signal } from '@angular/core';

import { type ElementState, type MapLayout, type SpaceElementId } from './map-layout.model';

/**
 * PUERTO del motor de mapa.
 *
 * Las features (`map-editor`, `operations`) programan contra esta interfaz y
 * nunca contra Konva ni contra ningún SDK. Cambiar de motor debe ser cambiar
 * de proveedor en la inyección de dependencias, no reescribir features.
 *
 * Hay una regla de lint que impide importar `konva` fuera de su adaptador.
 *
 * Decisión pendiente (ADR-0006): Konva propio vs. SDK externo tipo Seats.io.
 * Si se evalúa un SDK, verificar que permita **persistir el layout en nuestra
 * base de datos**: algunos proveedores retienen los mapas en su nube, lo que
 * incumpliría CU-08.
 */
export interface MapEnginePort {
  /** Monta el motor sobre un elemento del DOM y pinta el layout. */
  mount(host: HTMLElement, layout: MapLayout): void;

  /** Elemento seleccionado ahora mismo, o `null`. */
  readonly selectedElement: Signal<SpaceElementId | null>;

  /** Layout actual, reactivo a las ediciones del usuario. */
  readonly layout: Signal<MapLayout>;

  /** Cambia el estado de un elemento (CU-09). Debe reflejarse en < 2s (RNF04). */
  setElementState(id: SpaceElementId, state: ElementState): void;

  /** Carga un layout distinto sin volver a montar. */
  load(layout: MapLayout): void;

  /** Devuelve el layout para persistirlo. Siempre datos, jamás una imagen. */
  exportLayout(): MapLayout;

  /** Habilita o deshabilita la edición (la vista de operación es de solo lectura). */
  setEditable(editable: boolean): void;

  /** Libera recursos. Obligatorio: el canvas retiene memoria si no se llama. */
  destroy(): void;

  /** Suscribe a eventos de fin de arrastre de un elemento. */
  onDragEnd(cb: (payload: { id: SpaceElementId; x: number; y: number }) => void): void;

  /** Suscribe a eventos de fin de rotación de un elemento. */
  onRotateEnd(cb: (payload: { id: SpaceElementId; rotation: number }) => void): void;

  /** Suscribe a eventos de fin de redimensionamiento de un elemento. */
  onResizeEnd(
    cb: (payload: {
      id: SpaceElementId;
      x: number;
      y: number;
      width: number;
      height: number;
    }) => void,
  ): void;

  /** Suscribe a eventos de clic en elemento (o fondo para deseleccionar). */
  onElementClick(cb: (payload: { id: SpaceElementId | null }) => void): void;

  /** Suscribe a eventos de arrastre en tiempo real (dragmove). */
  onDragMove(cb: (payload: { id: SpaceElementId; x: number; y: number }) => void): void;

  /** Suscribe a eventos de inicio de arrastre. */
  onDragStart(cb: (id: SpaceElementId) => void): void;
}

export const MAP_ENGINE = new InjectionToken<MapEnginePort>('mapit.map-engine');
