package com.mapit.reservations;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
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

import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagPort;

/** Flujo HTTP anónimo de autogestión de reservas de HU-6.02. */
@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@Import(PublicReservationIntegrationTest.TestFlags.class)
class PublicReservationIntegrationTest {

  private static final String TENANT = "public-reservation";
  private static final String TENANT_B = "public-reservation-b";
  private static final String ESTABLISHMENT_SLUG = "reservation-local";
  private static final UUID ESTABLISHMENT = uuid("63000000-0000-0000-0000-000000000001");
  private static final UUID FLOOR = uuid("63000000-0000-0000-0000-000000000002");
  private static final UUID SECTOR = uuid("63000000-0000-0000-0000-000000000003");
  private static final UUID ELEMENT = uuid("63000000-0000-0000-0000-000000000011");
  private static final UUID OTHER_ELEMENT = uuid("63000000-0000-0000-0000-000000000012");
  private static final UUID EXISTING_PERSON = uuid("63000000-0000-0000-0000-000000000021");
  private static final UUID EXISTING_RESERVATION =
      uuid("63000000-0000-0000-0000-000000000031");

  @Container
  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16-alpine")
          .withDatabaseName("mapit")
          .withUsername("mapit")
          .withPassword("test_password");

  @LocalServerPort private int port;
  @Autowired private JdbcTemplate jdbc;
  @Autowired private DataSource dataSource;

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
  }

  @BeforeEach
  void fixtures() {
    jdbc.update(
        "delete from reservation_space_element where tenant_id in (?, ?)", TENANT, TENANT_B);
    jdbc.update("delete from reservation where tenant_id in (?, ?)", TENANT, TENANT_B);
    jdbc.update("delete from person where tenant_id in (?, ?)", TENANT, TENANT_B);
    jdbc.update("delete from space_element where tenant_id in (?, ?)", TENANT, TENANT_B);
    jdbc.update("delete from sector where tenant_id in (?, ?)", TENANT, TENANT_B);
    jdbc.update("delete from floor where tenant_id in (?, ?)", TENANT, TENANT_B);
    jdbc.update("delete from establishment where tenant_id in (?, ?)", TENANT, TENANT_B);
    jdbc.update("delete from app_user where tenant_id in (?, ?)", TENANT, TENANT_B);
    jdbc.update("delete from tenant where id in (?, ?)", TENANT, TENANT_B);

    tenant(TENANT);
    tenant(TENANT_B);
    jdbc.update(
        "insert into establishment (id, tenant_id, name, type, slug, timezone) values (?, ?, 'Local de reservas', 'RESTAURANT', ?, 'America/La_Paz')",
        ESTABLISHMENT,
        TENANT,
        ESTABLISHMENT_SLUG);
    jdbc.update(
        "insert into establishment (id, tenant_id, name, type, slug, timezone) values (?, ?, 'Local ajeno', 'RESTAURANT', 'foreign-only', 'America/La_Paz')",
        uuid("64000000-0000-0000-0000-000000000001"),
        TENANT_B);
    jdbc.update(
        "insert into floor (id, tenant_id, establishment_id, name, level, slug) values (?, ?, ?, 'Planta', 1, 'planta')",
        FLOOR,
        TENANT,
        ESTABLISHMENT);
    jdbc.update(
        "insert into sector (id, tenant_id, floor_id, name, slug, max_capacity) values (?, ?, ?, 'Salón', 'salon', 40)",
        SECTOR,
        TENANT,
        FLOOR);
    element(ELEMENT, "TABLE", "AVAILABLE");
    element(OTHER_ELEMENT, "BAR", "AVAILABLE");
  }

  @Test
  void anonymousReservationCreatesThePersonAndReservationWithoutActor() {
    CreateReservationResponse result = create(request(ELEMENT, "Ana Pérez", "ANA@Example.COM"));

    assertThat(result.id()).isNotNull();
    assertThat(result.establishmentId()).isEqualTo(ESTABLISHMENT);
    assertThat(result.spaceElementIds()).containsExactly(ELEMENT);
    assertThat(result.date()).isEqualTo("2026-10-25");
    assertThat(result.startTime()).isEqualTo("19:00");
    assertThat(result.endTime()).isEqualTo("21:00");
    assertThat(result.startsAt()).isEqualTo(Instant.parse("2026-10-25T23:00:00Z"));
    assertThat(result.endsAt()).isEqualTo(Instant.parse("2026-10-26T01:00:00Z"));
    assertThat(result.timezone()).isEqualTo("America/La_Paz");
    assertThat(result.status()).isEqualTo("CREATED");

    Map<String, Object> person =
        jdbc.queryForMap(
            "select id, created_by, email from person where tenant_id = ? and email = ?",
            TENANT,
            "ana@example.com");
    assertThat((UUID) person.get("id")).isNotNull();
    assertThat(person.get("created_by")).isNull();

    Map<String, Object> reservation =
        jdbc.queryForMap(
            "select person_id, created_by, status from reservation where tenant_id = ? and id = ?",
            TENANT,
            result.id());
    assertThat((UUID) reservation.get("person_id")).isEqualTo(person.get("id"));
    assertThat(reservation.get("created_by")).isNull();
    assertThat(reservation.get("status")).isEqualTo("CREATED");
  }

  @Test
  void reusesAnExistingPersonByEmailInsteadOfDuplicatingIt() {
    jdbc.update(
        "insert into person (id, tenant_id, full_name, email) values (?, ?, 'Ana Existente', 'ana@example.com')",
        EXISTING_PERSON,
        TENANT);

    CreateReservationResponse result = create(request(ELEMENT, "Ana Nueva", "ana@example.com"));

    Integer people =
        jdbc.queryForObject(
            "select count(*) from person where tenant_id = ? and email = ?",
            Integer.class,
            TENANT,
            "ana@example.com");
    assertThat(people).isEqualTo(1);
    UUID personId =
        jdbc.queryForObject(
            "select person_id from reservation where tenant_id = ? and id = ?",
            UUID.class,
            TENANT,
            result.id());
    assertThat(personId).isEqualTo(EXISTING_PERSON);
  }

  @Test
  void returnsConflictWhenTheElementHasAnOverlappingReservation() {
    insertReservation(EXISTING_RESERVATION, ELEMENT, "2026-10-25T23:30:00Z", "2026-10-26T00:30:00Z");

    Map<?, ?> problem =
        client()
            .post()
            .uri(path())
            .contentType(MediaType.APPLICATION_JSON)
            .body(request(ELEMENT, "Ana Pérez", "ana@example.com"))
            .exchange()
            .expectStatus()
            .isEqualTo(409)
            .expectHeader()
            .contentTypeCompatibleWith("application/problem+json")
            .expectBody(Map.class)
            .returnResult()
            .getResponseBody();

    assertThat(problem).isNotNull();
    assertThat(problem.get("type").toString()).endsWith("reservation-overlap");
    assertThat(problem.get("conflictingElementIds")).isNotNull();
    assertThat(countReservations()).isEqualTo(1);
  }

  @Test
  void concurrentRequestsForTheSameElementCreateOnlyOneReservation() throws Exception {
    CountDownLatch callersReady = new CountDownLatch(2);
    CountDownLatch start = new CountDownLatch(1);

    try (Connection blocker = dataSource.getConnection();
        ExecutorService executor = Executors.newFixedThreadPool(2)) {
      blocker.setAutoCommit(false);
      lockElement(blocker);

      Future<Integer> first =
          executor.submit(() -> concurrentCreateStatus(callersReady, start, "ana1@example.com"));
      Future<Integer> second =
          executor.submit(() -> concurrentCreateStatus(callersReady, start, "ana2@example.com"));

      assertThat(callersReady.await(5, TimeUnit.SECONDS)).isTrue();
      start.countDown();
      awaitBlockedReservationRequests(2);
      blocker.commit();

      assertThat(List.of(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS)))
          .containsExactlyInAnyOrder(201, 409);
    }

    assertThat(countReservations()).isEqualTo(1);
    assertThat(countPeople()).isEqualTo(1);
  }

  @Test
  void returnsConflictWhenTheElementIsOperationallyUnavailable() {
    jdbc.update(
        "update space_element set state = 'OCCUPIED' where tenant_id = ? and id = ?",
        TENANT,
        ELEMENT);

    Map<?, ?> problem =
        client()
            .post()
            .uri(path())
            .contentType(MediaType.APPLICATION_JSON)
            .body(request(ELEMENT, "Ana Pérez", "ana@example.com"))
            .exchange()
            .expectStatus()
            .isEqualTo(409)
            .expectHeader()
            .contentTypeCompatibleWith("application/problem+json")
            .expectBody(Map.class)
            .returnResult()
            .getResponseBody();

    assertThat(problem).isNotNull();
    assertThat(problem.get("type").toString()).endsWith("reservation-unavailable");
    assertThat(countReservations()).isZero();
  }

  @Test
  void hidesUnknownOrForeignEstablishmentsBehindNotFound() {
    client()
        .post()
        .uri("/api/v1/public/tenants/missing-tenant/establishments/" + ESTABLISHMENT_SLUG + "/reservations")
        .contentType(MediaType.APPLICATION_JSON)
        .body(request(ELEMENT, "Ana Pérez", "ana@example.com"))
        .exchange()
        .expectStatus()
        .isNotFound();

    client()
        .post()
        .uri(path("missing-establishment"))
        .contentType(MediaType.APPLICATION_JSON)
        .body(request(ELEMENT, "Ana Pérez", "ana@example.com"))
        .exchange()
        .expectStatus()
        .isNotFound();

    client()
        .post()
        .uri(path("foreign-only"))
        .contentType(MediaType.APPLICATION_JSON)
        .body(request(ELEMENT, "Ana Pérez", "ana@example.com"))
        .exchange()
        .expectStatus()
        .isNotFound();

    jdbc.update("update establishment set deleted_at = now() where tenant_id = ?", TENANT);
    client()
        .post()
        .uri(path())
        .contentType(MediaType.APPLICATION_JSON)
        .body(request(ELEMENT, "Ana Pérez", "ana@example.com"))
        .exchange()
        .expectStatus()
        .isNotFound();

    jdbc.update(
        "update establishment set deleted_at = null where tenant_id = ?", TENANT);
    jdbc.update("update tenant set status = 'SUSPENDED' where id = ?", TENANT);
    client()
        .post()
        .uri(path())
        .contentType(MediaType.APPLICATION_JSON)
        .body(request(ELEMENT, "Ana Pérez", "ana@example.com"))
        .exchange()
        .expectStatus()
        .isNotFound();
  }

  @Test
  void rejectsInvalidPublicReservationPayloads() {
    client()
        .post()
        .uri(path())
        .contentType(MediaType.APPLICATION_JSON)
        .body(request(ELEMENT, "Ana Pérez", "not-an-email"))
        .exchange()
        .expectStatus()
        .isBadRequest();

    client()
        .post()
        .uri(path())
        .contentType(MediaType.APPLICATION_JSON)
        .body(
            new CreateReservationRequest(
                "2026-10-25",
                "21:00",
                "19:00",
                List.of(ELEMENT),
                new CustomerRequest("Ana Pérez", "ana@example.com", null)))
        .exchange()
        .expectStatus()
        .isBadRequest();
  }

  private int concurrentCreateStatus(
      CountDownLatch callersReady, CountDownLatch start, String email)
      throws InterruptedException {
    callersReady.countDown();
    if (!start.await(5, TimeUnit.SECONDS)) {
      throw new AssertionError("Las solicitudes concurrentes no recibieron la señal de inicio");
    }
    return client()
        .post()
        .uri(path())
        .contentType(MediaType.APPLICATION_JSON)
        .body(request(ELEMENT, "Ana Pérez", email))
        .exchange()
        .returnResult(Void.class)
        .getStatus()
        .value();
  }

  private void lockElement(Connection connection) throws Exception {
    try (PreparedStatement statement =
        connection.prepareStatement("select id from space_element where id = ? for update")) {
      statement.setObject(1, ELEMENT);
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
    throw new AssertionError("Las solicitudes concurrentes no quedaron bloqueadas");
  }

  private CreateReservationResponse create(CreateReservationRequest request) {
    CreateReservationResponse result =
        client()
            .post()
            .uri(path())
            .contentType(MediaType.APPLICATION_JSON)
            .body(request)
            .exchange()
            .expectStatus()
            .isCreated()
            .expectHeader()
            .contentTypeCompatibleWith(MediaType.APPLICATION_JSON)
            .expectBody(CreateReservationResponse.class)
            .returnResult()
            .getResponseBody();
    assertThat(result).isNotNull();
    return result;
  }

  private CreateReservationRequest request(UUID element, String fullName, String email) {
    return new CreateReservationRequest(
        "2026-10-25",
        "19:00",
        "21:00",
        List.of(element),
        new CustomerRequest(fullName, email, null));
  }

  private int countReservations() {
    Integer count =
        jdbc.queryForObject(
            "select count(*) from reservation where tenant_id = ?", Integer.class, TENANT);
    return count == null ? 0 : count;
  }

  private int countPeople() {
    Integer count =
        jdbc.queryForObject(
            "select count(*) from person where tenant_id = ?", Integer.class, TENANT);
    return count == null ? 0 : count;
  }

  private void insertReservation(UUID id, UUID element, String startsAt, String endsAt) {
    jdbc.update(
        "insert into person (id, tenant_id, full_name, email) values (?, ?, 'Cliente existente', 'existing@example.com')",
        EXISTING_PERSON,
        TENANT);
    jdbc.update(
        "insert into reservation (id, tenant_id, establishment_id, person_id, starts_at, ends_at, status) values (?, ?, ?, ?, ?, ?, 'CONFIRMED')",
        id,
        TENANT,
        ESTABLISHMENT,
        EXISTING_PERSON,
        Timestamp.from(Instant.parse(startsAt)),
        Timestamp.from(Instant.parse(endsAt)));
    jdbc.update(
        "insert into reservation_space_element (tenant_id, reservation_id, space_element_id) values (?, ?, ?)",
        TENANT,
        id,
        element);
  }

  private void tenant(String id) {
    jdbc.update(
        "insert into tenant (id, name, slug, status, vertical) values (?, ?, ?, 'ACTIVE', 'RESTAURANT')",
        id,
        id,
        id);
  }

  private void element(UUID id, String type, String state) {
    jdbc.update(
        "insert into space_element (id, tenant_id, sector_id, type, state, x, y) values (?, ?, ?, ?, ?, 1, 1)",
        id,
        TENANT,
        SECTOR,
        type,
        state);
  }

  private RestTestClient client() {
    return RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
  }

  private String path() {
    return path(ESTABLISHMENT_SLUG);
  }

  private String path(String establishmentSlug) {
    return "/api/v1/public/tenants/"
        + TENANT
        + "/establishments/"
        + establishmentSlug
        + "/reservations";
  }

  private static UUID uuid(String value) {
    return UUID.fromString(value);
  }

  private record CreateReservationRequest(
      String date,
      String startTime,
      String endTime,
      List<UUID> spaceElementIds,
      CustomerRequest customer) {}

  private record CustomerRequest(String fullName, String email, String phone) {}

  private record CreateReservationResponse(
      UUID id,
      UUID establishmentId,
      List<UUID> spaceElementIds,
      String date,
      String startTime,
      String endTime,
      Instant startsAt,
      Instant endsAt,
      String timezone,
      String status,
      Instant createdAt) {}

  @TestConfiguration
  static class TestFlags {
    @Bean
    @Primary
    Clock reservationClock() { return Clock.fixed(Instant.parse("2026-10-25T12:00:00Z"),ZoneOffset.UTC); }

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
