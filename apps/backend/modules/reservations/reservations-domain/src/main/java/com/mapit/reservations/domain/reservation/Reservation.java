package com.mapit.reservations.domain.reservation;

import java.time.Instant;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/**
 * Reserva interna asociada a una persona y a uno o más elementos espaciales.
 *
 * <p>El agregado es inmutable. La creación fuerza el estado {@link ReservationStatus#CREATED}
 * y conserva una copia inmutable de los elementos para impedir cambios fuera del dominio.
 * Los UUID de establecimiento y elementos son referencias a otro contexto: este módulo no
 * importa {@code spaces}; la aplicación los valida mediante puertos propios.
 */
public record Reservation(
    ReservationId id,
    TenantId tenantId,
    UUID establishmentId,
    PersonId personId,
    Set<UUID> spaceElementIds,
    ReservationTimeRange timeRange,
    ReservationStatus status,
    Instant createdAt,
    UUID createdBy) {

  public Reservation {
    Objects.requireNonNull(id, "id no puede ser null");
    Objects.requireNonNull(tenantId, "tenantId no puede ser null");
    Objects.requireNonNull(establishmentId, "establishmentId no puede ser null");
    Objects.requireNonNull(personId, "personId no puede ser null");
    Objects.requireNonNull(spaceElementIds, "spaceElementIds no puede ser null");
    Objects.requireNonNull(timeRange, "timeRange no puede ser null");
    Objects.requireNonNull(status, "status no puede ser null");
    Objects.requireNonNull(createdAt, "createdAt no puede ser null");
    Objects.requireNonNull(createdBy, "createdBy no puede ser null");

    if (spaceElementIds.isEmpty()) {
      throw new IllegalArgumentException("La reserva debe incluir al menos un elemento");
    }
    if (spaceElementIds.stream().anyMatch(Objects::isNull)) {
      throw new IllegalArgumentException("Los elementos de la reserva no pueden ser null");
    }
    spaceElementIds = Set.copyOf(spaceElementIds);
  }

  /** Crea una reserva interna nueva con estado inicial fijo y elementos únicos. */
  public static Reservation create(
      ReservationId id,
      TenantId tenantId,
      UUID establishmentId,
      PersonId personId,
      Collection<UUID> spaceElementIds,
      ReservationTimeRange timeRange,
      Instant createdAt,
      UUID createdBy) {
    Objects.requireNonNull(spaceElementIds, "spaceElementIds no puede ser null");

    Set<UUID> uniqueElements = new LinkedHashSet<>();
    for (UUID elementId : spaceElementIds) {
      if (elementId == null) {
        throw new IllegalArgumentException("Los elementos de la reserva no pueden ser null");
      }
      if (!uniqueElements.add(elementId)) {
        throw new IllegalArgumentException("La reserva no puede repetir un elemento");
      }
    }

    return new Reservation(
        id,
        tenantId,
        establishmentId,
        personId,
        uniqueElements,
        timeRange,
        ReservationStatus.CREATED,
        createdAt,
        createdBy);
  }

  public boolean includesElement(UUID elementId) {
    Objects.requireNonNull(elementId, "elementId no puede ser null");
    return spaceElementIds.contains(elementId);
  }
}
