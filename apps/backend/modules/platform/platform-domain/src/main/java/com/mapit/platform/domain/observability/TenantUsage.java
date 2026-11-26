package com.mapit.platform.domain.observability;

import java.time.LocalDate;
import java.util.Map;

import org.jspecify.annotations.Nullable;

/** Agregados <em>sin proteger</em> de una empresa; no salen de la capa de aplicación. */
public record TenantUsage(
    Map<String, Long> establishmentsByVertical,
    Map<String, Long> reservationsByStatus,
    Map<LocalDate, Long> reservationsByDay,
    @Nullable LocalDate lastActivity,
    long pendingDeliveries,
    long failingDeliveries,
    boolean paymentMethodEnabled) {

  public long establishments() {
    return establishmentsByVertical.values().stream().mapToLong(Long::longValue).sum();
  }

  public long reservations() {
    return reservationsByStatus.values().stream().mapToLong(Long::longValue).sum();
  }
}
