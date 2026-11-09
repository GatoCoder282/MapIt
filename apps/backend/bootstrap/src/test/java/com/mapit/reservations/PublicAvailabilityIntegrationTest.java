package com.mapit.reservations;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagPort;

/** HTTP anónimo, tenant y disponibilidad por día local de HU-6.01 / MAP-227. */
@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@Import(PublicAvailabilityIntegrationTest.TestFlags.class)
class PublicAvailabilityIntegrationTest {

  private static final String TENANT = "public-availability";
  private static final String TENANT_B = "public-availability-b";
  private static final String ESTABLISHMENT_SLUG = "availability-local";
  private static final UUID ESTABLISHMENT = uuid("61000000-0000-0000-0000-000000000001");
  private static final UUID FLOOR = uuid("61000000-0000-0000-0000-000000000002");
  private static final UUID SECTOR = uuid("61000000-0000-0000-0000-000000000003");
  private static final UUID FREE = uuid("61000000-0000-0000-0000-000000000011");
  private static final UUID OVERLAPS_DAY_START = uuid("61000000-0000-0000-0000-000000000012");
  private static final UUID ENDS_AT_DAY_START = uuid("61000000-0000-0000-0000-000000000013");
  private static final UUID STARTS_AT_NEXT_DAY = uuid("61000000-0000-0000-0000-000000000014");
  private static final UUID OCCUPIED = uuid("61000000-0000-0000-0000-000000000015");
  private static final UUID DECOR = uuid("61000000-0000-0000-0000-000000000016");
  private static final UUID DELETED = uuid("61000000-0000-0000-0000-000000000017");
  private static final UUID ACTOR = uuid("61000000-0000-0000-0000-000000000021");
  private static final UUID PERSON = uuid("61000000-0000-0000-0000-000000000022");
  private static final UUID RESERVATION_OVERLAP = uuid("61000000-0000-0000-0000-000000000031");
  private static final UUID RESERVATION_ENDS_AT_START =
      uuid("61000000-0000-0000-0000-000000000032");
  private static final UUID RESERVATION_NEXT_DAY =
      uuid("61000000-0000-0000-0000-000000000033");

  @Container
  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16-alpine")
          .withDatabaseName("mapit")
          .withUsername("mapit")
          .withPassword("test_password");

