package com.mapit.spaces.application;

import java.util.UUID;

/** Comando de entrada para actualizar un sector (CU-05). */
public record UpdateSectorCommand(
    UUID id,
    String name,
    String slug,
    Integer maxCapacity) {
}
