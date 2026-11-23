package com.mapit.config;

import java.util.Arrays;
import java.util.List;

import org.flywaydb.core.api.FlywayException;
import org.flywaydb.core.api.MigrationState;
import org.flywaydb.core.api.MigrationVersion;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Exige la dependencia de MAP-285 antes de ejecutar cualquier migración de notificaciones. */
@Configuration(proxyBeanMethods = false)
class NotificationMigrationDependency {
  @Bean
  FlywayMigrationStrategy notificationMigrationOrder() {
    return flyway -> {
      if (flyway.getConfiguration().isOutOfOrder()) {
        throw new FlywayException("MAP-286 requiere V40-V43 en orden, sin outOfOrder.");
      }
      var migrations = flyway.info().all();
      boolean pending = false;
      for (String version : List.of("40", "41", "42", "43")) {
        var migration =
            Arrays.stream(migrations)
                .filter(info -> MigrationVersion.fromVersion(version).equals(info.getVersion()))
                .findFirst()
                .orElseThrow(
                    () -> new FlywayException("MAP-286 requiere integrar V40 de MAP-285 y V41-V43."));
        var state = migration.getState();
        if (version.equals("40")
            && !"V40__agregar_contacto_e_idioma_al_perfil_personal.sql".equals(migration.getScript())) {
          throw new FlywayException("V40 debe corresponder a la dependencia MAP-285.");
        }
        if (state != MigrationState.PENDING && state != MigrationState.SUCCESS) {
          throw new FlywayException("MAP-286 requiere V40-V43 resueltas y en orden.");
        }
        if (state == MigrationState.PENDING) {
          pending = true;
        } else if (pending) {
          throw new FlywayException("MAP-286 no puede preceder a V40 de MAP-285.");
        }
      }
      flyway.migrate();
    };
  }
}
