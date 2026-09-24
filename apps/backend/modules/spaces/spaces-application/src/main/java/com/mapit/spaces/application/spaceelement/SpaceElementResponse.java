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
    String state,
    Instant createdAt,
    Instant updatedAt) {

  /** Mapeo dominio → respuesta en un único punto (la auditoría ya vive en la entidad). */
  public static SpaceElementResponse fromDomain(
      com.mapit.spaces.domain.SpaceElement element) {
    var audit = element.audit();
    return new SpaceElementResponse(
        element.id().value(),
        element.sectorId(),
        element.type().name(),
        element.x(),
        element.y(),
        element.state().name(),
        audit.createdAt(),
        audit.updatedAt());
  }
}
