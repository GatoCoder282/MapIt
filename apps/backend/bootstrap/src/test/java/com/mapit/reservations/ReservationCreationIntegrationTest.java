package com.mapit.reservations;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import javax.sql.DataSource;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.mapit.identity.domain.AccessTokenIssuer;
import com.mapit.identity.domain.AuthenticatedUser;
import com.mapit.identity.domain.UserRole;
import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagPort;
import com.mapit.shared.tenant.TenantId;

/** Flujo HTTP, seguridad, persistencia y aislamiento de HU-5.01 / MAP-215. */
@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@Import(ReservationCreationIntegrationTest.TestFlags.class)
class ReservationCreationIntegrationTest {

  @Container
  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16-alpine")
          .withDatabaseName("mapit")
          .withUsername("mapit")
          .withPassword("test_password");

  private static final String TENANT_A = "reservation-flow-a";
  private static final String TENANT_B = "reservation-flow-b";
  private static final UUID ADMIN_A = uuid("51000000-0000-0000-0000-000000000001");
  private static final UUID MANAGER_A = uuid("51000000-0000-0000-0000-000000000002");
  private static final UUID STAFF_A = uuid("51000000-0000-0000-0000-000000000003");
  private static final UUID STAFF_B = uuid("52000000-0000-0000-0000-000000000003");
  private static final UUID ESTABLISHMENT_A = uuid("51000000-0000-0000-0000-000000000011");
  private static final UUID ESTABLISHMENT_A_OTHER =
      uuid("51000000-0000-0000-0000-000000000012");
  private static final UUID ESTABLISHMENT_B = uuid("52000000-0000-0000-0000-000000000011");
  private static final UUID FLOOR_A = uuid("51000000-0000-0000-0000-000000000021");
  private static final UUID FLOOR_A_OTHER = uuid("51000000-0000-0000-0000-000000000022");
  private static final UUID FLOOR_B = uuid("52000000-0000-0000-0000-000000000021");
  private static final UUID SECTOR_A = uuid("51000000-0000-0000-0000-000000000031");
  private static final UUID SECTOR_A_OTHER = uuid("51000000-0000-0000-0000-000000000032");
  private static final UUID SECTOR_B = uuid("52000000-0000-0000-0000-000000000031");
  private static final UUID ELEMENT_A = uuid("51000000-0000-0000-0000-000000000041");
  private static final UUID ELEMENT_A_SECOND =
      uuid("51000000-0000-0000-0000-000000000042");
  private static final UUID ELEMENT_A_OTHER =
      uuid("51000000-0000-0000-0000-000000000043");
  private static final UUID ELEMENT_B = uuid("52000000-0000-0000-0000-000000000041");
  private static final UUID PERSON_A = uuid("51000000-0000-0000-0000-000000000051");
  private static final UUID PERSON_B = uuid("52000000-0000-0000-0000-000000000051");

  @LocalServerPort private int port;
  @Autowired private JdbcTemplate jdbc;
  @Autowired private DataSource dataSource;
  @Autowired private AccessTokenIssuer tokens;

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
  void fixtures() {
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

    tenant(TENANT_A, "Reservas A");
    tenant(TENANT_B, "Reservas B");
    user(ADMIN_A, TENANT_A, "admin@reservation-flow.test", UserRole.ADMIN);
    user(MANAGER_A, TENANT_A, "manager@reservation-flow.test", UserRole.MANAGER);
    user(STAFF_A, TENANT_A, "staff@reservation-flow.test", UserRole.STAFF);
    user(STAFF_B, TENANT_B, "staff-b@reservation-flow.test", UserRole.STAFF);
    establishment(ESTABLISHMENT_A, TENANT_A, "Local A", "reservation-flow-local-a");
    establishment(
        ESTABLISHMENT_A_OTHER, TENANT_A, "Local A secundario", "reservation-flow-local-a-2");
    establishment(ESTABLISHMENT_B, TENANT_B, "Local B", "reservation-flow-local-b");
    floor(FLOOR_A, TENANT_A, ESTABLISHMENT_A, "Piso A", "reservation-flow-floor-a");
    floor(
        FLOOR_A_OTHER,
        TENANT_A,
        ESTABLISHMENT_A_OTHER,
        "Piso A secundario",
        "reservation-flow-floor-a-2");
    floor(FLOOR_B, TENANT_B, ESTABLISHMENT_B, "Piso B", "reservation-flow-floor-b");
    sector(SECTOR_A, TENANT_A, FLOOR_A, "Sector A", "reservation-flow-sector-a");
    sector(
        SECTOR_A_OTHER,
        TENANT_A,
        FLOOR_A_OTHER,
        "Sector A secundario",
        "reservation-flow-sector-a-2");
    sector(SECTOR_B, TENANT_B, FLOOR_B, "Sector B", "reservation-flow-sector-b");
    element(ELEMENT_A, TENANT_A, SECTOR_A, "TABLE", "AVAILABLE");
    element(ELEMENT_A_SECOND, TENANT_A, SECTOR_A, "BAR", "AVAILABLE");
    element(ELEMENT_A_OTHER, TENANT_A, SECTOR_A_OTHER, "TABLE", "AVAILABLE");
    element(ELEMENT_B, TENANT_B, SECTOR_B, "TABLE", "AVAILABLE");
    person(PERSON_A, TENANT_A, STAFF_A, "Cliente A", "cliente-a@reservation-flow.test");
    person(PERSON_B, TENANT_B, STAFF_B, "Cliente B", "cliente-b@reservation-flow.test");
  }

