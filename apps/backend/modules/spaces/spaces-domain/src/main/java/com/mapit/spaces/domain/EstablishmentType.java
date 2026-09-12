package com.mapit.spaces.domain;

/**
 * Tipo de establecimiento: las cuatro verticales que atiende el mismo motor.
 *
 * <p>Es un enum y no un {@code String} porque el conjunto de valores es cerrado y el
 * compilador debe impedir cualquier otro. Además decide qué plantillas de elemento
 * aplican (CU-07), así que un valor inventado rompería el editor de mapas.
 *
 * <p>Coincide en valores con {@code BusinessVertical} del contexto {@code platform},
 * pero se declara aparte a propósito: los módulos no se importan entre sí (regla 3 de
 * {@code apps/backend/AGENTS.md}) y son conceptos de contextos distintos.
 */
public enum EstablishmentType {
  RESTAURANT,
  NIGHTCLUB,
  EVENT_HALL,
  HOTEL
}
