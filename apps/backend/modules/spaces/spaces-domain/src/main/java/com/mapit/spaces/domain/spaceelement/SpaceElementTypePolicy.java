package com.mapit.spaces.domain.spaceelement;

import java.util.EnumSet;
import java.util.Set;

import com.mapit.shared.vertical.VerticalCatalog;
import com.mapit.spaces.domain.establishment.EstablishmentType;
/**
 * Reglas sobre qué {@link SpaceElementType} admite cada {@link EstablishmentType}.
 *
 * <p>Vive en el dominio porque la vertical es una regla de negocio pura ("un restaurante
 * no tiene habitaciones de hotel" es una afirmación del modelo), y de esta forma es
 * testable sin Spring. La excepción de negocio correspondiente la lanza la capa de
 * aplicación, como en el resto de CU-05.
 *
 * <p><strong>Criterio (HU-7.01/7.02, spec D5):</strong> la matriz ya no vive aquí sino en
 * {@link VerticalCatalog} del shared kernel, que comparte con reservations la lista de tipos
 * reservables. Esta clase la traduce a los enums de spaces: el editor nunca ofrece un tipo que
 * la vertical no admita, y reservations nunca acepta uno que el editor no pudo crear.
 */
public final class SpaceElementTypePolicy {

  private SpaceElementTypePolicy() {}

  /** Tipos de elemento que admite el vertical dado. Nunca vacío. */
  public static Set<SpaceElementType> permitidos(EstablishmentType vertical) {
    Set<SpaceElementType> tipos = EnumSet.noneOf(SpaceElementType.class);
    VerticalCatalog.of(vertical.name())
        .allowedElementTypes()
        .forEach(type -> tipos.add(SpaceElementType.valueOf(type)));
    return Set.copyOf(tipos);
  }

  /**
   * Indica si {@code type} es válido para un establecimiento del vertical dado.
   *
   * <p>Es la única validación "tipo × vertical" del sistema: si la regla cambia, solo se
   * toca el catálogo.
   */
  public static boolean esPermitido(EstablishmentType vertical, SpaceElementType type) {
    return VerticalCatalog.of(vertical.name()).isAllowed(type.name());
  }
}
