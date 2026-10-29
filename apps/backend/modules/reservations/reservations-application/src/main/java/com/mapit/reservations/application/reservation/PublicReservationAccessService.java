package com.mapit.reservations.application.reservation;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.reservations.domain.booking.PublicEstablishment;
import com.mapit.reservations.domain.booking.PublicReservationRepository;
import com.mapit.reservations.domain.booking.ReservationAccessRepository;
import com.mapit.reservations.domain.booking.ReservationAccessView;
import com.mapit.reservations.domain.reservation.Reservation;
import com.mapit.reservations.domain.reservation.ReservationConcurrencyGuard;
import com.mapit.reservations.domain.reservation.ReservationResource;
import com.mapit.reservations.domain.reservation.ReservationResourceRepository;
import com.mapit.reservations.domain.reservation.ReservationStatus;
import com.mapit.reservations.domain.reservation.ReservationTransitions;
import com.mapit.shared.tenant.TenantId;

/** Credenciales públicas y transiciones autoritativas; nunca confía en un tenant del navegador. */
@Service
public class PublicReservationAccessService {
  private static final SecureRandom RANDOM = new SecureRandom();
  private final ReservationAccessRepository repository;
  private final PublicReservationRepository establishments;
  private final ReservationConcurrencyGuard guard;
  private final ReservationResourceRepository resources;
  private final Clock clock;

  public PublicReservationAccessService(ReservationAccessRepository repository,
      PublicReservationRepository establishments, ReservationConcurrencyGuard guard,
      ReservationResourceRepository resources, Clock clock) {
    this.repository = repository;
    this.establishments = establishments;
    this.guard = guard;
    this.resources = resources;
    this.clock = clock;
  }

  @Transactional
  public IssuedAccess issue(Reservation reservation) {
    byte[] bytes = new byte[32];
    RANDOM.nextBytes(bytes);
    String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    Instant expiresAt = reservation.timeRange().endsAt().plus(Duration.ofHours(24));
    repository.insertAccess(reservation, hash(token), clock.instant(), expiresAt);
    return new IssuedAccess(token, expiresAt);
  }

  @Transactional(readOnly = true)
  public TenantId resolveTenant(String tenantSlug, String establishmentSlug) {
    return establishment(tenantSlug, establishmentSlug).tenantId();
  }

  @Transactional(readOnly = true)
  public ReservationAccessView authorize(String tenantSlug, String establishmentSlug,
      UUID reservationId, String token) {
    PublicEstablishment establishment = establishment(tenantSlug, establishmentSlug);
    if (!repository.accepts(establishment.tenantId(), establishment.id(), reservationId,
        hash(token), clock.instant())) throw new AccessDenied();
    ReservationAccessView view = read(establishment.tenantId(), reservationId);
    if (!view.establishmentId().equals(establishment.id())) throw new AccessDenied();
    return view;
  }

  @Transactional(readOnly = true)
  public ReservationAccessView read(TenantId tenantId, UUID reservationId) {
    return repository.read(tenantId, reservationId).orElseThrow(NotFound::new);
  }

  /** Bloqueo físico para conciliar ingresos incluso si el comercio dejó de ser público. */
  @Transactional
  public void lockRow(TenantId tenantId, UUID reservationId) {
    repository.lock(tenantId, reservationId).orElseThrow(NotFound::new);
  }

  /** Adquiere el bloqueo de reserva antes de que Payments bloquee un intento. */
  @Transactional
  public ReservationAccessView lock(TenantId tenantId, UUID reservationId) {
    repository.lock(tenantId, reservationId).orElseThrow(NotFound::new);
    return read(tenantId, reservationId);
  }

  @Transactional
  public boolean confirm(TenantId tenantId, UUID reservationId, UUID paymentId) {
    var locked = repository.lock(tenantId, reservationId);
    if (locked.isEmpty()) return false;
    Reservation reservation = locked.orElseThrow();
    var currentView = repository.read(tenantId, reservationId);
    if (currentView.isEmpty()) return false;
    ReservationAccessView view = currentView.orElseThrow();
    if (reservation.status() == ReservationStatus.CONFIRMED || reservation.status() == ReservationStatus.ACTIVE) {
      return paymentId.equals(view.confirmedPaymentId());
    }
    if (reservation.status() != ReservationStatus.CREATED
        || !clock.instant().isBefore(reservation.timeRange().endsAt())) return false;
    guard.lockResources(tenantId, reservation.spaceElementIds());
    if (!validResources(reservation, false) || repository.hasOtherConflicts(reservation)) return false;
    transition(reservation, ReservationStatus.CONFIRMED, paymentId, null);
    return true;
  }

