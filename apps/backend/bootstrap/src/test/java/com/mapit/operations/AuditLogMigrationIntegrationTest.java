package com.mapit.operations;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** MAP-226: conservación del histórico de HU-3.01 al migrar a la bitácora general. */
@Tag("integration")
@Testcontainers
class AuditLogMigrationIntegrationTest {

  private static final String TENANT = "audit-migration";
  private static final UUID ACTOR =
      UUID.fromString("22600000-0000-0000-0000-000000000001");
  private static final UUID ESTABLISHMENT =
      UUID.fromString("22600000-0000-0000-0000-000000000011");
  private static final UUID FLOOR =
      UUID.fromString("22600000-0000-0000-0000-000000000021");
  private static final UUID SECTOR =
      UUID.fromString("22600000-0000-0000-0000-000000000031");
  private static final UUID ELEMENT =
      UUID.fromString("22600000-0000-0000-0000-000000000041");
  private static final UUID HISTORICAL_EVENT =
      UUID.fromString("22600000-0000-0000-0000-000000000051");
  private static final Instant CHANGED_AT = Instant.parse("2026-09-24T17:00:00Z");

  @Container
  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16-alpine")
          .withDatabaseName("mapit")
          .withUsername("mapit")
          .withPassword("test_password");

  @Test
  void migracion_conserva_identidad_actor_instante_recurso_y_transicion_sin_duplicar() {
    flyway(MigrationVersion.fromVersion("18")).migrate();
    JdbcTemplate jdbc = jdbc();
    historicalFixture(jdbc);

    flyway(null).migrate();

    MigratedAudit migrated =
        jdbc.queryForObject(
            """
            select id, tenant_id, actor_id, occurred_at, resource_type, resource_id, event_type,
                   details ->> 'previousState' as previous_state,
                   details ->> 'newState' as new_state,
                   details ->> 'sectorId' as sector_id
            from audit_log
            where id = ?
            """,
            (result, rowNumber) ->
                new MigratedAudit(
                    result.getObject("id", UUID.class),
                    result.getString("tenant_id"),
                    result.getObject("actor_id", UUID.class),
                    result.getTimestamp("occurred_at").toInstant(),
                    result.getString("resource_type"),
                    result.getObject("resource_id", UUID.class),
                    result.getString("event_type"),
                    result.getString("previous_state"),
                    result.getString("new_state"),
                    result.getString("sector_id")),
            HISTORICAL_EVENT);

    assertThat(migrated)
        .isEqualTo(
            new MigratedAudit(
                HISTORICAL_EVENT,
                TENANT,
                ACTOR,
                CHANGED_AT,
                "SPACE_ELEMENT",
                ELEMENT,
                "SPACE_ELEMENT_STATE_CHANGED",
                "AVAILABLE",
                "RESERVED",
                SECTOR.toString()));
    assertThat(
            jdbc.queryForObject(
                "select count(*) from audit_log where id = ?", Long.class, HISTORICAL_EVENT))
        .isEqualTo(1L);
    assertThat(
            jdbc.queryForObject(
                "select to_regclass('public.space_element_state_change')", String.class))
        .isNull();
  }

  private Flyway flyway(MigrationVersion target) {
    var configuration =
        Flyway.configure()
            .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
            .locations("classpath:db/migration")
            .placeholders(Map.of("mapitAppDbPassword", "migration_test_password"));
    if (target != null) {
      configuration.target(target);
    }
    return configuration.load();
  }

  private JdbcTemplate jdbc() {
    return new JdbcTemplate(
        new DriverManagerDataSource(
            POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()));
  }

  private void historicalFixture(JdbcTemplate jdbc) {
    jdbc.update(
        "insert into tenant (id, name, slug, status, vertical) values (?, 'Migración', ?, 'ACTIVE', 'RESTAURANT')",
        TENANT,
        TENANT);
    jdbc.update(
        "insert into app_user (id, tenant_id, email, password_hash, full_name, role) values (?, ?, 'migration@audit.test', 'unused', 'Migration Tester', 'ADMIN')",
        ACTOR,
        TENANT);
    jdbc.update(
        "insert into establishment (id, tenant_id, name, type, slug) values (?, ?, 'Local', 'RESTAURANT', 'audit-migration-local')",
        ESTABLISHMENT,
        TENANT);
    jdbc.update(
        "insert into floor (id, tenant_id, establishment_id, name, level, slug) values (?, ?, ?, 'Piso', 1, 'audit-migration-floor')",
        FLOOR,
        TENANT,
        ESTABLISHMENT);
    jdbc.update(
        "insert into sector (id, tenant_id, floor_id, name, slug, max_capacity) values (?, ?, ?, 'Sector', 'audit-migration-sector', 20)",
        SECTOR,
        TENANT,
        FLOOR);
    jdbc.update(
        "insert into space_element (id, tenant_id, sector_id, type, state, x, y) values (?, ?, ?, 'TABLE', 'RESERVED', 1, 1)",
        ELEMENT,
        TENANT,
        SECTOR);
    jdbc.update(
        """
        insert into space_element_state_change
          (id, tenant_id, sector_id, space_element_id, previous_state, new_state, changed_by, changed_at)
        values (?, ?, ?, ?, 'AVAILABLE', 'RESERVED', ?, ?)
        """,
        HISTORICAL_EVENT,
        TENANT,
        SECTOR,
        ELEMENT,
        ACTOR,
        Timestamp.from(CHANGED_AT));
  }

  private record MigratedAudit(
      UUID id,
      String tenantId,
      UUID actorId,
      Instant occurredAt,
      String resourceType,
      UUID resourceId,
      String eventType,
      String previousState,
      String newState,
      String sectorId) {}
}
