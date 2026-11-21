package com.mapit.identity.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.identity.domain.AuthenticatedPrincipal;
import com.mapit.identity.domain.OwnPasswordRateLimited;
import com.mapit.identity.domain.UserRole;
import com.mapit.shared.tenant.TenantId;

class OwnPasswordAttemptLimiterTest {
  private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
  private final Map<String, Integer> counts = new HashMap<>();
  private final Map<String, Integer> windows = new HashMap<>();
  private final AuthAttemptLimiter limiter = new AuthAttemptLimiter(jdbc, "test-limiter-secret");
  private final AuthenticatedPrincipal actor = actor("tenant-a", UUID.randomUUID());

  OwnPasswordAttemptLimiterTest() {
    when(jdbc.queryForObject(anyString(), eq(Integer.class), any(), any(), any())).thenAnswer(call -> {
      String key = call.getArgument(2);
      assertThat(key).matches("[0-9a-f]{64}");
      windows.put(key, call.getArgument(3));
      return counts.merge(key, 1, Integer::sum);
    });
  }

  @Test
  void blocksSixthAccountAttemptEvenAcrossAddressesWithoutSpendingLoginBuckets() {
    for (int i = 0; i < 5; i++) limiter.checkPasswordChange(actor, "address-" + i);
    assertThatThrownBy(() -> limiter.checkPasswordChange(actor, "other-address")).isInstanceOfSatisfying(OwnPasswordRateLimited.class,
        limited -> assertThat(limited.retryAfterSeconds()).isEqualTo(900));
    assertThat(windows.values()).containsOnly(900);
    for (int i = 0; i < 20; i++) limiter.check("address-0", actor.email());
    assertThatThrownBy(() -> limiter.check("address-0", actor.email())).isInstanceOf(AuthRateLimited.class);
    assertThat(windows.values()).contains(60, 900);
  }

  @Test
  void keepsAccountsAndTenantsSeparateButLimitsAnAddressAcrossAccounts() {
    limiter.checkPasswordChange(actor, "one-address");
    limiter.checkPasswordChange(actor("tenant-b", actor.id()), "one-address");
    for (int i = 0; i < 18; i++) limiter.checkPasswordChange(actor("tenant-a", UUID.randomUUID()), "one-address");
    assertThatThrownBy(() -> limiter.checkPasswordChange(actor("tenant-c", UUID.randomUUID()), "one-address"))
        .isInstanceOf(OwnPasswordRateLimited.class);
  }

  @Test
  void declaresIndependentTransactionForTheFutureCaller() throws Exception {
    var tx = AuthAttemptLimiter.class.getMethod("checkPasswordChange", AuthenticatedPrincipal.class, String.class)
        .getAnnotation(Transactional.class);
    assertThat(tx.propagation()).isEqualTo(Propagation.REQUIRES_NEW);
    assertThat(tx.noRollbackFor()).contains(OwnPasswordRateLimited.class);
  }

  private static AuthenticatedPrincipal actor(String tenant, UUID id) {
    return new AuthenticatedPrincipal(id, TenantId.of(tenant), "test@example.com", UserRole.ADMIN);
  }
}
