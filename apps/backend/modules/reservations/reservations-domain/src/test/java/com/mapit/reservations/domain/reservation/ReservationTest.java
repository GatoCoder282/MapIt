package com.mapit.reservations.domain.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.mapit.reservations.domain.person.PersonId;
import com.mapit.shared.tenant.TenantId;

class ReservationTest {

  private static final TenantId TENANT = TenantId.of("tenant-a");
  private static final UUID ESTABLISHMENT = UUID.fromString("10000000-0000-0000-0000-000000000001");
  private static final UUID PERSON = UUID.fromString("20000000-0000-0000-0000-000000000001");
  private static final UUID ELEMENT_A = UUID.fromString("30000000-0000-0000-0000-000000000001");
  private static final UUID ELEMENT_B = UUID.fromString("30000000-0000-0000-0000-000000000002");
  private static final UUID ACTOR = UUID.fromString("40000000-0000-0000-0000-000000000001");
  private static final Instant START = Instant.parse("2026-10-03T18:00:00Z");
  private static final Instant END = Instant.parse("2026-10-03T20:00:00Z");

  private static Reservation create(List<UUID> elements) {
    return Reservation.create(
        ReservationId.generate(),
        TENANT,
        ESTABLISHMENT,
        PersonId.of(PERSON),
        elements,
        ReservationTimeRange.of(START, END),
        START.minusSeconds(3600),
        ACTOR);
  }

  @Test
  void crea_una_reserva_interna_en_estado_created() {
    Reservation reservation = create(List.of(ELEMENT_A, ELEMENT_B));

    assertThat(reservation.tenantId()).isEqualTo(TENANT);
    assertThat(reservation.establishmentId()).isEqualTo(ESTABLISHMENT);
    assertThat(reservation.personId()).isEqualTo(PersonId.of(PERSON));
    assertThat(reservation.spaceElementIds()).containsExactlyInAnyOrder(ELEMENT_A, ELEMENT_B);
    assertThat(reservation.status()).isEqualTo(ReservationStatus.CREATED);
    assertThat(reservation.createdBy()).isEqualTo(ACTOR);
  }

  @Test
  void exige_al_menos_un_elemento() {
    assertThatThrownBy(() -> create(List.of()))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("al menos un elemento");
  }

  @Test
  void rechaza_elementos_repetidos() {
    assertThatThrownBy(() -> create(List.of(ELEMENT_A, ELEMENT_A)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("repetir");
  }

  @Test
  void rechaza_un_elemento_nulo() {
    assertThatThrownBy(() -> create(java.util.Arrays.asList(ELEMENT_A, null)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("null");
  }

  @Test
  void conserva_una_copia_inmutable_de_los_elementos() {
    Reservation reservation = create(List.of(ELEMENT_A));

    assertThatThrownBy(() -> reservation.spaceElementIds().add(ELEMENT_B))
        .isInstanceOf(UnsupportedOperationException.class);
  }

  @Test
  void informa_si_un_elemento_forma_parte_de_la_reserva() {
    Reservation reservation = create(List.of(ELEMENT_A));

    assertThat(reservation.includesElement(ELEMENT_A)).isTrue();
    assertThat(reservation.includesElement(ELEMENT_B)).isFalse();
  }

  @Test
  void rechaza_rehidratar_una_reserva_sin_actor_de_creacion() {
    assertThatThrownBy(
            () ->
                new Reservation(
                    ReservationId.generate(),
                    TENANT,
                    ESTABLISHMENT,
                    PersonId.of(PERSON),
                    Set.of(ELEMENT_A),
                    ReservationTimeRange.of(START, END),
                    ReservationStatus.CREATED,
                    START,
                    null))
        .isInstanceOf(NullPointerException.class)
        .hasMessageContaining("createdBy");
  }
}
