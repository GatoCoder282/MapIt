package com.mapit.reservations.application.reservation;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

import com.mapit.reservations.domain.booking.ReservationAccessRepository;
import com.mapit.reservations.domain.booking.ReservationAccessView;
import com.mapit.reservations.domain.reservation.Reservation;
import com.mapit.reservations.domain.reservation.ReservationStatus;
import com.mapit.shared.tenant.TenantId;

/** Doble de puerto: no sustituye las pruebas PostgreSQL de RLS y bloqueos. */
final class ReservationAccessTestRepository implements ReservationAccessRepository {
  @Nullable Reservation reservation;
  @Nullable String tokenHash;
  @Nullable Instant expiresAt;
  @Nullable UUID paymentId;
  @Nullable UUID actorId;
  @Nullable Instant checkedInAt;
  boolean visible = true;
  boolean revoked;
  boolean conflicts;
  int transitions;
  int locks;

  @Override public void insertAccess(Reservation value, String hash, Instant created, Instant expires) {
    reservation = value;
    tokenHash = hash;
    expiresAt = expires;
  }
  @Override public boolean accepts(TenantId tenant, UUID establishment, UUID id, String hash, Instant now) {
    Reservation current = reservation;
    Instant expires = expiresAt;
    return current != null && current.tenantId().equals(tenant) && current.establishmentId().equals(establishment)
        && current.id().value().equals(id) && hash.equals(tokenHash) && !revoked && expires != null && now.isBefore(expires);
  }
  @Override public Optional<ReservationAccessView> read(TenantId tenant, UUID id) {
    if (!visible) return Optional.empty();
    return lockFree(tenant,id).map(r -> new ReservationAccessView(tenant,id,r.establishmentId(),"Venue",
        "tenant-a","venue",r.timeRange().startsAt(),r.timeRange().endsAt(),"UTC",r.status(),List.of(),
        paymentId,checkedInAt,actorId));
  }
  private Optional<Reservation> lockFree(TenantId tenant, UUID id) {
    return Optional.ofNullable(reservation).filter(r -> r.tenantId().equals(tenant) && r.id().value().equals(id));
  }
  @Override public Optional<Reservation> lock(TenantId tenant, UUID id) { locks++; return lockFree(tenant,id); }
  @Override public boolean hasOtherConflicts(Reservation r) { return conflicts; }
  @Override public void transition(TenantId tenant, UUID id, ReservationStatus previous, ReservationStatus next,
      @Nullable UUID payment, @Nullable UUID actor, Instant now) {
    Reservation r = lockFree(tenant,id).orElseThrow();
    if (r.status() != previous) throw new IllegalStateException("stale");
    reservation = new Reservation(r.id(),r.tenantId(),r.establishmentId(),r.personId(),r.spaceElementIds(),
        r.timeRange(),next,r.createdAt(),r.createdBy());
    paymentId = payment;
    if (next == ReservationStatus.ACTIVE) { actorId=actor; checkedInAt=now; }
    transitions++;
  }
  @Override public List<PublicVenue> catalogue(@Nullable String query) { return List.of(); }
  @Override public List<PublicVenue> catalogue(@Nullable String query, @Nullable String tenantSlug, int limit, int offset) { return List.of(); }
  @Override public Optional<PublicVenue> publicVenue(TenantId tenant, UUID establishmentId) { return Optional.empty(); }
}