  @Test
  void creationPersistsOneReservationWithAllAssociations() {
    ReservationView created =
        create(
                ESTABLISHMENT_A,
                PERSON_A,
                List.of(ELEMENT_A, ELEMENT_A_SECOND),
                "2026-10-10T14:00:00Z",
                "2026-10-10T16:00:00Z",
                token(ADMIN_A, TENANT_A, UserRole.ADMIN))
            .expectStatus()
            .isCreated()
            .expectBody(ReservationView.class)
            .returnResult()
            .getResponseBody();

    assertThat(created).isNotNull();
    assertThat(created.status()).isEqualTo("CREATED");
    assertThat(created.establishmentId()).isEqualTo(ESTABLISHMENT_A);
    assertThat(created.personId()).isEqualTo(PERSON_A);
    assertThat(created.spaceElementIds()).containsExactlyInAnyOrder(ELEMENT_A, ELEMENT_A_SECOND);
    assertThat(created.createdBy()).isEqualTo(ADMIN_A);
    assertThat(reservationCount(TENANT_A)).isEqualTo(1);
    assertThat(associationCount(TENANT_A)).isEqualTo(2);
  }

  @Test
  void adminManagerAndStaffCanCreateButAnonymousAndSuperAdminCannot() {
    List<UserAccess> allowed =
        List.of(
            new UserAccess(ADMIN_A, UserRole.ADMIN),
            new UserAccess(MANAGER_A, UserRole.MANAGER),
            new UserAccess(STAFF_A, UserRole.STAFF));
    for (int index = 0; index < allowed.size(); index++) {
      UserAccess access = allowed.get(index);
      create(
              ESTABLISHMENT_A,
              PERSON_A,
              List.of(ELEMENT_A),
              "2026-10-11T" + (10 + index * 2) + ":00:00Z",
              "2026-10-11T" + (11 + index * 2) + ":00:00Z",
              token(access.id(), TENANT_A, access.role()))
          .expectStatus()
          .isCreated();
    }

    create(
            ESTABLISHMENT_A,
            PERSON_A,
            List.of(ELEMENT_A),
            "2026-10-12T10:00:00Z",
            "2026-10-12T11:00:00Z",
            null)
        .expectStatus()
        .isUnauthorized();
    create(
            ESTABLISHMENT_A,
            PERSON_A,
            List.of(ELEMENT_A),
            "2026-10-12T12:00:00Z",
            "2026-10-12T13:00:00Z",
            token(UUID.randomUUID(), TENANT_A, UserRole.SUPER_ADMIN))
        .expectStatus()
        .isForbidden();

    assertThat(reservationCount(TENANT_A)).isEqualTo(3);
  }

  @Test
  void invalidIntervalEmptyAndDuplicateElementsReturn400WithoutWriting() {
    String staff = token(STAFF_A, TENANT_A, UserRole.STAFF);

    create(
            ESTABLISHMENT_A,
            PERSON_A,
            List.of(ELEMENT_A),
            "2026-10-13T12:00:00Z",
            "2026-10-13T11:00:00Z",
            staff)
        .expectStatus()
        .isBadRequest();
    create(
            ESTABLISHMENT_A,
            PERSON_A,
            List.of(),
            "2026-10-13T12:00:00Z",
            "2026-10-13T13:00:00Z",
            staff)
        .expectStatus()
        .isBadRequest();
    create(
            ESTABLISHMENT_A,
            PERSON_A,
            List.of(ELEMENT_A, ELEMENT_A),
            "2026-10-13T12:00:00Z",
            "2026-10-13T13:00:00Z",
            staff)
        .expectStatus()
        .isBadRequest();

    assertThat(reservationCount(TENANT_A)).isZero();
    assertThat(associationCount(TENANT_A)).isZero();
  }

