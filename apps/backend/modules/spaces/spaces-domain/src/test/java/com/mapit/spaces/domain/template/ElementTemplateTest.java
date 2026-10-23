package com.mapit.spaces.domain.template;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;

import org.junit.jupiter.api.Test;

import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.spaceelement.SpaceElementType;

/** Pruebas de las invariantes del dominio de ElementTemplate (HU-4.02 / MAP-202). */
class ElementTemplateTest {

  private static final TenantId TENANT = TenantId.of("tenant-test");
  private static final Instant AHORA = Instant.parse("2026-10-04T12:00:00Z");

  @Test
  void register_crea_plantilla_valida() {
    var t = ElementTemplate.register(
        ElementTemplateId.generate(), TENANT, "Mesa redonda", SpaceElementType.TABLE, AHORA, null);

    assertThat(t.name()).isEqualTo("Mesa redonda");
    assertThat(t.type()).isEqualTo(SpaceElementType.TABLE);
    assertThat(t.tenantId()).isEqualTo(TENANT);
    assertThat(t.isDeleted()).isFalse();
  }

  @Test
  void nombre_vacio_lanza_excepcion() {
    assertThatThrownBy(() ->
        ElementTemplate.register(
            ElementTemplateId.generate(), TENANT, "   ", SpaceElementType.TABLE, AHORA, null))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("vacío");
  }

  @Test
  void nombre_demasiado_largo_lanza_excepcion() {
    String largo = "a".repeat(101);
    assertThatThrownBy(() ->
        ElementTemplate.register(
            ElementTemplateId.generate(), TENANT, largo, SpaceElementType.TABLE, AHORA, null))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("100");
  }

  @Test
  void update_modifica_nombre_y_tipo() {
    var t = plantilla("Original", SpaceElementType.TABLE);
    var updated = t.update("Modificado", SpaceElementType.BAR, AHORA.plusSeconds(60), null);

    assertThat(updated.name()).isEqualTo("Modificado");
    assertThat(updated.type()).isEqualTo(SpaceElementType.BAR);
    assertThat(updated.audit().updatedAt()).isAfter(t.audit().createdAt());
  }

  @Test
  void update_dada_de_baja_lanza_excepcion() {
    var t = plantilla("Borrada", SpaceElementType.TABLE).softDelete(AHORA, null);
    assertThatThrownBy(() -> t.update("X", SpaceElementType.BAR, AHORA, null))
        .isInstanceOf(IllegalStateException.class);
  }

  @Test
  void soft_delete_marca_como_eliminada() {
    var t = plantilla("Para borrar", SpaceElementType.DECOR);
    var deleted = t.softDelete(AHORA, null);

    assertThat(deleted.isDeleted()).isTrue();
    assertThat(deleted.audit().deletedAt()).isEqualTo(AHORA);
  }

  @Test
  void soft_delete_dos_veces_lanza_excepcion() {
    var t = plantilla("Ya borrada", SpaceElementType.TABLE).softDelete(AHORA, null);
    assertThatThrownBy(() -> t.softDelete(AHORA, null))
        .isInstanceOf(IllegalStateException.class);
  }

  private ElementTemplate plantilla(String name, SpaceElementType type) {
    return ElementTemplate.register(ElementTemplateId.generate(), TENANT, name, type, AHORA, null);
  }
}
