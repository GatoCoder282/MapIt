package com.mapit.reservations.domain.booking;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

import com.mapit.reservations.domain.reservation.ReservationStatus;
import com.mapit.shared.tenant.TenantId;

/** Proyección actual de reserva para checkout y operaciones, sin información personal. */
public record ReservationAccessView(
    TenantId tenantId, UUID id, UUID establishmentId, String establishmentName,
    String tenantSlug, String establishmentSlug, Instant startsAt, Instant endsAt,
    String timezone, ReservationStatus status, List<Space> spaces,
    @Nullable UUID confirmedPaymentId, @Nullable Instant checkedInAt, @Nullable UUID checkedInBy) {
  public ReservationAccessView {
    spaces = List.copyOf(spaces);
  }

  public record Space(UUID id, String name, String floor, String sector, UUID sectorId, String state, String type,
      @org.jspecify.annotations.Nullable String label, @org.jspecify.annotations.Nullable Integer capacity, double x, double y) {
    public Space(UUID id, String name, String floor, String sector, UUID sectorId, String state) { this(id,name,floor,sector,sectorId,state,"TABLE",null,null,0,0); }
  }
}
