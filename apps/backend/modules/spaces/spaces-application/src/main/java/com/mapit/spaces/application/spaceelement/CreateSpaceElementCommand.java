package com.mapit.spaces.application.spaceelement;

import java.util.UUID;

/** Comando de entrada para dar de alta un elemento espacial (HU-2.03 / MAP-114).
 *
 * <p>El {@code tenantId} se resuelve del contexto de la petición, nunca viaja en el body
 * (RN-1). El {@code sectorId} viene del path y se re-verifica contra el tenant en el caso
 * de uso: un cliente no puede registrar un elemento en un sector de otra empresa.
 */
public record CreateSpaceElementCommand(
    UUID sectorId,
    String type,
    Double x,
    Double y,
    String initialState) {}
