package com.mapit.payments.domain.receipt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.mapit.shared.tenant.TenantId;

class ReceiptCredentialTest {

  private static final TenantId TENANT = TenantId.of("tenant-a");
  private static final UUID RESERVATION = UUID.fromString("a0000000-0000-0000-0000-000000000001");
  private static final Instant ISSUED = Instant.parse("2026-10-24T12:00:00Z");
  private static final Instant EXPIRES = ISSUED.plusSeconds(3600);
  private final ReceiptToken token = ReceiptToken.generate();

  private ReceiptCredential credential() {
    return new ReceiptCredential(TENANT, RESERVATION, token.hash(), ISSUED, EXPIRES, null);
  }

  @Test
  void valida_tenant_reserva_token_y_ventana_semiabierta() {
    ReceiptCredential credential = credential();
    assertThat(credential.accepts(TENANT, RESERVATION, token.presentationValue(), ISSUED)).isTrue();
    assertThat(credential.accepts(TENANT, RESERVATION, token.presentationValue(), EXPIRES.minusNanos(1)))
        .isTrue();
    assertThat(credential.accepts(TENANT, RESERVATION, token.presentationValue(), EXPIRES)).isFalse();
    assertThat(credential.accepts(TENANT, RESERVATION, token.presentationValue(), ISSUED.minusNanos(1)))
        .isFalse();
  }

  @Test
  void no_acepta_credencial_desde_otro_tenant_ni_para_otra_reserva() {
    ReceiptCredential credential = credential();
    assertThat(credential.accepts(TenantId.of("tenant-b"), RESERVATION, token.presentationValue(), ISSUED))
        .isFalse();
    assertThat(credential.accepts(TENANT, UUID.randomUUID(), token.presentationValue(), ISSUED)).isFalse();
    assertThat(credential.accepts(TENANT, RESERVATION, RESERVATION.toString(), ISSUED)).isFalse();
  }

  @Test
  void revocar_invalida_inmediatamente_y_preserva_la_primera_revocacion() {
    Instant revokedAt = ISSUED.plusSeconds(60);
    ReceiptCredential revoked = credential().revoke(revokedAt);
    assertThat(revoked.accepts(TENANT, RESERVATION, token.presentationValue(), revokedAt)).isFalse();
    assertThat(revoked.revoke(revokedAt.plusSeconds(60))).isSameAs(revoked);
    assertThat(revoked.revokedAt()).isEqualTo(revokedAt);
    assertThat(revoked.tokenHash()).isEqualTo(token.hash());
  }

  @Test
  void exige_expiracion_posterior_y_revocacion_no_anterior_a_emision() {
    assertThatThrownBy(() -> new ReceiptCredential(TENANT, RESERVATION, token.hash(), ISSUED, ISSUED, null))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> credential().revoke(ISSUED.minusSeconds(1)))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> new ReceiptCredential(TENANT, RESERVATION, "bad", ISSUED, EXPIRES, null))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
