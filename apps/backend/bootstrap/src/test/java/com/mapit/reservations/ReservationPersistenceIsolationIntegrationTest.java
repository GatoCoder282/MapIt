package com.mapit.reservations;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagPort;

/** Verifica migración, integridad y RLS de MAP-209 con PostgreSQL real. */
@Tag("integration")
@SpringBootTest
@Testcontainers
@Import(ReservationPersistenceIsolationIntegrationTest.TestFlags.class)
class ReservationPersistenceIsolationIntegrationTest {

  @Container
  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16-alpine")
          .withDatabaseName("mapit")
          .withUsername("mapit")
          .withPassword("test_password");

  private static final String TENANT_A = "reservation-iso-a";
  private static final String TENANT_B = "reservation-iso-b";
  private static final UUID USER_A = uuid("10000000-0000-0000-0000-000000000001");
  private static final UUID USER_B = uuid("20000000-0000-0000-0000-000000000001");
  private static final UUID ESTABLISHMENT_A = uuid("10000000-0000-0000-0000-000000000002");
  private static final UUID ESTABLISHMENT_B = uuid("20000000-0000-0000-0000-000000000002");
  private static final UUID FLOOR_A = uuid("10000000-0000-0000-0000-000000000003");
  private static final UUID FLOOR_B = uuid("20000000-0000-0000-0000-000000000003");
  private static final UUID SECTOR_A = uuid("10000000-0000-0000-0000-000000000004");
  private static final UUID SECTOR_B = uuid("20000000-0000-0000-0000-000000000004");
  private static final UUID ELEMENT_A = uuid("10000000-0000-0000-0000-000000000005");
  private static final UUID ELEMENT_B = uuid("20000000-0000-0000-0000-000000000005");
  private static final UUID PERSON_A = uuid("10000000-0000-0000-0000-000000000006");
  private static final UUID PERSON_B = uuid("20000000-0000-0000-0000-000000000006");
  private static final UUID RESERVATION_A = uuid("10000000-0000-0000-0000-000000000007");
  private static final UUID RESERVATION_B = uuid("20000000-0000-0000-0000-000000000007");

  @Autowired private JdbcTemplate jdbc;
  @Autowired private TransactionTemplate transactions;

