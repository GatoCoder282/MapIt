package com.mapit.spaces.application;

import java.util.UUID;

/** Comando de entrada para crear un sector (CU-05).
 *
 * <p>El {@code tenantId} se resuelve del contexto de la petición, nunca viaja en el body.
 * El {@code floorId} es el identificador del piso padre.
 */
public record CreateSectorCommand(
    UUID floorId,
    String name,
    String slug,
    Integer maxCapacity) {
}
