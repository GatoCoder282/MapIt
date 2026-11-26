package com.mapit.operations.domain.notification;

import java.util.List;

/**
 * Candidatos internos del evento confirmado, sin PII ni roles aportados por el cliente.
 * El consumidor futuro debe aportar el hecho desde su fuente durable. El adaptador recupera
 * la elegibilidad original para reintentos, sin ampliar históricos a nuevos usuarios; los permisos
 * actuales se revalidan aparte. La lista es de candidatos, nunca una autorización de entrega.
 */
public interface NotificationRecipientCandidatesPort {
    List<NotificationRecipient> findCandidates(NotificationEvent event);
}
