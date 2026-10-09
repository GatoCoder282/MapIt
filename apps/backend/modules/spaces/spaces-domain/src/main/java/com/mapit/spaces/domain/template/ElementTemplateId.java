package com.mapit.spaces.domain.template;

import java.util.Objects;
import java.util.UUID;

/**
 * Value object que identifica de forma única una {@link ElementTemplate} dentro del tenant.
 *
 * <p>Mismo patrón que {@code SpaceElementId}: el compilador impide confundir el id de una
 * plantilla con el id de un elemento o de un sector.
 */
public record ElementTemplateId(UUID value) {

  public ElementTemplateId {
    Objects.requireNonNull(value, "elementTemplateId no puede ser null");
  }

  public static ElementTemplateId of(UUID value) {
    return new ElementTemplateId(value);
  }

  public static ElementTemplateId generate() {
    return new ElementTemplateId(UUID.randomUUID());
  }

  @Override
  public String toString() {
    return value.toString();
  }
}
