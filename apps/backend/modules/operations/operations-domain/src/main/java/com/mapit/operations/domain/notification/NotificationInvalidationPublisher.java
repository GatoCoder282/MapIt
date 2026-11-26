package com.mapit.operations.domain.notification;

/**
 * Entrega de invalidaciones, nunca de hechos de negocio ni de contenido de la bandeja.
 * El futuro dispatcher debe invocarlo solo tras commit durable y autorización/gates vigentes.
 * Un retorno normal significa aceptación del transporte, no recepción/lectura por el usuario.
 */
public interface NotificationInvalidationPublisher {
    void publish(NotificationInvalidation invalidation);
}
