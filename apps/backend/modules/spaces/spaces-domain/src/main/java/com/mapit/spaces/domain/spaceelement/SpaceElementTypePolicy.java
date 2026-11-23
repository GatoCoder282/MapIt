package com.mapit.spaces.domain.spaceelement;

import java.util.Set;
import java.util.stream.Collectors;

import com.mapit.shared.vertical.VerticalCatalog;
import com.mapit.spaces.domain.establishment.EstablishmentType;

/** Adapta el catálogo compartido a los tipos del dominio espacial. */
public final class SpaceElementTypePolicy {
  private SpaceElementTypePolicy() {}

  public static Set<SpaceElementType> permitidos(EstablishmentType vertical) {
    return VerticalCatalog.of(vertical.name()).allowedElementTypes().stream()
        .map(SpaceElementType::valueOf)
        .collect(Collectors.toUnmodifiableSet());
  }

  public static boolean esPermitido(EstablishmentType vertical, SpaceElementType type) {
    return VerticalCatalog.of(vertical.name()).isAllowed(type.name());
  }
}