  @Test
  void invalidOrForeignReferencesDoNotRevealResources() {
    String staff = token(STAFF_A, TENANT_A, UserRole.STAFF);

    create(
            ESTABLISHMENT_A,
            PERSON_B,
            List.of(ELEMENT_A),
            "2026-10-14T10:00:00Z",
            "2026-10-14T11:00:00Z",
            staff)
        .expectStatus()
        .isNotFound();
    create(
            ESTABLISHMENT_B,
            PERSON_A,
            List.of(ELEMENT_A),
            "2026-10-14T10:00:00Z",
            "2026-10-14T11:00:00Z",
            staff)
        .expectStatus()
        .isNotFound();
    create(
            ESTABLISHMENT_A,
            PERSON_A,
            List.of(ELEMENT_B),
            "2026-10-14T10:00:00Z",
            "2026-10-14T11:00:00Z",
            staff)
        .expectStatus()
        .isNotFound();
    create(
            ESTABLISHMENT_A,
            UUID.randomUUID(),
            List.of(ELEMENT_A),
            "2026-10-14T10:00:00Z",
            "2026-10-14T11:00:00Z",
            staff)
        .expectStatus()
        .isNotFound();

    assertThat(reservationCount(TENANT_A) + reservationCount(TENANT_B)).isZero();
  }

  @Test
  void resourceFromAnotherEstablishmentOrInactiveResourceReturns400() {
    String staff = token(STAFF_A, TENANT_A, UserRole.STAFF);

    create(
            ESTABLISHMENT_A,
            PERSON_A,
            List.of(ELEMENT_A_OTHER),
            "2026-10-15T10:00:00Z",
            "2026-10-15T11:00:00Z",
            staff)
        .expectStatus()
        .isBadRequest();

    jdbc.update("update space_element set state = 'OUT_OF_SERVICE' where id = ?", ELEMENT_A);
    create(
            ESTABLISHMENT_A,
            PERSON_A,
            List.of(ELEMENT_A),
            "2026-10-15T10:00:00Z",
            "2026-10-15T11:00:00Z",
            staff)
        .expectStatus()
        .isBadRequest();

    assertThat(reservationCount(TENANT_A)).isZero();
  }

  @Test
  void allOverlapShapesConflictAndConsecutiveIntervalsAreAllowed() {
    String staff = token(STAFF_A, TENANT_A, UserRole.STAFF);
    create(
            ESTABLISHMENT_A,
            PERSON_A,
            List.of(ELEMENT_A),
            "2026-10-16T10:00:00Z",
            "2026-10-16T12:00:00Z",
            staff)
        .expectStatus()
        .isCreated();

    List<Interval> conflicts =
        List.of(
            new Interval("2026-10-16T09:00:00Z", "2026-10-16T13:00:00Z"),
            new Interval("2026-10-16T09:00:00Z", "2026-10-16T11:00:00Z"),
            new Interval("2026-10-16T10:30:00Z", "2026-10-16T11:00:00Z"),
            new Interval("2026-10-16T11:00:00Z", "2026-10-16T13:00:00Z"));
    for (Interval interval : conflicts) {
      create(
              ESTABLISHMENT_A,
              PERSON_A,
              List.of(ELEMENT_A),
              interval.startsAt(),
              interval.endsAt(),
              staff)
          .expectStatus()
          .isEqualTo(409)
          .expectHeader()
          .contentTypeCompatibleWith("application/problem+json");
    }

    create(
            ESTABLISHMENT_A,
            PERSON_A,
            List.of(ELEMENT_A),
            "2026-10-16T09:00:00Z",
            "2026-10-16T10:00:00Z",
            staff)
        .expectStatus()
        .isCreated();
    create(
            ESTABLISHMENT_A,
            PERSON_A,
            List.of(ELEMENT_A),
            "2026-10-16T12:00:00Z",
            "2026-10-16T13:00:00Z",
            staff)
        .expectStatus()
        .isCreated();

    assertThat(reservationCount(TENANT_A)).isEqualTo(3);
  }

