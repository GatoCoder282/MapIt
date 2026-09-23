package com.mapit.spaces.domain;

import java.util.Objects;
import java.util.UUID;

/**
 * Value object que identifica de forma única un {@link SpaceElement} dentro del tenant.
 *
 * <p>Mismo motivo que {@link SectorId}: el compilador impide confundir el id de un
 * elemento con el id del sector que lo contiene o con cualquier otro {@code UUID}.
 */
public record SpaceElementId(UUID value) {

  public SpaceElementId {
    Objects.requireNonNull(value, "spaceElementId no puede ser null");
  }

  public static SpaceElementId of(UUID value) {
    return new SpaceElementId(value);
  }

  public static SpaceElementId generate() {
    return new SpaceElementId(UUID.randomUUID());
  }

  @Override
  public String toString() {
    return value.toString();
  }
}
