package com.mapit.platform.infrastructure;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import com.mapit.platform.domain.PlatformApplicationScope;

/** SET LOCAL solo dura la transacción actual y no contamina el pool. */
@Component
class JdbcPlatformApplicationScope implements PlatformApplicationScope {

  private final JdbcTemplate jdbc;

  JdbcPlatformApplicationScope(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public void enter() {
    jdbc.queryForObject("select set_config('app.tenant_id', 'platform', true)", String.class);
  }
}
