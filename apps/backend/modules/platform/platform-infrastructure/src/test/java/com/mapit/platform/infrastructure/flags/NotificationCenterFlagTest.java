package com.mapit.platform.infrastructure.flags;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagContext;
import com.mapit.shared.flags.FeatureFlagPort;
import com.mapit.shared.tenant.TenantId;

import io.getunleash.Unleash;
import io.getunleash.UnleashContext;
import io.getunleash.UnleashException;
import io.getunleash.event.ClientFeaturesResponse;

class NotificationCenterFlagTest {
    private static final FeatureFlag FLAG = FeatureFlag.MAPIT_S6_NOTIFICATION_CENTER;
    private static final Instant NOW = Instant.parse("2026-11-21T16:00:00Z");
    private static final FeatureFlagContext A = context("tenant-a", "session-a");
    private final Unleash unleash = mock(Unleash.class);
    private final Clock clock = mock(Clock.class);
    private final UnleashLoggingSubscriber transport = new UnleashLoggingSubscriber(clock);
    private final UnleashFeatureFlagAdapter adapter = new UnleashFeatureFlagAdapter(unleash, transport, new MyAccountFlagAvailability());

    private void healthy() {
        when(clock.instant()).thenReturn(NOW);
        transport.togglesFetched(ClientFeaturesResponse.notChanged());
    }

    @Test
    void default_es_off_y_un_contexto_o_proveedor_ausentes_no_heredan_on() {
        when(clock.instant()).thenReturn(NOW);
        assertThat(FLAG.clave()).isEqualTo("mapit.s6.notification-center");
        assertThat(FLAG.tipo()).isEqualTo(FeatureFlag.Tipo.KILL_SWITCH);
        assertThat(FLAG.valorPorDefecto()).isFalse();
        assertThat(adapter.isEnabledFor(FLAG, A)).isFalse();
        assertThat(adapter.isEnabled(FLAG, true)).isFalse();
        assertThat(adapter.isEnabledFor(FLAG, A.tenantId())).isFalse();
        verifyNoInteractions(unleash);
        assertThat(new DisabledFeatureFlagAdapter().isEnabledFor(FLAG, A)).isFalse();
        assertThat(new DisabledFeatureFlagAdapter().isEnabled(FLAG, true)).isFalse();
        FeatureFlagPort unsupported = new FeatureFlagPort() {
            @Override public boolean isEnabled(FeatureFlag flag) { return true; }
            @Override public boolean isEnabled(FeatureFlag flag, boolean fallback) { return true; }
        };
        assertThat(unsupported.isEnabledFor(FLAG, A)).isFalse();
    }

    @Test
    void transmite_tenant_usuario_y_sesion_sin_cache_compartido_de_evaluaciones() {
        healthy();
        when(unleash.isEnabled(eq(FLAG.clave()), any(UnleashContext.class), eq(false)))
                .thenAnswer(invocation -> {
                    UnleashContext context = invocation.getArgument(1);
                    assertThat(context.getUserId()).contains(A.userId().toString());
                    return context.getProperties().get("tenantId").equals("tenant-a")
                            && context.getSessionId().orElseThrow().equals("session-a");
                });
        assertThat(adapter.isEnabledFor(FLAG, A)).isTrue();
        assertThat(adapter.isEnabledFor(FLAG, context("tenant-b", "session-a"))).isFalse();
        assertThat(adapter.isEnabledFor(FLAG, context("tenant-a", "session-b"))).isFalse();
        assertThat(adapter.isEnabledFor(FLAG, A)).isTrue();
    }

    @Test
    void flag_inexistente_off_y_excepcion_no_conservan_un_on_previo() {
        healthy();
        when(unleash.isEnabled(eq(FLAG.clave()), any(UnleashContext.class), eq(false)))
                .thenReturn(true).thenReturn(false).thenThrow(new IllegalStateException("private-canary"));
        assertThat(adapter.isEnabledFor(FLAG, A)).isTrue();
        assertThat(adapter.isEnabledFor(FLAG, A)).isFalse();
        assertThat(adapter.isEnabledFor(FLAG, A)).isFalse();
    }

    @Test
    void fallo_del_proveedor_cierra_cache_on_y_recuperacion_requiere_un_fetch_correcto() {
        healthy();
        when(unleash.isEnabled(eq(FLAG.clave()), any(UnleashContext.class), eq(false))).thenReturn(true);
        assertThat(adapter.isEnabledFor(FLAG, A)).isTrue();
        transport.onError(mock(UnleashException.class));
        assertThat(adapter.isEnabledFor(FLAG, A)).isFalse();
        transport.togglesFetched(ClientFeaturesResponse.notChanged());
        assertThat(adapter.isEnabledFor(FLAG, A)).isTrue();
        transport.togglesFetched(ClientFeaturesResponse.unavailable(503, Optional.empty()));
        assertThat(adapter.isEnabledFor(FLAG, A)).isFalse();
    }

    @Test
    void cache_sin_fetch_reciente_o_reloj_regresivo_falla_cerrado() {
        healthy();
        when(unleash.isEnabled(eq(FLAG.clave()), any(UnleashContext.class), eq(false))).thenReturn(true);
        when(clock.instant()).thenReturn(NOW.plusSeconds(29));
        assertThat(adapter.isEnabledFor(FLAG, A)).isTrue();
        when(clock.instant()).thenReturn(NOW.plusSeconds(30));
        assertThat(adapter.isEnabledFor(FLAG, A)).isFalse();
        when(clock.instant()).thenReturn(NOW.minusSeconds(1));
        assertThat(adapter.isEnabledFor(FLAG, A)).isFalse();
    }

    @Test
    void un_error_durante_evaluacion_impide_devolver_on_y_no_cambia_flags_anteriores() {
        healthy();
        when(unleash.isEnabled(eq(FLAG.clave()), any(UnleashContext.class), eq(false)))
                .thenAnswer(invocation -> { transport.onError(mock(UnleashException.class)); return true; });
        assertThat(adapter.isEnabledFor(FLAG, A)).isFalse();
        when(unleash.isEnabled("realtime.websocket", true)).thenReturn(true);
        assertThat(adapter.isEnabled(FeatureFlag.REALTIME_WEBSOCKET)).isTrue();
        assertThat(new DisabledFeatureFlagAdapter().isEnabled(FeatureFlag.PAYMENTS_QR, true)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " ", "jwt.payload.signature", "secret/credential"})
    void contexto_rechaza_sesion_invalida_sin_incluir_valores_en_el_error(String session) {
        assertThatThrownBy(() -> context("tenant-a", session)).isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Contexto de sesión inválido");
    }

    private static FeatureFlagContext context(String tenant, String session) {
        return new FeatureFlagContext(TenantId.of(tenant), new UUID(0, 1), session);
    }
}
