package com.mapit.spaces.application.sector;

import java.time.Instant;
import java.util.UUID;

/** Respuesta de salida para un sector (CU-05). */
public record SectorResponse(
    UUID id,
    String name,
    String slug,
    Integer maxCapacity,
    Instant createdAt,
    Instant updatedAt) {
}
