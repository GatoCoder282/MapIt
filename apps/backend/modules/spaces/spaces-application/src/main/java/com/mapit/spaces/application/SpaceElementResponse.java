package com.mapit.spaces.application;

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
    Instant updatedAt) {}
