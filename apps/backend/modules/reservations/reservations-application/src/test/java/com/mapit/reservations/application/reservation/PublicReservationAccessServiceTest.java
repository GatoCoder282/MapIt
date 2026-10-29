package com.mapit.reservations.application.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.mapit.reservations.domain.booking.PublicEstablishment;
import com.mapit.reservations.domain.booking.PublicReservationRepository;
import com.mapit.reservations.domain.person.PersonId;
import com.mapit.reservations.domain.reservation.Reservation;
import com.mapit.reservations.domain.reservation.ReservationConcurrencyGuard;
import com.mapit.reservations.domain.reservation.ReservationId;
import com.mapit.reservations.domain.reservation.ReservationResource;
import com.mapit.reservations.domain.reservation.ReservationResourceRepository;
import com.mapit.reservations.domain.reservation.ReservationStatus;
import com.mapit.reservations.domain.reservation.ReservationTimeRange;
import com.mapit.shared.tenant.TenantId;

class PublicReservationAccessServiceTest {
  private static final TenantId TENANT = TenantId.of("tenant-a");
  private static final UUID VENUE = UUID.randomUUID();
  private static final UUID ID = UUID.randomUUID();
  private static final UUID ELEMENT = UUID.randomUUID();
  private static final UUID PAYMENT = UUID.randomUUID();
  private static final UUID ACTOR = UUID.randomUUID();
  private static final Instant NOW = Instant.parse("2026-10-25T12:00:00Z");
  private static final Instant START = NOW.plusSeconds(900);
  private static final Instant END = NOW.plusSeconds(7200);
  private ReservationAccessTestRepository repository;
  private Resources resources;
  private Set<UUID> lockedElements;
  private PublicReservationAccessService service;

  @BeforeEach void setup() {
    repository = new ReservationAccessTestRepository();
    repository.reservation = reservation(ReservationStatus.CREATED);
    resources = new Resources();
    lockedElements = Set.of();
    service = serviceAt(NOW);
  }

  @Test void emite256bits_y_persiste_solo_hash_caducidad_y_ambito() {
    var issued = service.issue(repository.reservation);
    assertThat(issued.token()).matches("[A-Za-z0-9_-]{43}");
    assertThat(repository.tokenHash).matches("[a-f0-9]{64}").isNotEqualTo(issued.token());
    assertThat(issued.expiresAt()).isEqualTo(END.plus(Duration.ofHours(24)));
    assertThat(issued.toString()).doesNotContain(issued.token());
    assertThat(service.authorize("tenant-a","venue",ID,issued.token()).id()).isEqualTo(ID);
    assertThat(service.resolveTenant("tenant-a","venue")).isEqualTo(TENANT);
    assertThatThrownBy(() -> service.authorize("tenant-a","other",ID,issued.token()))
        .isInstanceOf(PublicReservationAccessService.NotFound.class);
    assertThatThrownBy(() -> service.authorize("other","venue",ID,issued.token()))
        .isInstanceOf(PublicReservationAccessService.NotFound.class);
    assertThatThrownBy(() -> service.authorize("tenant-a","venue",UUID.randomUUID(),issued.token()))
        .isInstanceOf(PublicReservationAccessService.AccessDenied.class);
  }

  @Test void rechaza_token_manipulado_revocado_y_vencido() {
    var issued = service.issue(repository.reservation);
    assertThatThrownBy(() -> service.authorize("tenant-a","venue",ID,"invalid"))
        .isInstanceOf(PublicReservationAccessService.AccessDenied.class);
    String manipulated = (issued.token().startsWith("A") ? "B" : "A") + issued.token().substring(1);
    assertThatThrownBy(() -> service.authorize("tenant-a","venue",ID,manipulated))
        .isInstanceOf(PublicReservationAccessService.AccessDenied.class);
    repository.revoked = true;
    assertThatThrownBy(() -> service.authorize("tenant-a","venue",ID,issued.token()))
        .isInstanceOf(PublicReservationAccessService.AccessDenied.class);
    repository.revoked = false;
    repository.expiresAt = NOW;
    assertThatThrownBy(() -> service.authorize("tenant-a","venue",ID,issued.token()))
        .isInstanceOf(PublicReservationAccessService.AccessDenied.class);
  }

  @Test void confirma_una_vez_con_bloqueos_y_rechaza_un_segundo_pago() {
    assertThat(service.confirm(TENANT,ID,PAYMENT)).isTrue();
    assertThat(lockedElements).containsExactly(ELEMENT);
    assertThat(repository.transitions).isEqualTo(1);
    assertThat(service.read(TENANT,ID).status()).isEqualTo(ReservationStatus.CONFIRMED);
    assertThat(service.confirm(TENANT,ID,PAYMENT)).isTrue();
    assertThat(service.confirm(TENANT,ID,UUID.randomUUID())).isFalse();
    assertThat(repository.transitions).isEqualTo(1);
    assertThat(repository.reservation.spaceElementIds()).containsExactly(ELEMENT);
  }

