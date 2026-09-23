package com.mapit.spaces.domain;

import java.util.EnumSet;
import java.util.Set;

/**
 * Reglas sobre qué {@link SpaceElementType} admite cada {@link EstablishmentType}.
 *
 * <p>Vive en el dominio porque la vertical es una regla de negocio pura ("un restaurante
 * no tiene habitaciones de hotel" es una afirmación del modelo), y de esta forma es
 * testable sin Spring. La excepción de negocio correspondiente la lanza la capa de
 * aplicación, como en el resto de CU-05.
 *
 * <p><strong>Criterio actual (provisional; CU-07 lo refinará):</strong> {@code ROOM} solo
 * en hotel y {@code SEAT} solo en salón de eventos: las habitaciones y las butacas
 * numeradas son la seña de identidad de esas verticales según CU-21 y CU-22 de
 * {@code docs/roadmap/use_cases.md}. El resto de tipos se admite en las 4 verticales.
 *
 * <p>Es una clase aislada — y no una cascada de ifs repartida por los casos de uso —
 * porque CU-07 la extenderá con configuración por tenant: un único punto de cambio.
 */
public final class SpaceElementTypePolicy {

  private static final Set<SpaceElementType> TIPOS_COMUNES =
      Set.of(
          SpaceElementType.TABLE,
          SpaceElementType.BAR,
          SpaceElementType.SECTOR_ZONE,
          SpaceElementType.STAGE,
          SpaceElementType.DECOR);

  private static final Set<SpaceElementType> TIPOS_EVENT_HALL;
  private static final Set<SpaceElementType> TIPOS_HOTEL =
      Set.of(SpaceElementType.ROOM, SpaceElementType.DECOR);

  static {
    EnumSet<SpaceElementType> eventHall = EnumSet.copyOf(TIPOS_COMUNES);
    eventHall.add(SpaceElementType.SEAT);
    TIPOS_EVENT_HALL = Set.copyOf(eventHall);
  }

  private SpaceElementTypePolicy() {}

  /** Tipos de elemento que admite el vertical dado. Nunca vacío. */
  public static Set<SpaceElementType> permitidos(EstablishmentType vertical) {
    return switch (vertical) {
      case RESTAURANT, NIGHTCLUB -> TIPOS_COMUNES;
      case EVENT_HALL -> TIPOS_EVENT_HALL;
      case HOTEL -> TIPOS_HOTEL;
    };
  }

  /**
   * Indica si {@code type} es válido para un establecimiento del vertical dado.
   *
   * <p>Es la única validación "tipo × vertical" del sistema: si la regla cambia, solo se
   * toca aquí.
   */
  public static boolean esPermitido(EstablishmentType vertical, SpaceElementType type) {
    return permitidos(vertical).contains(type);
  }
}
