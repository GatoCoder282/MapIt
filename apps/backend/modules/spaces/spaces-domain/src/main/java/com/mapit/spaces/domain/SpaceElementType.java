package com.mapit.spaces.domain;

/**
 * Tipos base de elemento espacial (RF04, CU-08 / HU-2.03).
 *
 * <p>Es un enum y no un {@code String} por la misma razón que {@link EstablishmentType}:
 * el conjunto es cerrado y el compilador debe impedir valores inventados.
 *
 * <p>Los valores son los mismos que el modelo TypeScript de {@code libs/map-engine}
 * ({@code SpaceElementType}), que es el modelo propio de MapIt (ADR-0006). Una misma base
 * representa una mesa de restaurante, una zona VIP de discoteca, una butaca de teatro o una
 * habitación de hotel. Cuando CU-07 introduzca plantillas configurables, este enum seguirá
 * siendo la base y las plantillas se apoyarán en él.
 */
public enum SpaceElementType {
  /** Mesa (restaurante, discoteca, salón de eventos). */
  TABLE,
  /** Barra o barra de servicio (restaurante, discoteca). */
  BAR,
  /** Zona o área sin asientos asignables (pista, zona VIP, pasillo amplio). */
  SECTOR_ZONE,
  /** Escenario. */
  STAGE,
  /** Butaca o ubicación numerada (salón de eventos). */
  SEAT,
  /** Habitación (hotel). */
  ROOM,
  /** Decoración sin reserva (planta, pared, arte). */
  DECOR
}
