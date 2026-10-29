package com.mapit.payments.infrastructure;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Clock;
import java.util.Arrays;

import org.springframework.core.env.Environment;

/** Opt-in estricto: un perfil productivo adicional también deshabilita el simulador. */
public final class MockPaymentSettings {
  private final boolean allowed;
  private final MockWebhookAuthenticator authenticator;

  public MockPaymentSettings(Environment environment, Clock clock) {
    String[] profiles = environment.getActiveProfiles();
    allowed = environment.getProperty("mapit.payments.mock.enabled", Boolean.class, false)
        && profiles.length > 0 && Arrays.stream(profiles).allMatch(p -> p.equals("dev") || p.equals("test"));
    byte[] key = new byte[32];
    if (allowed) {
      String configured = environment.getProperty("mapit.payments.mock.webhook-secret");
      if (configured != null && !configured.isBlank()) key = configured.getBytes(StandardCharsets.UTF_8);
      else new SecureRandom().nextBytes(key);
    }
    authenticator = new MockWebhookAuthenticator(key, clock);
    Arrays.fill(key, (byte) 0);
  }

  public boolean allowed() { return allowed; }
  public MockWebhookAuthenticator authenticator() { requireAllowed(); return authenticator; }
  public void requireAllowed() { if (!allowed) throw new Disabled(); }

  public static class Disabled extends RuntimeException {
    public Disabled() { super("Simulador no disponible"); }
  }
}
