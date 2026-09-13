package com.mapit.spaces.application;

import java.util.UUID;
import java.time.Instant;

/** Respuesta de salida para un sector (CU-05). */
public record SectorResponse(
    UUID id,
    String name,
    String slug,
    Integer maxCapacity,
    Instant createdAt,
    Instant updatedAt) {
}