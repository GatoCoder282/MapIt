package com.mapit.spaces.domain.spaceelement;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import com.mapit.spaces.domain.establishment.EstablishmentType;
/**
 * Mapeo vertical → tipos de elemento válidos (HU-2.03, RN-4), documentado como contrato en
 * HU-7.01/7.02 (spec D5). La matriz vive en {@code VerticalCatalog}.
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

  @Test
  void cada_tipo_del_catalogo_existe_en_el_enum_de_spaces() {
    // El catálogo compartido guarda los tipos como texto: si alguien escribe uno que spaces
    // no conoce, aquí falla en vez de en producción.
    for (EstablishmentType vertical : EstablishmentType.values()) {
      var profile = com.mapit.shared.vertical.VerticalCatalog.of(vertical.name());
      profile.allowedElementTypes().forEach(SpaceElementType::valueOf);
      assertThat(SpaceElementTypePolicy.permitidos(vertical))
          .extracting(Enum::name)
          .containsExactlyInAnyOrderElementsOf(profile.allowedElementTypes());
    }
  }

  @Test
  void ningun_tipo_de_establecimiento_queda_fuera_del_catalogo() {
    for (EstablishmentType vertical : EstablishmentType.values()) {
      assertThat(SpaceElementTypePolicy.permitidos(vertical)).isNotEmpty();
    }
  }
}
