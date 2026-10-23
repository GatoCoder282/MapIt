package com.mapit.reservations.domain.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;

import org.junit.jupiter.api.Test;

class ReservationTimeRangeTest {

  private static final Instant TEN = Instant.parse("2026-10-03T10:00:00Z");
  private static final Instant ELEVEN = Instant.parse("2026-10-03T11:00:00Z");
  private static final Instant NOON = Instant.parse("2026-10-03T12:00:00Z");

  @Test
  void rechaza_un_intervalo_sin_duracion() {
    assertThatThrownBy(() -> ReservationTimeRange.of(TEN, TEN))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("anterior");
  }

  @Test
  void rechaza_un_intervalo_invertido() {
    assertThatThrownBy(() -> ReservationTimeRange.of(ELEVEN, TEN))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("anterior");
  }

  @Test
  void detecta_solapamiento_parcial_y_contenido() {
    ReservationTimeRange base = ReservationTimeRange.of(TEN, NOON);

    assertThat(base.overlaps(ReservationTimeRange.of(ELEVEN, NOON.plusSeconds(3600)))).isTrue();
    assertThat(base.overlaps(ReservationTimeRange.of(TEN.plusSeconds(900), ELEVEN))).isTrue();
  }

  @Test
  void detecta_solapamiento_de_forma_simetrica() {
    ReservationTimeRange first = ReservationTimeRange.of(TEN, NOON);
    ReservationTimeRange second = ReservationTimeRange.of(ELEVEN, NOON.plusSeconds(3600));

    assertThat(first.overlaps(second)).isTrue();
    assertThat(second.overlaps(first)).isTrue();
  }

  @Test
  void permite_intervalos_consecutivos() {
    ReservationTimeRange first = ReservationTimeRange.of(TEN, ELEVEN);
    ReservationTimeRange second = ReservationTimeRange.of(ELEVEN, NOON);

    assertThat(first.overlaps(second)).isFalse();
    assertThat(second.overlaps(first)).isFalse();
  }
}