  @Test
  void conflictOnOneElementRejectsTheWholeReservationWithoutPartialAssociations() {
    String staff = token(STAFF_A, TENANT_A, UserRole.STAFF);
    create(
            ESTABLISHMENT_A,
            PERSON_A,
            List.of(ELEMENT_A),
            "2026-10-17T10:00:00Z",
            "2026-10-17T12:00:00Z",
            staff)
        .expectStatus()
        .isCreated();

    create(
            ESTABLISHMENT_A,
            PERSON_A,
            List.of(ELEMENT_A, ELEMENT_A_SECOND),
            "2026-10-17T11:00:00Z",
            "2026-10-17T13:00:00Z",
            staff)
        .expectStatus()
        .isEqualTo(409)
        .expectBody()
        .jsonPath("$.conflictingElementIds[0]")
        .isEqualTo(ELEMENT_A.toString());

    assertThat(reservationCount(TENANT_A)).isEqualTo(1);
    assertThat(associationCount(TENANT_A)).isEqualTo(1);
    assertThat(associationCountFor(ELEMENT_A_SECOND)).isZero();
  }

  @Test
  void tenantIsolationAppliesToTokensReferencesAndPersistedRows() {
    create(
            ESTABLISHMENT_A,
            PERSON_A,
            List.of(ELEMENT_A),
            "2026-10-18T10:00:00Z",
            "2026-10-18T11:00:00Z",
            token(STAFF_B, TENANT_B, UserRole.STAFF))
        .expectStatus()
        .isNotFound();

    create(
            ESTABLISHMENT_B,
            PERSON_B,
            List.of(ELEMENT_B),
            "2026-10-18T10:00:00Z",
            "2026-10-18T11:00:00Z",
            token(STAFF_B, TENANT_B, UserRole.STAFF))
        .expectStatus()
        .isCreated();

    assertThat(reservationCount(TENANT_A)).isZero();
    assertThat(associationCount(TENANT_A)).isZero();
    assertThat(reservationCount(TENANT_B)).isEqualTo(1);
    assertThat(associationCount(TENANT_B)).isEqualTo(1);
  }

  @Test
  void concurrentRequestsForTheSameElementProduceOneCreationAndOneConflict()
      throws Exception {
    String staff = token(STAFF_A, TENANT_A, UserRole.STAFF);
    CountDownLatch callersReady = new CountDownLatch(2);
    CountDownLatch start = new CountDownLatch(1);

    try (Connection blocker = dataSource.getConnection();
        ExecutorService executor = Executors.newFixedThreadPool(2)) {
      blocker.setAutoCommit(false);
      lockElement(blocker, ELEMENT_A);

      Future<Integer> first =
          executor.submit(
              () -> concurrentCreateStatus(staff, callersReady, start, "2026-10-19T10:00:00Z"));
      Future<Integer> second =
          executor.submit(
              () -> concurrentCreateStatus(staff, callersReady, start, "2026-10-19T10:00:00Z"));

      assertThat(callersReady.await(5, TimeUnit.SECONDS)).isTrue();
      start.countDown();
      awaitBlockedReservationRequests(2);
      blocker.commit();

      assertThat(List.of(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS)))
          .containsExactlyInAnyOrder(201, 409);
    }