  @Test void no_confirma_cancelada_liberada_vencida_o_con_otro_solapamiento() {
    for (ReservationStatus status : List.of(ReservationStatus.CANCELLED,ReservationStatus.RELEASED)) {
      repository.reservation = reservation(status);
      assertThat(service.confirm(TENANT,ID,PAYMENT)).isFalse();
    }
    repository.reservation = reservation(ReservationStatus.CREATED);
    assertThat(serviceAt(END).confirm(TENANT,ID,PAYMENT)).isFalse();
    repository.conflicts = true;
    assertThat(service.confirm(TENANT,ID,PAYMENT)).isFalse();
    repository.conflicts = false;
    resources.state = ReservationResource.OperationalState.OCCUPIED;
    assertThat(service.confirm(TENANT,ID,PAYMENT)).isFalse();
    assertThat(repository.transitions).isZero();
  }

  @Test void tenant_suspendido_o_local_borrado_no_confirman_y_permiten_conciliar() {
    repository.visible = false;
    assertThat(service.confirm(TENANT,ID,PAYMENT)).isFalse();
    assertThat(repository.transitions).isZero();
  }

  @Test void llegada_explicita_acepta_ventana_registra_actor_y_es_idempotente() {
    service.confirm(TENANT,ID,PAYMENT);
    var arrival = service.checkIn(TENANT,ID,VENUE,ACTOR);
    assertThat(arrival.status()).isEqualTo(ReservationStatus.ACTIVE);
    assertThat(arrival.checkedInBy()).isEqualTo(ACTOR);
    assertThat(arrival.checkedInAt()).isEqualTo(NOW);
    service.checkIn(TENANT,ID,VENUE,UUID.randomUUID());
    assertThat(repository.transitions).isEqualTo(2);
    assertThat(service.read(TENANT,ID).checkedInBy()).isEqualTo(ACTOR);
  }

  @Test void llegada_rechaza_otro_tenant_venue_ventana_o_recurso_no_disponible() {
    service.confirm(TENANT,ID,PAYMENT);
    assertThatThrownBy(() -> service.checkIn(TenantId.of("tenant-b"),ID,VENUE,ACTOR))
        .isInstanceOf(PublicReservationAccessService.NotFound.class);
    assertThatThrownBy(() -> service.checkIn(TENANT,ID,UUID.randomUUID(),ACTOR))
        .isInstanceOf(PublicReservationAccessService.NotFound.class);
    assertThatThrownBy(() -> serviceAt(START.minusSeconds(1801)).checkIn(TENANT,ID,VENUE,ACTOR))
        .isInstanceOf(PublicReservationAccessService.Conflict.class);
    assertThatThrownBy(() -> serviceAt(END).checkIn(TENANT,ID,VENUE,ACTOR))
        .isInstanceOf(PublicReservationAccessService.Conflict.class);
    resources.state = ReservationResource.OperationalState.CLEANING;
    assertThatThrownBy(() -> service.checkIn(TENANT,ID,VENUE,ACTOR))
        .isInstanceOf(PublicReservationAccessService.Conflict.class);
    assertThat(repository.transitions).isEqualTo(1);
  }

  @Test void bloqueo_fisico_no_depende_de_visibilidad_publica_pero_conserva_tenant() {
    repository.visible = false;
    service.lockRow(TENANT,ID);
    assertThat(repository.locks).isEqualTo(1);
    assertThatThrownBy(() -> service.lock(TENANT,ID)).isInstanceOf(PublicReservationAccessService.NotFound.class);
    assertThatThrownBy(() -> service.lockRow(TenantId.of("tenant-b"),ID)).isInstanceOf(PublicReservationAccessService.NotFound.class);
  }

  @Test void consulta_bloqueada_y_catalogo_no_aceptan_ambito_invalido() {
    assertThat(service.lock(TENANT,ID).id()).isEqualTo(ID);
    assertThat(repository.locks).isEqualTo(1);
    assertThatThrownBy(() -> service.lock(TenantId.of("tenant-b"),ID))
        .isInstanceOf(PublicReservationAccessService.NotFound.class);
    assertThatThrownBy(() -> service.catalogue("x".repeat(121))).isInstanceOf(IllegalArgumentException.class);
  }

  private PublicReservationAccessService serviceAt(Instant now) {
    PublicReservationRepository establishments = (tenant,venue) -> tenant.equals("tenant-a") && venue.equals("venue")
        ? Optional.of(new PublicEstablishment(TENANT,VENUE,"UTC")) : Optional.empty();
    ReservationConcurrencyGuard guard = (tenant,elements) -> lockedElements=Set.copyOf(elements);
    return new PublicReservationAccessService(repository,establishments,guard,resources,Clock.fixed(now,ZoneOffset.UTC));
  }

  private static Reservation reservation(ReservationStatus status) {
    return new Reservation(ReservationId.of(ID),TENANT,VENUE,PersonId.of(UUID.randomUUID()),Set.of(ELEMENT),
        ReservationTimeRange.of(START,END),status,NOW.minusSeconds(60),null);
  }

  private static final class Resources implements ReservationResourceRepository {
    ReservationResource.OperationalState state = ReservationResource.OperationalState.AVAILABLE;
    @Override public boolean establishmentExists(TenantId tenant,UUID venue) { return TENANT.equals(tenant) && VENUE.equals(venue); }
    @Override public List<ReservationResource> findAliveByIds(TenantId tenant,Collection<UUID> elements) {
      return List.of(new ReservationResource(ELEMENT,VENUE,ReservationResource.Kind.TABLE,state));
    }
  }
}
