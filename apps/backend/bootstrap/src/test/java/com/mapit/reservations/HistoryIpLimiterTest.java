package com.mapit.reservations;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;

import com.mapit.reservations.application.history.CustomerHistoryPolicy;
import com.mapit.reservations.application.history.HistoryIpLimiter;

class HistoryIpLimiterTest {
  @Test
  void limitePorOrigenNoDependeDeCorreoNiTenant() {
    var limiter = new HistoryIpLimiter(new CustomerHistoryPolicy(15, 30, 15, 3, 10),
        Clock.fixed(Instant.parse("2026-10-25T12:00:00Z"), ZoneOffset.UTC));
    for (int i = 0; i < 10; i++) assertThat(limiter.allow("127.0.0.1")).isTrue();
    assertThat(limiter.allow("127.0.0.1")).isFalse();
    assertThat(limiter.allow("127.0.0.2")).isTrue();
  }
}
