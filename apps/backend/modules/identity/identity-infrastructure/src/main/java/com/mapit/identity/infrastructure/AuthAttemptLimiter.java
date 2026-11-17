package com.mapit.identity.infrastructure;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Objects;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Shared PostgreSQL buckets for requests that reach the password verifier. */
@Component
public class AuthAttemptLimiter {
  private static final int WINDOW_SECONDS = 60;
  private static final int ATTEMPTS_PER_ADDRESS = 120;
  private static final int ATTEMPTS_PER_ACCOUNT_AND_ADDRESS = 20;

  private static final String COUNT = """
      insert into auth_attempt_limit (tenant_id, id, expires_at, attempts)
      values ('platform', ?, now() + make_interval(secs => ?), 1)
      on conflict (tenant_id, id) do update set
        expires_at = case when auth_attempt_limit.expires_at <= now()
                          then excluded.expires_at else auth_attempt_limit.expires_at end,
        attempts = case when auth_attempt_limit.expires_at <= now()
                        then 1 else least(auth_attempt_limit.attempts + 1, ?) end
      returning attempts
      """;

  private final JdbcTemplate jdbc;
  private final SecretKeySpec key;

  AuthAttemptLimiter(JdbcTemplate jdbc, @Value("${mapit.jwt.secret}") String secret) {
    this.jdbc = jdbc;
    this.key = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
  }

  @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = AuthRateLimited.class)
  public void check(String remoteAddress, String email) {
    enterScope();
    // El cliente no puede reiniciar su límite mediante un encabezado reenviado.
    requireBudget("login:ip:" + remoteAddress, WINDOW_SECONDS, ATTEMPTS_PER_ADDRESS);
    String account = email.strip().toLowerCase(Locale.ROOT);
    requireBudget("login:ip-email:" + remoteAddress + ":" + account,
        WINDOW_SECONDS, ATTEMPTS_PER_ACCOUNT_AND_ADDRESS);
  }

  @Scheduled(fixedDelay = 600_000)
  @Transactional
  public void prune() {
    enterScope();
    jdbc.update("delete from auth_attempt_limit where tenant_id = 'platform' and expires_at <= now()");
  }

  private void enterScope() {
    jdbc.queryForObject("select set_config('app.tenant_id', 'platform', true)", String.class);
  }

  private void requireBudget(String bucket, int seconds, int limit) {
    int count = Objects.requireNonNull(
        jdbc.queryForObject(COUNT, Integer.class, fingerprint(bucket), seconds, limit + 1));
    if (count > limit) {
      throw new AuthRateLimited(seconds);
    }
  }

  private String fingerprint(String bucket) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(key);
      return HexFormat.of().formatHex(
          mac.doFinal(("mapit:auth-attempt:v1:" + bucket).getBytes(StandardCharsets.UTF_8)));
    } catch (GeneralSecurityException exception) {
      throw new IllegalStateException("HMAC de autenticación no disponible", exception);
    }
  }
}
