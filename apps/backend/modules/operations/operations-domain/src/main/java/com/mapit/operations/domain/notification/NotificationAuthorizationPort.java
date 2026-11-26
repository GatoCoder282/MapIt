package com.mapit.operations.domain.notification;

import java.util.Optional;

/**
 * Resuelve concesiones vigentes por tipo/establecimiento para la identidad obtenida del servidor.
 * Un resultado vacío deniega acceso. El adaptador debe verificar cuenta/tenant activos y permisos
 * actuales, reutilizando identidad vigente, sin confiar en roles o ámbitos recibidos del cliente.
 */
public interface NotificationAuthorizationPort {
    Optional<NotificationScope> resolve(NotificationRecipient authenticated);
}
