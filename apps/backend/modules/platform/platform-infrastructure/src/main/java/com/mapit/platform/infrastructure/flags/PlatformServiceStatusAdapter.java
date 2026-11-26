package com.mapit.platform.infrastructure.flags;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import com.mapit.platform.domain.PlatformServiceStatus;

/** Comprueba base de datos y proveedor de flags sin devolver URLs ni credenciales. */
@Component
class PlatformServiceStatusAdapter implements PlatformServiceStatus {

  private final JdbcTemplate jdbc;
  private final ObjectProvider<MyAccountFlagAvailability> availability;
  private final boolean unleashEnabled;

  PlatformServiceStatusAdapter(
      JdbcTemplate jdbc,
      ObjectProvider<MyAccountFlagAvailability> availability,
      @Value("${mapit.unleash.enabled:true}") boolean unleashEnabled) {
    this.jdbc = jdbc;
    this.availability = availability;
    this.unleashEnabled = unleashEnabled;
  }

  @Override
  public boolean databaseAvailable() {
    try {
      jdbc.queryForObject("select 1", Integer.class);
      return true;
    } catch (DataAccessException unavailable) {
      return false;
    }
  }

  @Override
  public FlagProvider flagProvider() {
    if (!unleashEnabled) {
      return FlagProvider.DISABLED;
    }
    MyAccountFlagAvailability observed = availability.getIfAvailable();
    return observed != null && observed.isFresh() ? FlagProvider.AVAILABLE : FlagProvider.UNAVAILABLE;
  }
}
