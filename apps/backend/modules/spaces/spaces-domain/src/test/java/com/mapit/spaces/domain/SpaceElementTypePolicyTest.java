package com.mapit.spaces.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Mapeo vertical → tipos de elemento válidos (HU-2.03, RN-4). Criterio provisional que
 * CU-07 refinará; si cambia, solo se toca {@link SpaceElementTypePolicy}.
 */
class SpaceElementTypePolicyTest {

  @Test
  void restaurante_admite_mesa_barra_escenario_y_decor() {
    assertThat(SpaceElementTypePolicy.permitidos(EstablishmentType.RESTAURANT))
        .containsExactlyInAnyOrder(
            SpaceElementType.TABLE,
            SpaceElementType.BAR,
            SpaceElementType.SECTOR_ZONE,
            SpaceElementType.STAGE,
            SpaceElementType.DECOR);
  }

  @Test
  void discoteca_comparte_los_tipos_comunes_del_restaurante() {
    assertThat(SpaceElementTypePolicy.permitidos(EstablishmentType.NIGHTCLUB))
        .isEqualTo(SpaceElementTypePolicy.permitidos(EstablishmentType.RESTAURANT));
  }

  @Test
  void salon_de_eventos_admite_butacas_adicionales() {
    assertThat(SpaceElementTypePolicy.permitidos(EstablishmentType.EVENT_HALL))
        .contains(SpaceElementType.SEAT)
        .containsAll(SpaceElementTypePolicy.permitidos(EstablishmentType.RESTAURANT));
  }

  @Test
  void hotel_solo_admite_habitacion_y_decoracion() {
    assertThat(SpaceElementTypePolicy.permitidos(EstablishmentType.HOTEL))
        .containsExactlyInAnyOrder(SpaceElementType.ROOM, SpaceElementType.DECOR);
  }

  @Test
  void una_habitacion_no_es_valida_en_un_restaurante() {
    assertThat(SpaceElementTypePolicy.esPermitido(EstablishmentType.RESTAURANT, SpaceElementType.ROOM))
        .isFalse();
    assertThat(SpaceElementTypePolicy.esPermitido(EstablishmentType.HOTEL, SpaceElementType.ROOM))
        .isTrue();
  }

  @Test
  void una_butaca_no_es_valida_en_un_hotel() {
    // El hotel vende estadías en habitaciones, no butacas numeradas por evento (CU-21/CU-22).
    assertThat(SpaceElementTypePolicy.esPermitido(EstablishmentType.HOTEL, SpaceElementType.SEAT))
        .isFalse();
    assertThat(
            SpaceElementTypePolicy.esPermitido(EstablishmentType.EVENT_HALL, SpaceElementType.SEAT))
        .isTrue();
  }

  @Test
  void la_mesa_aplica_en_varias_verticales() {
    assertThat(SpaceElementTypePolicy.esPermitido(EstablishmentType.RESTAURANT, SpaceElementType.TABLE))
        .isTrue();
    assertThat(SpaceElementTypePolicy.esPermitido(EstablishmentType.NIGHTCLUB, SpaceElementType.TABLE))
        .isTrue();
    assertThat(SpaceElementTypePolicy.esPermitido(EstablishmentType.EVENT_HALL, SpaceElementType.TABLE))
        .isTrue();
  }
}
