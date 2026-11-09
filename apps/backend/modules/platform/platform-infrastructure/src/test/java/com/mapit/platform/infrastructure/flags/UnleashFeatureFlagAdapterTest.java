package com.mapit.platform.infrastructure.flags;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.tenant.TenantId;

import io.getunleash.Unleash;
import io.getunleash.UnleashContext;

/** HU-7.01/7.02 · MAP-235: la flag de vertical se evalúa con el tenant y falla abierta. */
class UnleashFeatureFlagAdapterTest {

  private final Unleash unleash = mock(Unleash.class);
  private final UnleashFeatureFlagAdapter adapter = new UnleashFeatureFlagAdapter(unleash);

  @Test
  void evalua_la_vertical_con_el_tenant_como_contexto_y_el_default_del_catalogo() {
    when(unleash.isEnabled(eq("vertical.hotel"), any(UnleashContext.class), anyBoolean()))
        .thenReturn(false);

    boolean enabled = adapter.isEnabledFor(FeatureFlag.VERTICAL_HOTEL, TenantId.of("hotel-a"));

    ArgumentCaptor<UnleashContext> context = ArgumentCaptor.forClass(UnleashContext.class);
    verify(unleash).isEnabled(eq("vertical.hotel"), context.capture(), eq(true));
    assertThat(context.getValue().getProperties())
        .containsEntry(UnleashFeatureFlagAdapter.TENANT_PROPERTY, "hotel-a");
    assertThat(enabled).isFalse();
  }

  @Test
  void si_unleash_no_conoce_la_flag_devuelve_el_default_encendido() {
    // El SDK devuelve el valor por defecto recibido cuando no tiene la flag (servidor caído).
    when(unleash.isEnabled(eq("vertical.event-hall"), any(UnleashContext.class), anyBoolean()))
        .thenAnswer(invocation -> invocation.getArgument(2));

    assertThat(adapter.isEnabledFor(FeatureFlag.VERTICAL_EVENT_HALL, TenantId.of("salon-a")))
        .isTrue();
  }
}