    assertThat(reservationCount(TENANT_A)).isEqualTo(1);
    assertThat(associationCount(TENANT_A)).isEqualTo(1);
  }

  private int concurrentCreateStatus(
      String token, CountDownLatch callersReady, CountDownLatch start, String startsAt)
      throws InterruptedException {
    callersReady.countDown();
    if (!start.await(5, TimeUnit.SECONDS)) {
      throw new AssertionError("Las solicitudes concurrentes no recibieron la señal de inicio");
    }
    return create(
            ESTABLISHMENT_A,
            PERSON_A,
            List.of(ELEMENT_A),
            startsAt,
            "2026-10-19T12:00:00Z",
            token)
        .returnResult(Void.class)
        .getStatus()
        .value();
  }

  private void lockElement(Connection connection, UUID elementId) throws Exception {
    try (PreparedStatement statement =
        connection.prepareStatement("select id from space_element where id = ? for update")) {
      statement.setObject(1, elementId);
      statement.executeQuery().close();
    }
  }

  private void awaitBlockedReservationRequests(int expected) throws InterruptedException {
    long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
    while (System.nanoTime() < deadline) {
      Long blocked =
          jdbc.queryForObject(
              """
              select count(*)
              from pg_stat_activity
              where pid <> pg_backend_pid()
                and query like '%reservation-concurrency-guard%'
                and wait_event_type = 'Lock'
              """,
              Long.class);
      if (blocked != null && blocked >= expected) {
        return;
      }
      Thread.sleep(25);
    }
    throw new AssertionError("Las solicitudes no alcanzaron juntas el bloqueo transaccional");
  }

  private RestTestClient.ResponseSpec create(
      UUID establishmentId,
      UUID personId,
      List<UUID> elementIds,
      String startsAt,
      String endsAt,
      String token) {
    RestTestClient.RequestBodySpec request =
        http()
            .post()
            .uri("/api/v1/establishments/{establishmentId}/reservations", establishmentId)
            .contentType(MediaType.APPLICATION_JSON);
    if (token != null) {
      request.header("Authorization", bearer(token));
    }
    return request
        .body(
            Map.of(
                "personId", personId,
                "spaceElementIds", elementIds,
                "startsAt", startsAt,
                "endsAt", endsAt))
        .exchange();
  }

  private RestTestClient http() {
    return RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
  }

  private String token(UUID userId, String tenantId, UserRole role) {
    return tokens
        .issue(
            new AuthenticatedUser(
                userId,
                TenantId.of(tenantId),
                role.name().toLowerCase() + "@reservation-flow.test",
                "Reservation Integration Tester",
                role))
        .value();
  }

  private long reservationCount(String tenantId) {
    return count("select count(*) from reservation where tenant_id = ?", tenantId);
  }

  private long associationCount(String tenantId) {
    return count("select count(*) from reservation_space_element where tenant_id = ?", tenantId);
  }

  private long associationCountFor(UUID elementId) {
    return count(
        "select count(*) from reservation_space_element where space_element_id = ?", elementId);
  }

  private long count(String sql, Object argument) {
    Long result = jdbc.queryForObject(sql, Long.class, argument);
    return result == null ? 0 : result;
  }

  private void tenant(String id, String name) {
    jdbc.update(
        "insert into tenant (id, name, slug, status, vertical) values (?, ?, ?, 'ACTIVE', 'RESTAURANT')",
        id,
        name,
        id);
  }

  private void user(UUID id, String tenantId, String email, UserRole role) {
    jdbc.update(
        "insert into app_user (id, tenant_id, email, password_hash, full_name, role) values (?, ?, ?, 'unused', 'Reservation Tester', ?)",
        id,
        tenantId,
        email,
        role.name());
  }

  private void establishment(UUID id, String tenantId, String name, String slug) {
    jdbc.update(
        "insert into establishment (id, tenant_id, name, type, slug) values (?, ?, ?, 'RESTAURANT', ?)",
        id,
        tenantId,
        name,
        slug);
  }

  private void floor(UUID id, String tenantId, UUID establishmentId, String name, String slug) {
    jdbc.update(
        "insert into floor (id, tenant_id, establishment_id, name, level, slug) values (?, ?, ?, ?, 1, ?)",
        id,
        tenantId,
        establishmentId,
        name,
        slug);
  }

  private void sector(UUID id, String tenantId, UUID floorId, String name, String slug) {
    jdbc.update(
        "insert into sector (id, tenant_id, floor_id, name, slug, max_capacity) values (?, ?, ?, ?, ?, 100)",
        id,
        tenantId,
        floorId,
        name,
        slug);
  }

  private void element(
      UUID id, String tenantId, UUID sectorId, String type, String state) {
    jdbc.update(
        "insert into space_element (id, tenant_id, sector_id, type, state, x, y) values (?, ?, ?, ?, ?, 1, 1)",
        id,
        tenantId,
        sectorId,
        type,
        state);
  }

  private void person(UUID id, String tenantId, UUID actor, String name, String email) {
    jdbc.update(
        "insert into person (id, tenant_id, full_name, email, created_by, updated_by) values (?, ?, ?, ?, ?, ?)",
        id,
        tenantId,
        name,
        email,
        actor,
        actor);
  }

  private static String bearer(String token) {
    return "Bearer " + token;
  }

  private static UUID uuid(String value) {
    return UUID.fromString(value);
  }

  private record UserAccess(UUID id, UserRole role) {}

  private record Interval(String startsAt, String endsAt) {}

  private record ReservationView(
      UUID id,
      UUID establishmentId,
      UUID personId,
      List<UUID> spaceElementIds,
      Instant startsAt,
      Instant endsAt,
      String status,
      Instant createdAt,
      UUID createdBy) {}

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