  /** Bootstrap engloba esta transición y la ocupación Operations en la misma transacción. */
  @Transactional
  public ReservationAccessView checkIn(TenantId tenantId, UUID reservationId,
      UUID establishmentId, UUID actorId) {
    Reservation reservation = repository.lock(tenantId, reservationId).orElseThrow(NotFound::new);
    if (!reservation.establishmentId().equals(establishmentId)) throw new NotFound();
    ReservationAccessView view = read(tenantId, reservationId);
    if (reservation.status() == ReservationStatus.ACTIVE && view.checkedInAt() != null) return view;
    Instant now = clock.instant();
    if (reservation.status() != ReservationStatus.CONFIRMED || view.confirmedPaymentId() == null
        || now.isBefore(reservation.timeRange().startsAt().minus(Duration.ofMinutes(30)))
        || !now.isBefore(reservation.timeRange().endsAt())) throw new Conflict();
    guard.lockResources(tenantId, reservation.spaceElementIds());
    if (!validResources(reservation, true) || repository.hasOtherConflicts(reservation)) throw new Conflict();
    transition(reservation, ReservationStatus.ACTIVE, view.confirmedPaymentId(), actorId);
    return read(tenantId, reservationId);
  }

  @Transactional(readOnly = true)
  public List<ReservationAccessRepository.PublicVenue> catalogue(@Nullable String query) {
    return catalogue(query,null,20,0);
  }
  @Transactional(readOnly = true)
  public List<ReservationAccessRepository.PublicVenue> catalogue(@Nullable String query,@Nullable String tenantSlug,int limit,int offset) {
    if (query != null && query.length() > 120) throw new IllegalArgumentException("Búsqueda demasiado larga");
    if(limit<1||limit>50||offset<0||offset>10000)throw new IllegalArgumentException("Paginación inválida");
    if(tenantSlug!=null&&!tenantSlug.matches("[a-z0-9]+(?:-[a-z0-9]+)*"))throw new IllegalArgumentException("Empresa inválida");
    return repository.catalogue(query == null || query.isBlank() ? null : query.strip(),tenantSlug,limit,offset);
  }
  @Transactional(readOnly = true)
  public ReservationAccessRepository.PublicVenue publicEstablishment(String tenantSlug,String establishmentSlug){
    var venue=establishment(tenantSlug,establishmentSlug);
    return repository.publicVenue(venue.tenantId(),venue.id()).orElseThrow(NotFound::new);
  }

  private boolean validResources(Reservation reservation, boolean arrival) {
    if (!resources.establishmentExists(reservation.tenantId(), reservation.establishmentId())) return false;
    List<ReservationResource> found = resources.findAliveByIds(reservation.tenantId(), reservation.spaceElementIds());
    if (found.size() != reservation.spaceElementIds().size()) return false;
    return found.stream().allMatch(resource -> resource.establishmentId().equals(reservation.establishmentId())
        && resource.isReservable() && resource.isActive()
        && (resource.operationalState() == ReservationResource.OperationalState.AVAILABLE
            || (arrival && resource.operationalState() == ReservationResource.OperationalState.RESERVED)));
  }

  private void transition(Reservation reservation, ReservationStatus next, @Nullable UUID paymentId, @Nullable UUID actorId) {
    ReservationTransitions.requireAllowed(reservation.status(), next);
    repository.transition(reservation.tenantId(), reservation.id().value(), reservation.status(), next,
        paymentId, actorId, clock.instant());
  }

  private PublicEstablishment establishment(String tenantSlug, String establishmentSlug) {
    return establishments.findActiveEstablishment(tenantSlug, establishmentSlug).orElseThrow(NotFound::new);
  }

  private static String hash(String token) {
    if (token == null || !token.matches("[A-Za-z0-9_-]{43}")) throw new AccessDenied();
    byte[] bytes = Base64.getUrlDecoder().decode(token);
    if (bytes.length != 32 || !Base64.getUrlEncoder().withoutPadding().encodeToString(bytes).equals(token)) throw new AccessDenied();
    try {
      return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.US_ASCII)));
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 no disponible", exception);
    }
  }

  public record IssuedAccess(String token, Instant expiresAt) {
    @Override public String toString() { return "IssuedAccess[REDACTED]"; }
  }
  public static class AccessDenied extends RuntimeException {
    public AccessDenied() { super("Acceso a reserva inválido o vencido"); }
  }
  public static class NotFound extends RuntimeException {
    public NotFound() { super("Reserva o establecimiento no disponible"); }
  }
  public static class Conflict extends RuntimeException {
    public Conflict() { super("La reserva no admite registrar llegada"); }
  }
}
