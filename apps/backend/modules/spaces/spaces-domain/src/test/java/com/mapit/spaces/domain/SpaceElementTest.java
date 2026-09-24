package com.mapit.spaces.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.mapit.shared.realtime.SpaceElementState;
import com.mapit.shared.tenant.TenantId;

/**
 * Reglas de negocio de SpaceElement (HU-2.03 / MAP-110). Sin contexto de Spring.
 */
class SpaceElementTest {

  private static final TenantId TENANT = TenantId.of("demo");
  private static final UUID SECTOR = UUID.randomUUID();
  private static final Instant AHORA = Instant.parse("2026-09-23T12:00:00Z");
  private static final UUID USUARIO = UUID.randomUUID();

  private static SpaceElement unElemento() {
    return SpaceElement.register(
        SpaceElementId.generate(),
        TENANT,
        SECTOR,
        SpaceElementType.TABLE,
        100.0,
        50.0,
        SpaceElementState.AVAILABLE,
        AHORA,
        USUARIO);
  }

  @Test
  void registra_con_los_datos_dados() {
    SpaceElement e = unElemento();
    assertThat(e.type()).isEqualTo(SpaceElementType.TABLE);
    assertThat(e.x()).isEqualTo(100.0);
    assertThat(e.y()).isEqualTo(50.0);
    assertThat(e.state()).isEqualTo(SpaceElementState.AVAILABLE);
    assertThat(e.tenantId()).isEqualTo(TENANT);
    assertThat(e.sectorId()).isEqualTo(SECTOR);
    assertThat(e.isDeleted()).isFalse();
    assertThat(e.audit().createdAt()).isEqualTo(AHORA);
  }

  @Test
  void initialState_nulo_deja_available() {
    SpaceElement e =
        SpaceElement.register(
            SpaceElementId.generate(), TENANT, SECTOR, SpaceElementType.TABLE, 0.0, 0.0, null,
            AHORA, USUARIO);
    assertThat(e.state()).isEqualTo(SpaceElementState.AVAILABLE);
  }

  @Test
  void acepta_el_origen_del_sector() {
    SpaceElement e =
        SpaceElement.register(
            SpaceElementId.generate(), TENANT, SECTOR, SpaceElementType.DECOR, 0.0, 0.0,
            null, AHORA, USUARIO);
    assertThat(e.x()).isZero();
    assertThat(e.y()).isZero();
  }

  @Test
  void rechaza_coordenada_x_negativa() {
    assertThatThrownBy(
            () ->
                SpaceElement.register(
                    SpaceElementId.generate(), TENANT, SECTOR, SpaceElementType.TABLE, -1.0,
                    0.0, null, AHORA, USUARIO))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("no pueden ser negativas");
  }

  @Test
  void rechaza_coordenada_y_negativa() {
    assertThatThrownBy(
            () ->
                SpaceElement.register(
                    SpaceElementId.generate(), TENANT, SECTOR, SpaceElementType.TABLE, 0.0,
                    -5.5, null, AHORA, USUARIO))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("no pueden ser negativas");
  }

  @Test
  void rechaza_coordenadas_no_finitas() {
    assertThatThrownBy(
            () ->
                SpaceElement.register(
                    SpaceElementId.generate(), TENANT, SECTOR, SpaceElementType.TABLE,
                    Double.NaN, 0.0, null, AHORA, USUARIO))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(
            () ->
                SpaceElement.register(
                    SpaceElementId.generate(), TENANT, SECTOR, SpaceElementType.TABLE, 0.0,
                    Double.POSITIVE_INFINITY, null, AHORA, USUARIO))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void rechaza_coordenadas_null_con_400() {
    assertThatThrownBy(
            () ->
                SpaceElement.register(
                    SpaceElementId.generate(), TENANT, SECTOR, SpaceElementType.TABLE, null,
                    0.0, null, AHORA, USUARIO))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("obligatorias");
  }

  @Test
  void update_cambia_tipo_y_coordenadas_y_conserva_estado() {
    SpaceElement e = unElemento();
    Instant despues = AHORA.plusSeconds(60);
    SpaceElement actualizado = e.update(SpaceElementType.BAR, 200.0, 10.0, despues, USUARIO);

    assertThat(actualizado.type()).isEqualTo(SpaceElementType.BAR);
    assertThat(actualizado.x()).isEqualTo(200.0);
    assertThat(actualizado.y()).isEqualTo(10.0);
    assertThat(actualizado.state()).isEqualTo(SpaceElementState.AVAILABLE); // no tocado
    assertThat(actualizado.audit().createdAt()).isEqualTo(AHORA);
    assertThat(actualizado.audit().updatedAt()).isEqualTo(despues);
  }

  @Test
  void no_se_actualiza_un_elemento_dado_de_baja() {
    SpaceElement borrado = unElemento().softDelete(AHORA.plusSeconds(1), USUARIO);
    assertThatThrownBy(
            () ->
                borrado.update(
                    SpaceElementType.TABLE, 1.0, 1.0, AHORA.plusSeconds(2), USUARIO))
        .isInstanceOf(IllegalStateException.class);
  }

  @Test
  void baja_logica_es_idempotente_en_estado() {
    SpaceElement borrado = unElemento().softDelete(AHORA.plusSeconds(1), USUARIO);
    assertThat(borrado.isDeleted()).isTrue();
    assertThatThrownBy(() -> borrado.softDelete(AHORA.plusSeconds(2), USUARIO))
        .isInstanceOf(IllegalStateException.class);
  }

  @Test
  void changeState_prepara_el_modelo_para_hu_3_01() {
    SpaceElement e = unElemento();
    SpaceElement ocupado = e.changeState(SpaceElementState.OCCUPIED, AHORA.plusSeconds(3), USUARIO);
    assertThat(ocupado.state()).isEqualTo(SpaceElementState.OCCUPIED);
    assertThat(ocupado.audit().updatedAt()).isAfter(AHORA);
  }
}
