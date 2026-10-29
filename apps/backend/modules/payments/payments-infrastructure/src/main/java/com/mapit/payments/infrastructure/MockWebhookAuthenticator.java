package com.mapit.payments.infrastructure;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Clock;
import java.util.HexFormat;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/** Autentica los bytes originales antes de deserializar tenant/referencias. Sin logs de contenido. */
public final class MockWebhookAuthenticator {
  private final byte[] key;
  private final Clock clock;

  public MockWebhookAuthenticator(byte[] key, Clock clock) {
    if (key.length < 32) throw new IllegalArgumentException("El secreto mock requiere al menos 256 bits");
    this.key = key.clone(); this.clock = clock;
  }

  public String sign(long timestamp, byte[] body) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(key, "HmacSHA256"));
      mac.update((timestamp + ".").getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(mac.doFinal(body));
    } catch (GeneralSecurityException e) {
      throw new IllegalStateException("HMAC no disponible", e);
    }
  }

  public void verify(long timestamp, byte[] body, String signature) {
    long now = clock.instant().getEpochSecond();
    if (body.length > 16384 || timestamp < now - 300 || timestamp > now + 30
        || signature == null || !signature.matches("[0-9a-f]{64}")) {
      throw new SecurityException("Webhook inválido o vencido");
    }
    byte[] expected = HexFormat.of().parseHex(sign(timestamp, body));
    if (!MessageDigest.isEqual(expected, HexFormat.of().parseHex(signature))) {
      throw new SecurityException("Firma de webhook inválida");
    }
  }
}
