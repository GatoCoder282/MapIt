package com.mapit.spaces.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;

import com.mapit.shared.tenant.TenantId;

/** Reglas de negocio del Piso/Nivel (CU-05). Sin contexto de Spring. */
class FloorTest {
  private static final TenantId TENANT = TenantId.of("demo");
  private static final UUID ESTABLISHMENT_ID = UUID.randomUUID();
  private static final Instant AHORA = Instant.parse("2026-09-12T12:00:00Z");
  private static final UUID USER_ID = UUID.randomUUID();

  private static Floor unPiso() {
    return Floor.register(
        UUID.randomUUID(),
        TENANT,
        ESTABLISHMENT_ID,
        "Planta Baja",
        1,
        Slug.of("planta-baja"),
        AHORA,
        USER_ID);
  }

  @Test
  void registra_con_los_datos_dados() {
    Floor piso = unPiso();
    assertThat(piso.name()).isEqualTo("Planta Baja");
    assertThat(piso.level()).isEqualTo(1);
    assertThat(piso.slug().value()).isEqualTo("planta-baja");
    assertThat(piso.tenantId()).isEqualTo(TENANT);
    assertThat(piso.establishmentId()).isEqualTo(ESTABLISHMENT_ID);
    assertThat(piso.isDeleted()).isFalse();
    assertThat(piso.audit().createdAt()).isEqualTo(AHORA);
  }

  @Test
  void recorta_los_espacios_del_nombre() {
    Floor piso = Floor.register(
        UUID.randomUUID(), TENANT, ESTABLISHMENT_ID, "   Piso 1   ", 2, Slug.of("piso-1"), AHORA, USER_ID);
    assertThat(piso.name()).isEqualTo("Piso 1");
  }

  @Test
  void rechaza_un_nombre_vacio() {
    assertThatThrownBy(() -> Floor.register(
        UUID.randomUUID(), TENANT, ESTABLISHMENT_ID, "   ", 1, Slug.of("vacio"), AHORA, USER_ID))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("vacío");
  }

  @Test
  void rechaza_un_nombre_demasiado_largo() {
    String largo = "a".repeat(101);
    assertThatThrownBy(() -> Floor.register(
        UUID.randomUUID(), TENANT, ESTABLISHMENT_ID, largo, 1, Slug.of("largo"), AHORA, USER_ID))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("100");
  }

  @Test
  void rechaza_niveles_fuera_de_rango() {
    assertThatThrownBy(() -> Floor.register(
        UUID.randomUUID(), TENANT, ESTABLISHMENT_ID, "Sótano", 0, Slug.of("sotano"), AHORA, USER_ID))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("level debe estar entre 1 y 999");

    assertThatThrownBy(() -> Floor.register(
        UUID.randomUUID(), TENANT, ESTABLISHMENT_ID, "Torre", 1000, Slug.of("torre"), AHORA, USER_ID))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("level debe estar entre 1 y 999");
  }

  @Test
  void actualizar_conserva_relaciones_y_actualiza_auditoria() {
    Floor original = unPiso();
    Instant despues = AHORA.plus(1, ChronoUnit.HOURS);

    Floor actualizado = original.update("Planta Alta", 2, Slug.of("planta-alta"), despues, USER_ID);

    assertThat(actualizado.id()).isEqualTo(original.id());
    assertThat(actualizado.establishmentId()).isEqualTo(original.establishmentId());
    assertThat(actualizado.name()).isEqualTo("Planta Alta");
    assertThat(actualizado.level()).isEqualTo(2);
    assertThat(actualizado.slug().value()).isEqualTo("planta-alta");
    assertThat(actualizado.audit().createdAt()).isEqualTo(AHORA);
    assertThat(actualizado.audit().updatedAt()).isEqualTo(despues);
  }

  @Test
  void actualizar_no_muta_el_original() {
    Floor original = unPiso();
    original.update("Otro nombre", 5, Slug.of("otro"), AHORA.plusSeconds(60), USER_ID);

    assertThat(original.name()).isEqualTo("Planta Baja");
    assertThat(original.level()).isEqualTo(1);
  }

  @Test
  void dar_de_baja_marca_la_fecha_sin_perder_los_datos() {
    Floor original = unPiso();
    Instant despues = AHORA.plus(2, ChronoUnit.HOURS);

    Floor dadoDeBaja = original.softDelete(despues, USER_ID);

    assertThat(dadoDeBaja.isDeleted()).isTrue();
    assertThat(dadoDeBaja.audit().deletedAt()).isEqualTo(despues);
    assertThat(dadoDeBaja.name()).isEqualTo("Planta Baja");
    assertThat(dadoDeBaja.slug()).isEqualTo(original.slug());
  }

  @Test
  void no_permite_dar_de_baja_dos_veces() {
    Floor dadoDeBaja = unPiso().softDelete(AHORA, USER_ID);
    assertThatThrownBy(() -> dadoDeBaja.softDelete(AHORA.plusSeconds(60), USER_ID))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("ya estaba dado de baja");
  }

  @Test
  void no_permite_actualizar_uno_dado_de_baja() {
    Floor dadoDeBaja = unPiso().softDelete(AHORA, USER_ID);
    assertThatThrownBy(() -> dadoDeBaja.update("Nuevo", 2, Slug.of("nuevo"), AHORA.plusSeconds(60), USER_ID))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("No se puede actualizar");
  }
}
