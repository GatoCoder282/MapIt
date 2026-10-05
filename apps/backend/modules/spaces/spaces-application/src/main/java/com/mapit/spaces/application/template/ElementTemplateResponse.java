package com.mapit.spaces.application.template;

import java.time.Instant;
import java.util.UUID;

import com.mapit.spaces.domain.template.ElementTemplate;

/**
 * DTO de salida de una plantilla de elemento (HU-4.02 / MAP-204).
 *
 * <p>Solo expone los campos necesarios para el cliente: id, nombre y tipo.
 * El tenantId no se expone (deriva del contexto); la auditoría se incluye
 * para consistencia con SpaceElementResponse.
 */
public record ElementTemplateResponse(
    UUID id,
    String name,
    String type,
    Instant createdAt,
    Instant updatedAt) {

  /** Mapeo dominio → respuesta en un único punto. */
  public static ElementTemplateResponse fromDomain(ElementTemplate template) {
    var audit = template.audit();
    return new ElementTemplateResponse(
        template.id().value(),
        template.name(),
        template.type().name(),
        audit.createdAt(),
        audit.updatedAt());
  }
}
