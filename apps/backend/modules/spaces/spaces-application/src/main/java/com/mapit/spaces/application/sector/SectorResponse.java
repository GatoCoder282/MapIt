package com.mapit.spaces.application.sector;

import java.time.Instant;
import java.util.UUID;

import com.mapit.spaces.domain.sector.Sector;

/**
 * Respuesta de salida para un sector (CU-05).
 *
 * <p>HU-4.01 añade la geometría: colocación en la planta ({@code x}/{@code y}/
 * {@code rotation}) y dimensiones intrínsecas ({@code width}/{@code height}, origen
 * de las coordenadas de sus elementos). Se escriben por lotes vía los endpoints de
 * layout; el CRUD clásico los deja intactos.
 */
public record SectorResponse(
    UUID id,
    String name,
    String slug,
    Integer maxCapacity,
    double x,
    double y,
    double rotation,
    double width,
    double height,
    Instant createdAt,
    Instant updatedAt) {

  public static SectorResponse fromDomain(Sector sector) {
    return new SectorResponse(
        sector.id().value(),
        sector.name(),
        sector.slug().value(),
        sector.maxCapacity(),
        sector.placement().x(),
        sector.placement().y(),
        sector.placement().rotation(),
        sector.geometry().width(),
        sector.geometry().height(),
        sector.audit().createdAt(),
        sector.audit().updatedAt());
  }
}
