package com.mapit.payments.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.Test;

import com.mapit.shared.tenant.TenantId;

class MerchantPaymentMethodTest {
  @Test
  void exige_iso_y_no_acepta_proveedor_real_habilitado_sin_adaptador() {
    assertThatThrownBy(() -> method("XX", "BOB", PaymentProvider.MOCK_GATEWAY, null, false)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> method("BO", "ZZZ", PaymentProvider.MOCK_GATEWAY, null, false)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> method("BO", "BOB", PaymentProvider.INTEGRATED_GATEWAY, null, true)).isInstanceOf(IllegalArgumentException.class);
    assertThat(method("BO", "BOB", PaymentProvider.INTEGRATED_GATEWAY, null, false).enabled()).isFalse();
  }

  @Test
  void banco_requiere_imagen_raster_y_siempre_verificacion_manual() {
    assertThatThrownBy(() -> method("BO", "BOB", PaymentProvider.STATIC_BANK_QR, null, true)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> method("BO", "BOB", PaymentProvider.STATIC_BANK_QR, "https://example.com/qr.png", true)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> method("BO", "BOB", PaymentProvider.STATIC_BANK_QR, "data:image/svg+xml;base64,PHN2Zy8+", true)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> method("BO", "BOB", PaymentProvider.STATIC_BANK_QR, "data:image/png;base64,PHN2Zy8+", true)).isInstanceOf(IllegalArgumentException.class);
    assertThat(method("BO", "BOB", PaymentProvider.STATIC_BANK_QR, "data:image/png;base64,iVBORw0KGgoA", true).verification()).isEqualTo("MANUAL");
    assertThatThrownBy(() -> method("BO", "BOB", PaymentProvider.MOCK_GATEWAY, "data:image/png;base64,iVBORw0KGgoA", true)).isInstanceOf(IllegalArgumentException.class);
  }

  private static MerchantPaymentMethod method(String country, String currency, PaymentProvider provider,
      @Nullable String image, boolean enabled) {
    return new MerchantPaymentMethod(UUID.randomUUID(), TenantId.of("tenant-a"), null, "Bank QR", country, currency,
        provider, "Bank", "Account display only", image, enabled, Instant.EPOCH, Instant.EPOCH,
        UUID.randomUUID(), UUID.randomUUID());
  }
}
