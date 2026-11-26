package com.mapit.config;

import java.util.Collection;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

import com.mapit.platform.domain.observability.ApiHealthProbe;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;

/**
 * HU-7.08: traduce las métricas HTTP del proceso a tres cifras agregadas, sin rutas, usuarios
 * ni detalle de errores.
 */
@Configuration
public class ObservabilityWiring {

  @Bean
  ApiHealthProbe apiHealthProbe(ObjectProvider<MeterRegistry> registries, JdbcTemplate jdbc) {
    return new ApiHealthProbe() {
      @Override
      public Optional<ApiHealth> read() {
        MeterRegistry registry = registries.getIfAvailable();
        if (registry == null) {
          return Optional.empty();
        }
        Collection<Timer> timers = registry.find("http.server.requests").timers();
        if (timers.isEmpty()) {
          return Optional.empty();
        }
        long requests = 0;
        long errors = 0;
        double millis = 0;
        for (Timer timer : timers) {
          requests += timer.count();
          millis += timer.totalTime(TimeUnit.MILLISECONDS);
          String status = timer.getId().getTag("status");
          if (status != null && status.startsWith("5")) {
            errors += timer.count();
          }
        }
        return Optional.of(new ApiHealth(requests, errors, requests == 0 ? 0 : millis / requests));
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
    };
  }
}