  @LocalServerPort private int port;
  @Autowired private JdbcTemplate jdbc;

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
    jdbc.update("delete from reservation_space_element where tenant_id in (?, ?)", TENANT, TENANT_B);
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
        "insert into establishment (id, tenant_id, name, type, slug, timezone) values (?, ?, ?, 'RESTAURANT', ?, 'America/La_Paz')",
        ESTABLISHMENT,
        TENANT,
        "Local de disponibilidad",
        ESTABLISHMENT_SLUG);
    jdbc.update(
        "insert into establishment (id, tenant_id, name, type, slug, timezone) values (?, ?, ?, 'RESTAURANT', ?, 'America/La_Paz')",
        uuid("62000000-0000-0000-0000-000000000001"),
        TENANT_B,
        "Local de otro tenant",
        ESTABLISHMENT_SLUG);
    jdbc.update(
        "insert into establishment (id, tenant_id, name, type, slug, timezone) values (?, ?, ?, 'RESTAURANT', 'foreign-only', 'America/La_Paz')",
        uuid("62000000-0000-0000-0000-000000000002"),
        TENANT_B,
        "Local visible solo al tenant B");
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
    element(FREE, "TABLE", "AVAILABLE", false);
    element(OVERLAPS_DAY_START, "TABLE", "AVAILABLE", false);
    element(ENDS_AT_DAY_START, "BAR", "AVAILABLE", false);
    // HU-7.01/7.02: una butaca no es reservable en un restaurante (ni el editor la deja crear);
    // la zona sí, así que el caso de frontera sigue cubriendo un tipo distinto de mesa y barra.
    element(STARTS_AT_NEXT_DAY, "SECTOR_ZONE", "AVAILABLE", false);
    element(OCCUPIED, "TABLE", "OCCUPIED", false);
    element(DECOR, "DECOR", "AVAILABLE", false);
    element(DELETED, "TABLE", "AVAILABLE", true);

    jdbc.update(
        "insert into app_user (id, tenant_id, email, password_hash, full_name, role) values (?, ?, 'availability@mapit.test', 'unused', 'Availability Tester', 'ADMIN')",
        ACTOR,
        TENANT);
    jdbc.update(
        "insert into person (id, tenant_id, full_name, created_by) values (?, ?, 'Cliente de prueba', ?)",
        PERSON,
        TENANT,
        ACTOR);
    reservation(
        RESERVATION_OVERLAP,
        OVERLAPS_DAY_START,
        "2026-10-25T03:30:00Z",
        "2026-10-25T04:30:00Z");
    reservation(
        RESERVATION_ENDS_AT_START,
        ENDS_AT_DAY_START,
        "2026-10-25T03:00:00Z",
        "2026-10-25T04:00:00Z");
    reservation(
        RESERVATION_NEXT_DAY,
        STARTS_AT_NEXT_DAY,
        "2026-10-26T04:00:00Z",
        "2026-10-26T05:00:00Z");
  }

  @Test
  void anonymousSearchUsesTheEstablishmentLocalDayAndReturnsOnlyPublicElements() {
    PublicAvailabilityResponse result =
        client()
            .get()
            .uri(path(TENANT, ESTABLISHMENT_SLUG) + "?date=2026-10-25")
            .exchange()
            .expectStatus()
            .isOk()
            .expectBody(PublicAvailabilityResponse.class)
            .returnResult()
            .getResponseBody();

    assertThat(result).isNotNull();
    assertThat(result.establishmentId()).isEqualTo(ESTABLISHMENT);
    assertThat(result.date()).isEqualTo("2026-10-25");
    assertThat(result.elements())
        .extracting(PublicElementResponse::id)
        .containsExactlyInAnyOrder(FREE, ENDS_AT_DAY_START, STARTS_AT_NEXT_DAY);
    assertThat(result.elements())
        .extracting(PublicElementResponse::type)
        .contains("TABLE", "BAR", "SECTOR_ZONE");
  }

  @Test void mapa_intervalo_frontera_allowlist_y_estado_operativo_prevalente() {
    jdbc.update("update reservation set starts_at=starts_at+interval '4 years',ends_at=ends_at+interval '4 years' where tenant_id=?",TENANT);
    jdbc.update("update space_element set label='Jardín',capacity=4 where tenant_id=? and id=?",TENANT,FREE);
    String map=path(TENANT,ESTABLISHMENT_SLUG)+"/map?date=2030-10-25";
    var response=client().get().uri(map+"&startTime=00:00&endTime=00:45").exchange().expectStatus().isOk()
        .expectBody(com.mapit.reservations.domain.availability.PublicAvailabilityMap.class).returnResult().getResponseBody();
    assertThat(response).isNotNull();
    var elements=response.floors().getFirst().sectors().getFirst().elements();
    assertThat(elements).extracting(e -> e.id()).doesNotContain(DELETED);
    assertThat(elements.stream().filter(e -> e.id().equals(FREE)).findFirst().orElseThrow().name()).isEqualTo("Jardín");
    assertThat(elements.stream().filter(e -> e.id().equals(OVERLAPS_DAY_START)).findFirst().orElseThrow().availability()).isEqualTo("RESERVED");
    assertThat(elements.stream().filter(e -> e.id().equals(OCCUPIED)).findFirst().orElseThrow().availability()).isEqualTo("UNAVAILABLE");
    assertThat(elements.stream().filter(e -> e.id().equals(DECOR)).findFirst().orElseThrow().selectable()).isFalse();
    client().get().uri(map+"&startTime=00:30&endTime=01:30").exchange().expectStatus().isOk().expectBody()
        .jsonPath("$.floors[0].sectors[0].elements[?(@.id=='"+OVERLAPS_DAY_START+"')].availability").isEqualTo("AVAILABLE")
        .jsonPath("$.floors[0].sectors[0].elements[0].state").doesNotExist()
        .jsonPath("$.floors[0].sectors[0].elements[0].attributes").doesNotExist();
    for(String query : List.of("&startTime=10:00","&endTime=11:00","&startTime=11:00&endTime=10:00","&startTime=25:00&endTime=26:00")) {
      client().get().uri(map+query).exchange().expectStatus().isBadRequest();
    }
    client().get().uri(path(TENANT,"foreign-only")+"/map?date=2030-10-25").exchange().expectStatus().isNotFound();
    jdbc.update("update establishment set timezone='Europe/Madrid' where tenant_id=? and id=?",TENANT,ESTABLISHMENT);
    client().get().uri(path(TENANT,ESTABLISHMENT_SLUG)+"/map?date=2030-03-31&startTime=02:30&endTime=03:30")
        .exchange().expectStatus().isBadRequest();
    var day=client().get().uri(path(TENANT,ESTABLISHMENT_SLUG)+"/map?date=2030-03-31").exchange().expectStatus().isOk()
        .expectBody(com.mapit.reservations.domain.availability.PublicAvailabilityMap.class).returnResult().getResponseBody();
    assertThat(java.time.Duration.between(day.startsAt(),day.endsAt()).toHours()).isEqualTo(23);
    var ambiguous=client().get().uri(path(TENANT,ESTABLISHMENT_SLUG)+"/map?date=2030-10-27&startTime=02:30&endTime=03:30")
        .exchange().expectStatus().isOk().expectBody(com.mapit.reservations.domain.availability.PublicAvailabilityMap.class)
        .returnResult().getResponseBody();
    assertThat(ambiguous.startsAt()).isEqualTo(Instant.parse("2030-10-27T00:30:00Z"));
    assertThat(ambiguous.startTime()).isEqualTo("02:30");
  }

  @Test
  void returnsAnEmptyListWhenAllElementsAreOperationallyUnavailable() {
    jdbc.update("update space_element set state = 'OCCUPIED' where tenant_id = ?", TENANT);

    PublicAvailabilityResponse result =
        client()
            .get()
            .uri(path(TENANT, ESTABLISHMENT_SLUG) + "?date=2026-10-25")
            .exchange()
            .expectStatus()
            .isOk()
            .expectBody(PublicAvailabilityResponse.class)
            .returnResult()
            .getResponseBody();

    assertThat(result).isNotNull();
    assertThat(result.elements()).isEmpty();
  }

  @Test
  void hidesUnknownSuspendedAndForeignEstablishmentsBehindNotFound() {
    client()
        .get()
        .uri(path("missing-tenant", ESTABLISHMENT_SLUG) + "?date=2026-10-25")
        .exchange()
        .expectStatus()
        .isNotFound()
        .expectHeader()
        .contentTypeCompatibleWith("application/problem+json");

    client()
        .get()
        .uri(path(TENANT, "missing-establishment") + "?date=2026-10-25")
        .exchange()
        .expectStatus()
        .isNotFound();

    client()
        .get()
        .uri(path(TENANT, "foreign-only") + "?date=2026-10-25")
        .exchange()
        .expectStatus()
        .isNotFound();

    jdbc.update("update tenant set status = 'SUSPENDED' where id = ?", TENANT);
    client()
        .get()
        .uri(path(TENANT, ESTABLISHMENT_SLUG) + "?date=2026-10-25")
        .exchange()
        .expectStatus()
        .isNotFound();
  }

  @Test
  void rejectsMissingOrMalformedDate() {
    client()
        .get()
        .uri(path(TENANT, ESTABLISHMENT_SLUG))
        .exchange()
        .expectStatus()
        .isBadRequest();

    client()
        .get()
        .uri(path(TENANT, ESTABLISHMENT_SLUG) + "?date=not-a-date")
        .exchange()
        .expectStatus()
        .isBadRequest();
  }

  private RestTestClient client() {
    return RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
  }

  private String path(String tenantSlug, String establishmentSlug) {
    return "/api/v1/public/tenants/" + tenantSlug + "/establishments/" + establishmentSlug + "/availability";
  }

  private void tenant(String id) {
    jdbc.update(
        "insert into tenant (id, name, slug, status, vertical) values (?, ?, ?, 'ACTIVE', 'RESTAURANT')",
        id,
        id,
        id);
  }

  private void element(UUID id, String type, String state, boolean deleted) {
    jdbc.update(
        "insert into space_element (id, tenant_id, sector_id, type, state, x, y, deleted_at) values (?, ?, ?, ?, ?, 1, 1, ?) ",
        id,
        TENANT,
        SECTOR,
        type,
        state,
        deleted ? Timestamp.from(Instant.parse("2026-10-01T00:00:00Z")) : null);
  }

  private void reservation(UUID id, UUID element, String startsAt, String endsAt) {
    jdbc.update(
        "insert into reservation (id, tenant_id, establishment_id, person_id, starts_at, ends_at, status, created_by) values (?, ?, ?, ?, ?, ?, 'CONFIRMED', ?)",
        id,
        TENANT,
        ESTABLISHMENT,
        PERSON,
        Timestamp.from(Instant.parse(startsAt)),
        Timestamp.from(Instant.parse(endsAt)),
        ACTOR);
    jdbc.update(
        "insert into reservation_space_element (tenant_id, reservation_id, space_element_id) values (?, ?, ?)",
        TENANT,
        id,
        element);
  }

  private static UUID uuid(String value) {
    return UUID.fromString(value);
  }

  private record PublicAvailabilityResponse(
      UUID establishmentId, String date, List<PublicElementResponse> elements) {}

  private record PublicElementResponse(UUID id, String type) {}

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
