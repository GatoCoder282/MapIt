package com.mapit.platform.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;

import org.junit.jupiter.api.Test;

import com.mapit.shared.tenant.TenantId;

class TenantTest {

  private static final Instant NOW = Instant.parse("2026-09-03T12:00:00Z");

  @Test
  void registra_un_tenant_activo_con_los_datos_normalizados() {
    Tenant tenant =
        Tenant.register(
            TenantId.generate(),
            "  Restaurante Central  ",
            "restaurante-central",
            BusinessVertical.RESTAURANT,
            NOW);

    assertThat(tenant.name()).isEqualTo("Restaurante Central");
    assertThat(tenant.slug()).isEqualTo("restaurante-central");
    assertThat(tenant.vertical()).isEqualTo(BusinessVertical.RESTAURANT);
    assertThat(tenant.status()).isEqualTo(TenantStatus.ACTIVE);
    assertThat(tenant.createdAt()).isEqualTo(NOW);
    assertThat(tenant.updatedAt()).isEqualTo(NOW);
  }

  @Test
  void rechaza_un_slug_con_formato_invalido() {
    assertThatThrownBy(
            () ->
                Tenant.register(
                    TenantId.generate(), "Empresa", "Empresa Central", BusinessVertical.HOTEL, NOW))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("slug");
  }

  @Test
  void genera_ids_distintos_sin_recibirlos_del_cliente() {
    TenantId first = TenantId.generate();
    TenantId second = TenantId.generate();

    assertThat(first).isNotEqualTo(second);
    assertThat(first.value()).matches("^[a-z0-9][a-z0-9-]{1,62}$");
  }
}
