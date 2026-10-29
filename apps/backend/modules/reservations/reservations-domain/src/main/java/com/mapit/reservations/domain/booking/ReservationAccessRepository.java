package com.mapit.reservations.domain.booking;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

import com.mapit.reservations.domain.reservation.Reservation;
import com.mapit.reservations.domain.reservation.ReservationStatus;
import com.mapit.shared.tenant.TenantId;

/** Acceso restringido y transiciones persistentes dentro del contexto reservations. */
public interface ReservationAccessRepository {
  void insertAccess(Reservation reservation, String tokenHash, Instant createdAt, Instant expiresAt);
  boolean accepts(TenantId tenantId, UUID establishmentId, UUID reservationId, String tokenHash, Instant now);
  Optional<ReservationAccessView> read(TenantId tenantId, UUID reservationId);
  Optional<Reservation> lock(TenantId tenantId, UUID reservationId);
  boolean hasOtherConflicts(Reservation reservation);
  void transition(TenantId tenantId, UUID reservationId, ReservationStatus previous,
      ReservationStatus next, @Nullable UUID paymentId, @Nullable UUID actorId, Instant now);
  List<PublicVenue> catalogue(@Nullable String query);
  List<PublicVenue> catalogue(@Nullable String query, @Nullable String tenantSlug, int limit, int offset);
  Optional<PublicVenue> publicVenue(TenantId tenant, UUID establishmentId);

  record PublicVenue(UUID id, String name, String type, @Nullable String address,
      String tenantSlug, String establishmentSlug, String timezone, String tenantName) {}
}
