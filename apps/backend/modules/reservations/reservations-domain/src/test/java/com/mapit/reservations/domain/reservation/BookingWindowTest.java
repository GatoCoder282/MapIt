package com.mapit.reservations.domain.reservation;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;

import org.junit.jupiter.api.Test;

import com.mapit.shared.vertical.Vertical;
import com.mapit.shared.vertical.VerticalCatalog;

/** Ventanas de reserva por vertical (HU-7.01/7.02, spec D4), en la zona de La Paz (UTC-4). */
class BookingWindowTest {

  private static final ZoneId LA_PAZ = ZoneId.of("America/La_Paz");

  private static BookingWindow window(Vertical vertical) {
    return BookingWindow.of(VerticalCatalog.of(vertical));
  }

  private static ReservationTimeRange local(String start, String end) {
    return ReservationTimeRange.of(at(start), at(end));
  }

  private static Instant at(String localDateTime) {
    return java.time.LocalDateTime.parse(localDateTime).atZone(LA_PAZ).toInstant();
  }

  @Test
  void restaurante_acepta_un_turno_del_mismo_dia_hasta_seis_horas() {
    assertThatCode(
            () -> window(Vertical.RESTAURANT).validate(local("2026-11-02T19:00", "2026-11-02T21:30"), LA_PAZ))
        .doesNotThrowAnyException();
    // Semiabierto: terminar a medianoche sigue siendo el mismo día.
    assertThatCode(
            () -> window(Vertical.RESTAURANT).validate(local("2026-11-02T20:00", "2026-11-03T00:00"), LA_PAZ))
        .doesNotThrowAnyException();
  }

  @Test
  void restaurante_rechaza_turnos_largos_o_que_cruzan_el_dia() {
    assertThatThrownBy(
            () -> window(Vertical.RESTAURANT).validate(local("2026-11-02T10:00", "2026-11-02T17:00"), LA_PAZ))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("6 h");
    assertThatThrownBy(
            () -> window(Vertical.RESTAURANT).validate(local("2026-11-02T22:00", "2026-11-03T01:00"), LA_PAZ))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("mismo día");
  }

  @Test
  void discoteca_acepta_una_noche_que_termina_de_madrugada_y_limita_a_doce_horas() {
    assertThatCode(
            () -> window(Vertical.NIGHTCLUB).validate(local("2026-11-06T23:00", "2026-11-07T04:00"), LA_PAZ))
        .doesNotThrowAnyException();
    assertThatThrownBy(
            () -> window(Vertical.NIGHTCLUB).validate(local("2026-11-06T18:00", "2026-11-07T07:00"), LA_PAZ))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("12 h");
  }

  @Test
  void salon_acepta_un_evento_de_un_dia_y_rechaza_mas_de_veinticuatro_horas() {
    assertThatCode(
            () -> window(Vertical.EVENT_HALL).validate(local("2026-11-07T18:00", "2026-11-08T02:00"), LA_PAZ))
        .doesNotThrowAnyException();
    assertThatThrownBy(
            () -> window(Vertical.EVENT_HALL).validate(local("2026-11-07T08:00", "2026-11-08T09:00"), LA_PAZ))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void hotel_cuenta_noches_entre_llegada_y_salida() {
    assertThatCode(
            () -> window(Vertical.HOTEL).validate(local("2026-11-02T15:00", "2026-11-04T12:00"), LA_PAZ))
        .doesNotThrowAnyException();
    assertThatThrownBy(
            () -> window(Vertical.HOTEL).validate(local("2026-11-02T15:00", "2026-11-02T20:00"), LA_PAZ))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("noches");
    assertThatThrownBy(
            () -> window(Vertical.HOTEL).validate(local("2026-11-01T15:00", "2026-12-02T12:00"), LA_PAZ))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("31");
  }

  @Test
  void el_portal_publico_pasa_al_dia_siguiente_solo_si_la_vertical_admite_noches() {
    LocalDate day = LocalDate.parse("2026-11-06");

    var night =
        PublicReservationTimeRange.resolve(
            day, LocalTime.of(23, 0), null, LocalTime.of(4, 0), LA_PAZ, true);
    assertThatCode(() -> window(Vertical.NIGHTCLUB).validate(night, LA_PAZ))
        .doesNotThrowAnyException();
    org.assertj.core.api.Assertions.assertThat(night.endsAt()).isEqualTo(at("2026-11-07T04:00"));

    assertThatThrownBy(
            () ->
                PublicReservationTimeRange.resolve(
                    day, LocalTime.of(23, 0), null, LocalTime.of(4, 0), LA_PAZ, false))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("anterior");
  }

  @Test
  void el_portal_publico_usa_la_fecha_de_salida_explicita_del_hotel() {
    var stay =
        PublicReservationTimeRange.resolve(
            LocalDate.parse("2026-11-02"),
            LocalTime.of(15, 0),
            LocalDate.parse("2026-11-05"),
            LocalTime.of(12, 0),
            LA_PAZ,
            true);

    org.assertj.core.api.Assertions.assertThat(stay.startsAt()).isEqualTo(at("2026-11-02T15:00"));
    org.assertj.core.api.Assertions.assertThat(stay.endsAt()).isEqualTo(at("2026-11-05T12:00"));
    assertThatCode(() -> window(Vertical.HOTEL).validate(stay, LA_PAZ)).doesNotThrowAnyException();
  }
}
