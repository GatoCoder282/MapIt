package com.mapit.platform.infrastructure;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.HexFormat;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.platform.application.BusinessApplicationRateLimited;
import com.mapit.platform.domain.BusinessApplicationRateLimitPort;

/** Presupuestos compartidos entre instancias, sin guardar IP o correo en claro. */
@Component
class BusinessApplicationRateLimiter implements BusinessApplicationRateLimitPort {

  private static final int WINDOW_SECONDS = 3600;
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

  BusinessApplicationRateLimiter(JdbcTemplate jdbc, @Value("${mapit.jwt.secret}") String secret) {
    this.jdbc = jdbc;
    this.key = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
  }

  @Override
  @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = BusinessApplicationRateLimited.class)
  public void checkSubmission(String remoteAddress, String normalizedEmail) {
    enterPlatform();
    requireBudget("submit:ip:" + remoteAddress, 10);
    requireBudget("submit:ip-email:" + remoteAddress + ":" + normalizedEmail, 3);
  }

  @Override
  @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = BusinessApplicationRateLimited.class)
  public void checkVerification(String remoteAddress) {
    enterPlatform();
    requireBudget("verify:ip:" + remoteAddress, 30);
  }

  private void enterPlatform() {
    jdbc.queryForObject("select set_config('app.tenant_id', 'platform', true)", String.class);
  }

  private void requireBudget(String bucket, int limit) {
    Integer count = jdbc.queryForObject(COUNT, Integer.class, fingerprint(bucket), WINDOW_SECONDS, limit + 1);
    if (count == null || count > limit) {
      throw new BusinessApplicationRateLimited(WINDOW_SECONDS);
    }
  }

  private String fingerprint(String bucket) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(key);
      return HexFormat.of().formatHex(
          mac.doFinal(("mapit:business-application:v1:" + bucket).getBytes(StandardCharsets.UTF_8)));
    } catch (GeneralSecurityException exception) {
      throw new IllegalStateException("HMAC no disponible", exception);
    }
  }
}
