package com.mapit.operations.domain.notification;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * Persistencia de bandeja propia. No hay consultas globales ni actualización genérica.
 *
 * <p>El adaptador debe filtrar tenant, destinatario y concesiones por tipo/establecimiento en la
 * consulta y escritura, además de RLS. La aplicación construye el ámbito desde el principal y
 * permisos vigentes en cada operación; este puerto no autentica ni verifica FK por sí mismo.
 */
public interface NotificationRepository {

    /**
     * Inserta atómicamente por NotificationKey o devuelve la fila original de la reentrega.
     * El evento completo debe coincidir: datos incompatibles con la misma clave o un ID de fila
     * ya usado para otro evento se rechazan sin sobrescritura. Un reintento no cambia ID, fechas
     * ni lectura de la fila original. Solo productores internos autorizados invocan este método.
     */
    Notification createIfAbsent(Notification notification);

    /** Filtra antes de ordenar/paginar, con el mismo ámbito efectivo que el contador/marcado. */
    NotificationPage list(NotificationPageRequest request);

    /** Cuenta solo no leídas del ámbito autorizado; sin contexto/concesiones devuelve cero. */
    long countUnread(NotificationScope scope);

    /**
     * Marca una fila propia autorizada, conservando el primer readAt, sin sustituir el evento.
     * Resultado vacío tanto para ID inexistente como ajeno o no autorizado; sin revelar datos.
     * La actualización debe ser atómica ante dos sesiones y aplicar el ámbito en el WHERE.
     */
    Optional<Notification> markRead(NotificationScope scope, UUID notificationId, Instant readAt);
}
