package com.mapit.spaces.application.spaceelement;

import java.util.UUID;

/** Comando de entrada para actualizar los campos editables de un elemento espacial (HU-2.03).
 *
 * <p>PUT semántica de reemplazo: vienen todos los editables. El estado no viaja: su
 * transición auditada es HU-3.01.
 */
public record UpdateSpaceElementCommand(
    UUID sectorId,
    UUID elementId,
    String type,
    Double x,
    Double y) {}
