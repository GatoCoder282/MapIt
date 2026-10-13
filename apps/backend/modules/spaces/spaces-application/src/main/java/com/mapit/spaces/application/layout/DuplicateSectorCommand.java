package com.mapit.spaces.application.layout;

import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * Comando de duplicado de sector (HU-4.01, RN-5): el sector fuente se copia a la
 * planta del path con identidad nueva. {@code name}/{@code slug} opcionales:
 * si faltan se derivan del origen garantizando unicidad en la planta destino.
 */
public record DuplicateSectorCommand(
    UUID sourceSectorId, @Nullable String name, @Nullable String slug) {}
