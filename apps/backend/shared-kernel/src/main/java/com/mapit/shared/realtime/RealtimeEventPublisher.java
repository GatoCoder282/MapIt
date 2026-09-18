package com.mapit.shared.realtime;

/**
 * Puerto de publicación de eventos operativos.
 *
 * <p>La implementación escribe el outbox en la misma transacción del caso de uso. El dominio y
 * los casos de uso no conocen STOMP, brokers ni serialización.
 */
public interface RealtimeEventPublisher {

  /**
   * Registra un evento para entrega posterior.
   *
   * <p>El adaptador falla si no existe una transacción activa: publicar fuera del límite de
   * unidad de trabajo rompería la garantía de que cambio de estado y evento son atómicos.
   */
  void publish(RealtimeEvent event);
}
