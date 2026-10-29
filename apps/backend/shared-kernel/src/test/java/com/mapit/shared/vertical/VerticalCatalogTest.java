package com.mapit.shared.vertical;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.LocalTime;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import com.mapit.shared.flags.FeatureFlag;

/** Matriz de la spec HU-7.01/7.02 (D4 y D5): si cambia, cambia aquí y en la spec. */
class VerticalCatalogTest {

  @ParameterizedTest
  @EnumSource(Vertical.class)
  void cada_vertical_tiene_perfil_y_nunca_reserva_escenario_ni_decoracion(Vertical vertical) {
    VerticalProfile profile = VerticalCatalog.of(vertical);

    assertThat(profile.vertical()).isEqualTo(vertical);
    assertThat(profile.reservableElementTypes()).isNotEmpty().doesNotContain("STAGE", "DECOR");
    assertThat(profile.allowedElementTypes()).containsAll(profile.reservableElementTypes());
  }

  @Test
  void restaurante_reserva_turnos_del_mismo_dia_de_hasta_seis_horas() {
    VerticalProfile profile = VerticalCatalog.of("RESTAURANT");

    assertThat(profile.bookingMode()).isEqualTo(BookingMode.SHIFT);
    assertThat(profile.allowsOvernight()).isFalse();
    assertThat(profile.maxDuration()).isEqualTo(Duration.ofHours(6));
    assertThat(profile.reservableElementTypes()).containsExactlyInAnyOrder("TABLE", "BAR", "SECTOR_ZONE");
    assertThat(profile.isAllowed("ROOM")).isFalse();
    assertThat(profile.flag()).isEmpty();
  }

  @Test
  void discoteca_reserva_noches_que_cruzan_medianoche_con_zonas_elegibles() {
    VerticalProfile profile = VerticalCatalog.of(Vertical.NIGHTCLUB);

    assertThat(profile.bookingMode()).isEqualTo(BookingMode.NIGHT);
    assertThat(profile.allowsOvernight()).isTrue();
    assertThat(profile.maxDuration()).isEqualTo(Duration.ofHours(12));
    assertThat(profile.isReservable("SECTOR_ZONE")).isTrue();
    assertThat(profile.isReservable("STAGE")).isFalse();
  }

  @Test
  void salon_reserva_butacas_y_depende_de_su_flag() {
    VerticalProfile profile = VerticalCatalog.of(Vertical.EVENT_HALL);

    assertThat(profile.bookingMode()).isEqualTo(BookingMode.EVENT);
    assertThat(profile.isAllowed("SEAT")).isTrue();
    assertThat(profile.isReservable("SEAT")).isTrue();
    assertThat(profile.flag()).contains(FeatureFlag.VERTICAL_EVENT_HALL);
  }

  @Test
  void hotel_reserva_solo_habitaciones_por_noches() {
    VerticalProfile profile = VerticalCatalog.of(Vertical.HOTEL);

    assertThat(profile.bookingMode()).isEqualTo(BookingMode.STAY);
    assertThat(profile.allowedElementTypes()).containsExactlyInAnyOrder("ROOM", "DECOR");
    assertThat(profile.reservableElementTypes()).containsExactly("ROOM");
    assertThat(profile.maxDuration()).isNull();
    assertThat(profile.minNights()).isEqualTo(1);
    assertThat(profile.maxNights()).isEqualTo(30);
    assertThat(profile.defaultStartTime()).isEqualTo(LocalTime.of(15, 0));
    assertThat(profile.defaultEndTime()).isEqualTo(LocalTime.of(12, 0));
    assertThat(profile.flag()).contains(FeatureFlag.VERTICAL_HOTEL);
  }

  @Test
  void un_valor_persistido_desconocido_no_se_convierte_en_otra_vertical() {
    assertThatThrownBy(() -> VerticalCatalog.of("SPA"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("SPA");
  }

  @Test
  void las_flags_de_vertical_quedan_encendidas_si_unleash_no_responde() {
    assertThat(FeatureFlag.VERTICAL_HOTEL.valorPorDefecto()).isTrue();
    assertThat(FeatureFlag.VERTICAL_EVENT_HALL.valorPorDefecto()).isTrue();
  }
}