  @DynamicPropertySource
  static void databaseProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.flyway.url", POSTGRES::getJdbcUrl);
    registry.add("spring.flyway.user", POSTGRES::getUsername);
    registry.add("spring.flyway.password", POSTGRES::getPassword);
    registry.add("spring.flyway.placeholders.mapitAppDbPassword", () -> "test_app_password");
    registry.add("mapit.unleash.enabled", () -> "false");
    registry.add("mapit.realtime.outbox.poll-interval-ms", () -> "3600000");
    registry.add("mapit.realtime.outbox.cleanup-interval-ms", () -> "3600000");
  }

  @BeforeEach
  void prepareData() {
    jdbc.execute(
        "do $$ begin "
            + "if not exists (select from pg_roles where rolname = 'mapit_rls_test') then "
            + "create role mapit_rls_test nologin nosuperuser nobypassrls; "
            + "end if; end $$");
    jdbc.execute("grant usage on schema public to mapit_rls_test");
    jdbc.execute(
        "grant select on person, reservation, reservation_space_element to mapit_rls_test");

    deleteFixtures();
    tenant(TENANT_A, "Reserva A");
    tenant(TENANT_B, "Reserva B");
    user(USER_A, TENANT_A, "staff-a@reservation.test");
    user(USER_B, TENANT_B, "staff-b@reservation.test");
    establishment(ESTABLISHMENT_A, TENANT_A, "Local A", "reservation-local-a");
    establishment(ESTABLISHMENT_B, TENANT_B, "Local B", "reservation-local-b");
    floor(FLOOR_A, TENANT_A, ESTABLISHMENT_A, "Piso A", "reservation-floor-a");
    floor(FLOOR_B, TENANT_B, ESTABLISHMENT_B, "Piso B", "reservation-floor-b");
    sector(SECTOR_A, TENANT_A, FLOOR_A, "Sector A", "reservation-sector-a");
    sector(SECTOR_B, TENANT_B, FLOOR_B, "Sector B", "reservation-sector-b");
    element(ELEMENT_A, TENANT_A, SECTOR_A);
    element(ELEMENT_B, TENANT_B, SECTOR_B);
    person(PERSON_A, TENANT_A, USER_A, "Cliente A", "cliente-a@reservation.test");
    person(PERSON_B, TENANT_B, USER_B, "Cliente B", "cliente-b@reservation.test");
    reservation(RESERVATION_A, TENANT_A, ESTABLISHMENT_A, PERSON_A, USER_A);
    reservation(RESERVATION_B, TENANT_B, ESTABLISHMENT_B, PERSON_B, USER_B);
    reservationElement(TENANT_A, RESERVATION_A, ELEMENT_A);
    reservationElement(TENANT_B, RESERVATION_B, ELEMENT_B);
  }

  @Test
  void eachTenantOnlySeesItsPeopleReservationsAndAssignments() {
    inTenant(
        TENANT_A,
        () -> {
          assertThat(count("person")).isEqualTo(1);
          assertThat(count("reservation")).isEqualTo(1);
          assertThat(count("reservation_space_element")).isEqualTo(1);
          assertThat(
                  jdbc.queryForObject(
                      "select count(*) from reservation where id = ?", Long.class, RESERVATION_B))
              .isZero();
        });

    inTenant(
        TENANT_B,
        () -> {
          assertThat(count("person")).isEqualTo(1);
          assertThat(count("reservation")).isEqualTo(1);
          assertThat(count("reservation_space_element")).isEqualTo(1);
        });
  }

  @Test
  void withoutTenantAllNewTablesFailClosed() {
    withoutTenant(
        () -> {
          assertThat(count("person")).isZero();
          assertThat(count("reservation")).isZero();
          assertThat(count("reservation_space_element")).isZero();
        });
  }

  @Test
  void reservationCannotReferencePersonFromAnotherTenant() {
    assertThatExceptionOfType(DataIntegrityViolationException.class)
        .isThrownBy(
            () -> reservation(UUID.randomUUID(), TENANT_A, ESTABLISHMENT_A, PERSON_B, USER_A));
  }

  @Test
  void assignmentCannotReferenceElementFromAnotherTenant() {
    assertThatExceptionOfType(DataIntegrityViolationException.class)
        .isThrownBy(() -> reservationElement(TENANT_A, RESERVATION_A, ELEMENT_B));
  }

  @Test
  void databaseRejectsAnInvalidIntervalAndDuplicateElement() {
    assertThatExceptionOfType(DataIntegrityViolationException.class)
        .isThrownBy(
            () ->
                jdbc.update(
                    "insert into reservation "
                        + "(tenant_id, establishment_id, person_id, starts_at, ends_at, created_by) "
                        + "values (?, ?, ?, ?, ?, ?)",
                    TENANT_A,
                    ESTABLISHMENT_A,
                    PERSON_A,
                    Timestamp.from(Instant.parse("2026-10-04T12:00:00Z")),
                    Timestamp.from(Instant.parse("2026-10-04T11:00:00Z")),
                    USER_A));

    assertThatExceptionOfType(DataIntegrityViolationException.class)
        .isThrownBy(() -> reservationElement(TENANT_A, RESERVATION_A, ELEMENT_A));
  }

  private void deleteFixtures() {
    jdbc.update(
        "delete from reservation_space_element where tenant_id in (?, ?)", TENANT_A, TENANT_B);
    jdbc.update("delete from reservation where tenant_id in (?, ?)", TENANT_A, TENANT_B);
    jdbc.update("delete from person where tenant_id in (?, ?)", TENANT_A, TENANT_B);
    jdbc.update("delete from space_element where tenant_id in (?, ?)", TENANT_A, TENANT_B);
    jdbc.update("delete from sector where tenant_id in (?, ?)", TENANT_A, TENANT_B);
    jdbc.update("delete from floor where tenant_id in (?, ?)", TENANT_A, TENANT_B);
    jdbc.update("delete from establishment where tenant_id in (?, ?)", TENANT_A, TENANT_B);
    jdbc.update("delete from app_user where tenant_id in (?, ?)", TENANT_A, TENANT_B);
    jdbc.update("delete from tenant where id in (?, ?)", TENANT_A, TENANT_B);
  }

  private void inTenant(String tenantId, Runnable assertions) {
    transactions.executeWithoutResult(
        status -> {
          jdbc.execute("set local role mapit_rls_test");
          jdbc.queryForObject(
              "select set_config('app.tenant_id', ?, true)", String.class, tenantId);
          assertions.run();
        });
  }

  private void withoutTenant(Runnable assertions) {
    transactions.executeWithoutResult(
        status -> {
          jdbc.execute("set local role mapit_rls_test");
          assertions.run();
        });
  }

  private long count(String table) {
    Long count = jdbc.queryForObject("select count(*) from " + table, Long.class);
    return count == null ? 0 : count;
  }

  private void tenant(String id, String name) {
    jdbc.update(
        "insert into tenant (id, name, slug, status, vertical) "
            + "values (?, ?, ?, 'ACTIVE', 'RESTAURANT')",
        id,
        name,
        id);
  }

  private void user(UUID id, String tenantId, String email) {
    jdbc.update(
        "insert into app_user (id, tenant_id, email, password_hash, full_name, role) "
            + "values (?, ?, ?, 'unused', 'Reservation Staff', 'STAFF')",
        id,
        tenantId,
        email);
  }

  private void establishment(UUID id, String tenantId, String name, String slug) {
    jdbc.update(
        "insert into establishment (id, tenant_id, name, type, slug) "
            + "values (?, ?, ?, 'RESTAURANT', ?)",
        id,
        tenantId,
        name,
        slug);
  }

  private void floor(UUID id, String tenantId, UUID establishmentId, String name, String slug) {
    jdbc.update(
        "insert into floor (id, tenant_id, establishment_id, name, level, slug) "
            + "values (?, ?, ?, ?, 1, ?)",
        id,
        tenantId,
        establishmentId,
        name,
        slug);
  }

  private void sector(UUID id, String tenantId, UUID floorId, String name, String slug) {
    jdbc.update(
        "insert into sector (id, tenant_id, floor_id, name, slug, max_capacity) "
            + "values (?, ?, ?, ?, ?, 100)",
        id,
        tenantId,
        floorId,
        name,
        slug);
  }

  private void element(UUID id, String tenantId, UUID sectorId) {
    jdbc.update(
        "insert into space_element (id, tenant_id, sector_id, type, state, x, y) "
            + "values (?, ?, ?, 'TABLE', 'AVAILABLE', 1, 1)",
        id,
        tenantId,
        sectorId);
  }

  private void person(UUID id, String tenantId, UUID actor, String name, String email) {
    jdbc.update(
        "insert into person (id, tenant_id, full_name, email, created_by) "
            + "values (?, ?, ?, ?, ?)",
        id,
        tenantId,
        name,
        email,
        actor);
  }

  private void reservation(
      UUID id, String tenantId, UUID establishmentId, UUID personId, UUID actor) {
    jdbc.update(
        "insert into reservation "
            + "(id, tenant_id, establishment_id, person_id, starts_at, ends_at, created_by) "
            + "values (?, ?, ?, ?, ?, ?, ?)",
        id,
        tenantId,
        establishmentId,
        personId,
        Timestamp.from(Instant.parse("2026-10-04T10:00:00Z")),
        Timestamp.from(Instant.parse("2026-10-04T12:00:00Z")),
        actor);
  }

  private void reservationElement(String tenantId, UUID reservationId, UUID elementId) {
    jdbc.update(
        "insert into reservation_space_element (tenant_id, reservation_id, space_element_id) "
            + "values (?, ?, ?)",
        tenantId,
        reservationId,
        elementId);
  }

  private static UUID uuid(String value) {
    return UUID.fromString(value);
  }

  @TestConfiguration
  static class TestFlags {

    @Bean
    @Primary
    FeatureFlagPort featureFlags() {
      return new FeatureFlagPort() {
        @Override
        public boolean isEnabled(FeatureFlag flag) {
          return false;
        }

        @Override
        public boolean isEnabled(FeatureFlag flag, boolean defaultValue) {
          return defaultValue;
        }
      };
    }
  }
}
