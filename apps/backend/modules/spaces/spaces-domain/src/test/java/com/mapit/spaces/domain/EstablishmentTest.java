package com.mapit.spaces.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.mapit.shared.tenant.TenantId;

/** Reglas de negocio del establecimiento (CU-04). Sin contexto de Spring. */
class EstablishmentTest {

  private static final TenantId TENANT = TenantId.of("demo");
  private static final Instant AHORA = Instant.parse("2026-09-09T12:00:00Z");

  private static Establishment unEstablecimiento() {
    return Establishment.register(
        UUID.randomUUID(),
        TENANT,
        "Bar Central",
        EstablishmentType.NIGHTCLUB,
        Slug.of("bar-central"),
        "America/La_Paz",
        AHORA,
        null);
  }

  @Test
  void registra_con_los_datos_dados() {
    Establishment establecimiento = unEstablecimiento();

    assertThat(establecimiento.name()).isEqualTo("Bar Central");
    assertThat(establecimiento.type()).isEqualTo(EstablishmentType.NIGHTCLUB);
    assertThat(establecimiento.slug().value()).isEqualTo("bar-central");
    assertThat(establecimiento.tenantId()).isEqualTo(TENANT);
    assertThat(establecimiento.isDeleted()).isFalse();
    assertThat(establecimiento.audit().createdAt()).isEqualTo(AHORA);
    assertThat(establecimiento.audit().updatedAt()).isEqualTo(AHORA);
  }

  @Test
  void aplica_la_zona_horaria_por_defecto_cuando_no_se_indica() {
    Establishment establecimiento =
        Establishment.register(
            UUID.randomUUID(),
            TENANT,
            "Sin zona",
            EstablishmentType.HOTEL,
            Slug.of("sin-zona"),
            null,
            AHORA,
            null);

    assertThat(establecimiento.timezone()).isEqualTo(Establishment.ZONA_HORARIA_POR_DEFECTO);
  }

  @Test
  void recorta_los_espacios_del_nombre() {
    Establishment establecimiento =
        Establishment.register(
            UUID.randomUUID(),
            TENANT,
            "   Con espacios   ",
            EstablishmentType.RESTAURANT,
            Slug.of("con-espacios"),
            null,
            AHORA,
            null);

    assertThat(establecimiento.name()).isEqualTo("Con espacios");
  }

  @Test
  void rechaza_un_nombre_vacio() {
    assertThatThrownBy(
            () ->
                Establishment.register(
                    UUID.randomUUID(),
                    TENANT,
                    "   ",
                    EstablishmentType.RESTAURANT,
                    Slug.of("vacio"),
                    null,
                    AHORA,
                    null))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("vacío");
  }

  @Test
  void rechaza_un_nombre_demasiado_largo() {
    String largo = "a".repeat(121);

    assertThatThrownBy(
            () ->
                Establishment.register(
                    UUID.randomUUID(),
                    TENANT,
                    largo,
                    EstablishmentType.RESTAURANT,
                    Slug.of("largo"),
                    null,
                    AHORA,
                    null))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("120");
  }

  @Test
  void rechaza_una_zona_horaria_que_no_es_iana() {
    assertThatThrownBy(
            () ->
                Establishment.register(
                    UUID.randomUUID(),
                    TENANT,
                    "Zona rara",
                    EstablishmentType.HOTEL,
                    Slug.of("zona-rara"),
                    "Marte/Olympus",
                    AHORA,
                    null))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("IANA");
  }

  @Test
  void actualizar_conserva_el_tipo_y_la_fecha_de_creacion() {
    Establishment original = unEstablecimiento();
    Instant despues = AHORA.plus(1, ChronoUnit.HOURS);

    Establishment actualizado =
        original.update("Bar Central VIP", Slug.of("bar-central-vip"), "America/Lima", despues, null);

    // RN-3: el tipo es inmutable. Ni siquiera es parámetro del método.
    assertThat(actualizado.type()).isEqualTo(original.type());
    assertThat(actualizado.id()).isEqualTo(original.id());
    assertThat(actualizado.audit().createdAt()).isEqualTo(AHORA);
    assertThat(actualizado.audit().updatedAt()).isEqualTo(despues);
    assertThat(actualizado.name()).isEqualTo("Bar Central VIP");
    assertThat(actualizado.timezone()).isEqualTo("America/Lima");
  }

  @Test
  void actualizar_no_muta_el_original() {
    Establishment original = unEstablecimiento();

    original.update("Otro nombre", Slug.of("otro-nombre"), null, AHORA.plusSeconds(60), null);

    assertThat(original.name()).isEqualTo("Bar Central");
  }

  @Test
  void dar_de_baja_marca_la_fecha_sin_perder_los_datos() {
    Establishment original = unEstablecimiento();
    Instant despues = AHORA.plus(2, ChronoUnit.HOURS);

    Establishment dadoDeBaja = original.softDelete(despues, null);

    assertThat(dadoDeBaja.isDeleted()).isTrue();
    assertThat(dadoDeBaja.audit().deletedAt()).isEqualTo(despues);
    assertThat(dadoDeBaja.name()).isEqualTo("Bar Central");
    assertThat(dadoDeBaja.slug()).isEqualTo(original.slug());
  }

  @Test
  void no_permite_dar_de_baja_dos_veces() {
    Establishment dadoDeBaja = unEstablecimiento().softDelete(AHORA, null);

    assertThatThrownBy(() -> dadoDeBaja.softDelete(AHORA.plusSeconds(60), null))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("ya estaba dado de baja");
  }

  @Test
  void no_permite_actualizar_uno_dado_de_baja() {
    Establishment dadoDeBaja = unEstablecimiento().softDelete(AHORA, null);

    assertThatThrownBy(
            () -> dadoDeBaja.update("Nuevo", Slug.of("nuevo"), null, AHORA.plusSeconds(60), null))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("dado de baja");
  }
}
