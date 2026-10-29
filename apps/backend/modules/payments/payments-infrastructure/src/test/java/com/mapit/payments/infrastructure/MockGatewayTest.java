package com.mapit.payments.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.mapit.payments.application.PaymentService.VerifiedEvent;
import com.mapit.payments.domain.Money;
import com.mapit.payments.domain.Payment;
import com.mapit.payments.domain.PaymentProvider;
import com.mapit.shared.tenant.TenantId;

import tools.jackson.databind.json.JsonMapper;

class MockGatewayTest {
  private static final Instant NOW = Instant.parse("2026-10-24T12:00:00Z");
  private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

  @Test
  void rechaza_mock_fuera_de_entornos_explicitamente_permitidos() {
    assertThatThrownBy(() -> new MockPaymentGateway(true, Set.of("prod"), CLOCK)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> new MockPaymentGateway(true, Set.of("test", "prod"), CLOCK)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> new MockPaymentGateway(false, Set.of("dev"), CLOCK)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> new MockPaymentGateway(true, Set.of(), CLOCK)).isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void simula_sesion_y_resultados_repetidos_fuera_de_orden() {
    MockPaymentGateway mock = new MockPaymentGateway(true, Set.of("test"), CLOCK);
    var session = mock.createSession(UUID.randomUUID(), new Money(BigDecimal.TEN, "BOB"), NOW.plusSeconds(60));
    assertThat(mock.query(session.reference())).isEmpty();
    mock.simulate(session.reference(), Payment.Outcome.CONFIRMED);
    mock.simulate(session.reference(), Payment.Outcome.CONFIRMED);
    assertThat(mock.query(session.reference())).contains(Payment.Outcome.CONFIRMED);
    mock.simulate(session.reference(), Payment.Outcome.EXPIRED);
    assertThat(mock.query(session.reference())).contains(Payment.Outcome.EXPIRED);
    assertThat(mock.capabilities().dynamicQr()).isFalse();
  }

  @Test
  void firma_bytes_exactos_timestamp_y_no_acepta_manipulacion_ni_replay_vencido() {
    var auth = new MockWebhookAuthenticator(new byte[32], CLOCK);
    byte[] body = "{\"tenantId\":\"tenant-a\"}".getBytes(StandardCharsets.UTF_8);
    long timestamp = NOW.getEpochSecond();
    String signature = auth.sign(timestamp, body);
    auth.verify(timestamp, body, signature);
    assertThatThrownBy(() -> auth.verify(timestamp, "{}".getBytes(StandardCharsets.UTF_8), signature)).isInstanceOf(SecurityException.class);
    assertThatThrownBy(() -> auth.verify(timestamp + 1, body, signature)).isInstanceOf(SecurityException.class);
    assertThatThrownBy(() -> auth.verify(timestamp - 301, body, auth.sign(timestamp - 301, body))).isInstanceOf(SecurityException.class);
    assertThatThrownBy(() -> auth.verify(timestamp, body, "invalid")).isInstanceOf(SecurityException.class);
    assertThatThrownBy(() -> new MockWebhookAuthenticator(new byte[8], CLOCK)).isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void notificacion_mock_autentica_el_tenant_y_el_monto_antes_de_deserializar() {
    var auth = new MockWebhookAuthenticator(new byte[32], CLOCK);
    var codec = new MockWebhookCodec(auth, JsonMapper.builder().build(), CLOCK);
    var expected = new VerifiedEvent(TenantId.of("tenant-a"), UUID.randomUUID(), PaymentProvider.MOCK_GATEWAY,
        "event-1", "external", "merchant", new Money(new BigDecimal("12.30"), "BOB"), Payment.Outcome.CONFIRMED);
    var notification = codec.encodeForSimulation(expected);
    assertThat(codec.decode(notification)).isEqualTo(expected);
    byte[] leaked = notification.body();
    leaked[0] = 0;
    assertThat(codec.decode(notification)).isEqualTo(expected);
    var tampered = new MockWebhookCodec.Notification(notification.timestamp(), notification.signature(),
        "{\"tenantId\":\"tenant-b\"}".getBytes(StandardCharsets.UTF_8));
    assertThatThrownBy(() -> codec.decode(tampered)).isInstanceOf(SecurityException.class);
    var malformed = new MockWebhookCodec.Notification(notification.timestamp(), "0".repeat(64), new byte[] {0});
    assertThatThrownBy(() -> codec.decode(malformed)).isInstanceOf(SecurityException.class);
  }
}
