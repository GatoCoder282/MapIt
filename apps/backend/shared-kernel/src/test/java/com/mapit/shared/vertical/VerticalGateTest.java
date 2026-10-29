package com.mapit.shared.vertical;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.HashSet;
import java.util.Set;

import org.junit.jupiter.api.Test;

import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagPort;
import com.mapit.shared.tenant.TenantId;

class VerticalGateTest {

  private static final TenantId TENANT_A = TenantId.of("tenant-a");
  private static final TenantId TENANT_B = TenantId.of("tenant-b");

  /** Unleash en memoria: apaga flags por tenant, como una estrategia con {@code tenantId}. */
  private static final class FlagsPorTenant implements FeatureFlagPort {
    private final Set<String> apagadas = new HashSet<>();

    void apagar(FeatureFlag flag, TenantId tenant) {
      apagadas.add(flag.clave() + "@" + tenant.value());
    }

    @Override
    public boolean isEnabled(FeatureFlag flag) {
      return flag.valorPorDefecto();
    }

    @Override
    public boolean isEnabled(FeatureFlag flag, boolean valorPorDefecto) {
      return valorPorDefecto;
    }

    @Override
    public boolean isEnabledFor(FeatureFlag flag, TenantId tenantId) {
      return !apagadas.contains(flag.clave() + "@" + tenantId.value());
    }
  }

  @Test
  void las_verticales_base_no_dependen_de_ninguna_flag() {
    FlagsPorTenant flags = new FlagsPorTenant();
    VerticalGate gate = new VerticalGate(flags);

    assertThat(gate.isEnabled(Vertical.RESTAURANT, TENANT_A)).isTrue();
    assertThat(gate.isEnabled(Vertical.NIGHTCLUB, TENANT_A)).isTrue();
  }

  @Test
  void apagar_hotel_para_un_tenant_no_afecta_a_otro() {
    FlagsPorTenant flags = new FlagsPorTenant();
    flags.apagar(FeatureFlag.VERTICAL_HOTEL, TENANT_A);
    VerticalGate gate = new VerticalGate(flags);

    assertThat(gate.isEnabled(Vertical.HOTEL, TENANT_A)).isFalse();
    assertThat(gate.isEnabled(Vertical.HOTEL, TENANT_B)).isTrue();
    assertThat(gate.isEnabled(Vertical.EVENT_HALL, TENANT_A)).isTrue();
  }

  @Test
  void require_rechaza_la_vertical_apagada_sin_cambiarla() {
    FlagsPorTenant flags = new FlagsPorTenant();
    flags.apagar(FeatureFlag.VERTICAL_EVENT_HALL, TENANT_A);
    VerticalGate gate = new VerticalGate(flags);

    assertThatThrownBy(() -> gate.require(Vertical.EVENT_HALL, TENANT_A))
        .isInstanceOfSatisfying(
            VerticalDisabledException.class,
            ex -> assertThat(ex.vertical()).isEqualTo(Vertical.EVENT_HALL));
  }

  @Test
  void sin_unleash_se_usa_el_valor_por_defecto_del_catalogo() {
    FeatureFlagPort caido =
        new FeatureFlagPort() {
          @Override
          public boolean isEnabled(FeatureFlag flag) {
            return flag.valorPorDefecto();
          }

          @Override
          public boolean isEnabled(FeatureFlag flag, boolean valorPorDefecto) {
            return valorPorDefecto;
          }
        };
    VerticalGate gate = new VerticalGate(caido);

    assertThat(gate.isEnabled(Vertical.HOTEL, TENANT_A)).isTrue();
    assertThat(gate.isEnabled(Vertical.EVENT_HALL, TENANT_A)).isTrue();
  }
}
