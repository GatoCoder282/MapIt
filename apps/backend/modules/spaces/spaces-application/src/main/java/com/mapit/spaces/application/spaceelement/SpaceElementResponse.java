package com.mapit.spaces.application.spaceelement;

import java.time.Instant;
import java.util.UUID;

/** Respuesta de salida de un elemento espacial (HU-2.03 / MAP-114). */
public record SpaceElementResponse(
    UUID id,
    UUID sectorId,
    String type,
    double x,
    double y,
    double width,
    double height,
    double rotation,
    String state,
    Instant createdAt,
    Instant updatedAt, @org.jspecify.annotations.Nullable String label, @org.jspecify.annotations.Nullable Integer capacity, String name) {

  /** Mapeo dominio → respuesta en un único punto (la auditoría ya vive en la entidad). */
  public static SpaceElementResponse fromDomain(
      com.mapit.spaces.domain.spaceelement.SpaceElement element) {
    var audit = element.audit();
    return new SpaceElementResponse(
        element.id().value(),
        element.sectorId(),
        element.type().name(),
        element.x(),
        element.y(),
        element.width(),
        element.height(),
        element.rotation(),
        element.state().name(),
        audit.createdAt(),
        audit.updatedAt(), element.label(), element.capacity(), com.mapit.shared.spaces.SpaceDisplayName.format(element.type().name(), element.label()));
  }
}
