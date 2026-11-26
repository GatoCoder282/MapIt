package com.mapit.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.util.Map;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.FlywayException;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Comprueba que la dependencia bloquea antes de escribir sobre una base PostgreSQL vacía. */
@Tag("integration")
@Testcontainers
class NotificationMigrationDependencyIntegrationTest {
  @Container
  static final PostgreSQLContainer<?> DB =
      new PostgreSQLContainer<>("postgres:17-alpine").withDatabaseName("dependency_it");

  @Test
  void refusesArtifactWithoutV40BeforeCreatingBusinessTables(@TempDir Path migrations) throws Exception {
    // Ubicación original sin el V40 temporal del classpath QA; no modifica migraciones.
    try (var files = Files.newDirectoryStream(Path.of("src/main/resources/db/migration"), "*.sql")) {
      for (Path file : files) {
        if (!file.getFileName().toString().startsWith("V40__")) {
          Files.copy(file, migrations.resolve(file.getFileName()));
        }
      }
    }
    var flyway =
        Flyway.configure()
            .dataSource(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword())
            .locations("filesystem:" + migrations)
            .placeholders(Map.of("mapitAppDbPassword", "test-runtime"))
            .load();
    assertThatThrownBy(() -> new NotificationMigrationDependency().notificationMigrationOrder().migrate(flyway))
        .isInstanceOf(FlywayException.class).hasMessageContaining("MAP-285");
    try (var connection = DriverManager.getConnection(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword());
        var statement = connection.createStatement();
        var rows = statement.executeQuery("select to_regclass('public.notification'), to_regclass('public.app_user')")) {
      assertThat(rows.next()).isTrue();
      assertThat(rows.getString(1)).isNull();
      assertThat(rows.getString(2)).isNull();
    }
  }
}
