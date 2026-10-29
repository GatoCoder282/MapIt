package com.mapit.payments.domain;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/** Bootstrap traduce las vistas del contexto Reservations, sin dependencias entre módulos. */
public interface PaymentReservationAccessPort {
  ReservationView authorize(String tenantSlug, String establishmentSlug, UUID reservationId, String accessToken);
  ReservationView read(TenantId tenantId, UUID reservationId);
  TenantId resolveTenant(String tenantSlug, String establishmentSlug);
  void lock(TenantId tenantId, UUID reservationId);

  record Space(UUID id, String name, String floor, String sector, String state, String type,
      @org.jspecify.annotations.Nullable String label, @org.jspecify.annotations.Nullable Integer capacity, double x, double y) {
    public Space(UUID id, String name, String floor, String sector, String state) { this(id,name,floor,sector,state,"TABLE",null,null,0,0); }
  }

  record ReservationView(TenantId tenantId, UUID id, UUID establishmentId, String establishmentName,
      String tenantSlug, String establishmentSlug, Instant startsAt, Instant endsAt, String timezone,
      String status, List<Space> spaces) {
    public ReservationView { spaces = List.copyOf(spaces); }
  }
}
