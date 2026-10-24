package com.mapit.reservations;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Timestamp;
import java.time.Instant;
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
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.mapit.identity.domain.AccessTokenIssuer;
import com.mapit.identity.domain.AuthenticatedUser;
import com.mapit.identity.domain.UserRole;
import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagPort;
import com.mapit.shared.tenant.TenantId;

/**
 * El listado de reservas del tenant (GET /api/v1/reservations) solo devuelve las suyas.
 *
 * <p>La aplicación corre con el rol de runtime {@code mapit_app} (NOSUPERUSER,
 * NOBYPASSRLS), igual que en producción: la RLS muerde de verdad y el filtro explícito
 * por {@code tenant_id} de la consulta es la segunda capa. Si la consulta perdiera el
 * alcance del tenant, el listado se vaciaría (nunca devolvería datos ajenos).
 *
 * <p>La RLS de la tabla {@code reservation} ya la prueba
 * {@link ReservationPersistenceIsolationIntegrationTest} con SQL directo; aquí lo que se
 * demuestra es que la NUEVA consulta está acotada al tenant.
 */
@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@Import(ReservationListingIntegrationTest.TestFlags.class)
class ReservationListingIntegrationTest {

  private static final String APP_PASSWORD = "test_app_password";

  @Container
  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16-alpine")
          .withDatabaseName("mapit")
          .withUsername("mapit")
          .withPassword("test_password");

  private static final String TENANT_A = "reservation-list-a";
  private static final String TENANT_B = "reservation-list-b";
  private static final UUID USER_A = uuid("61000000-0000-0000-0000-000000000001");
  private static final UUID USER_B = uuid("62000000-0000-0000-0000-000000000001");
  private static final UUID ESTABLISHMENT_A = uuid("61000000-0000-0000-0000-000000000011");
  private static final UUID ESTABLISHMENT_B = uuid("62000000-0000-0000-0000-000000000011");
  private static final UUID FLOOR_A = uuid("61000000-0000-0000-0000-000000000021");
  private static final UUID FLOOR_B = uuid("62000000-0000-0000-0000-000000000021");
  private static final UUID SECTOR_A = uuid("61000000-0000-0000-0000-000000000031");
  private static final UUID SECTOR_B = uuid("62000000-0000-0000-0000-000000000031");
  private static final UUID ELEMENT_A = uuid("61000000-0000-0000-0000-000000000041");
  private static final UUID ELEMENT_B = uuid("62000000-0000-0000-0000-000000000041");
  private static final UUID PERSON_A = uuid("61000000-0000-0000-0000-000000000051");
  private static final UUID PERSON_B = uuid("62000000-0000-0000-0000-000000000051");
  private static final UUID RESERVATION_A_NEW = uuid("61000000-0000-0000-0000-000000000061");
  private static final UUID RESERVATION_A_OLD = uuid("61000000-0000-0000-0000-000000000062");
  private static final UUID RESERVATION_B = uuid("62000000-0000-0000-0000-000000000061");

  @LocalServerPort private int port;
  @Autowired private JdbcTemplate jdbc;
  @Autowired private TransactionTemplate transactions;
  @Autowired private AccessTokenIssuer tokens;

  @DynamicPropertySource
  static void databaseProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    // El rol de runtime: NOBYPASSRLS, para que la RLS sea real y no un falso verde.
    registry.add("spring.datasource.username", () -> "mapit_app");
    registry.add("spring.datasource.password", () -> APP_PASSWORD);
    registry.add("spring.flyway.url", POSTGRES::getJdbcUrl);
    registry.add("spring.flyway.user", POSTGRES::getUsername);
    registry.add("spring.flyway.password", POSTGRES::getPassword);
    registry.add("spring.flyway.placeholders.mapitAppDbPassword", () -> APP_PASSWORD);
    // El SUPER_ADMIN de plataforma escribe en el tenant 'platform': con la RLS activa
    // esa bootstrapping no puede ejecutarse, así que esta suite lo desactiva.
    registry.add("mapit.super-admin.password", () -> "");
    registry.add("mapit.unleash.enabled", () -> "false");
    registry.add("mapit.realtime.outbox.poll-interval-ms", () -> "3600000");
    registry.add("mapit.realtime.outbox.cleanup-interval-ms", () -> "3600000");
  }

  @BeforeEach
  void fixtures() {
    limpiar(TENANT_A);
    limpiar(TENANT_B);
    jdbc.update("delete from tenant where id in (?, ?)", TENANT_A, TENANT_B);

    tenant(TENANT_A, "Reservas Listado A");
    tenant(TENANT_B, "Reservas Listado B");

    enTenant(
        TENANT_A,
        () -> {
          user(USER_A, TENANT_A, "staff-a@reservation-list.test");
          establishment(ESTABLISHMENT_A, TENANT_A, "Local A", "reservation-list-local-a");
          floor(FLOOR_A, TENANT_A, ESTABLISHMENT_A, "Piso A", "reservation-list-floor-a");
          sector(SECTOR_A, TENANT_A, FLOOR_A, "Sector A", "reservation-list-sector-a");
          element(ELEMENT_A, TENANT_A, SECTOR_A);
          person(PERSON_A, TENANT_A, USER_A, "Cliente A", "cliente-a@reservation-list.test");
          reservation(
              RESERVATION_A_OLD,
              TENANT_A,
              ESTABLISHMENT_A,
              PERSON_A,
              USER_A,
              Instant.parse("2026-10-10T10:00:00Z"));
          reservation(
              RESERVATION_A_NEW,
              TENANT_A,
              ESTABLISHMENT_A,
              PERSON_A,
              USER_A,
              Instant.parse("2026-10-12T10:00:00Z"));
          elementoDeReserva(TENANT_A, RESERVATION_A_OLD, ELEMENT_A);
          elementoDeReserva(TENANT_A, RESERVATION_A_NEW, ELEMENT_A);
        });

    enTenant(
        TENANT_B,
        () -> {
          user(USER_B, TENANT_B, "staff-b@reservation-list.test");
          establishment(ESTABLISHMENT_B, TENANT_B, "Local B", "reservation-list-local-b");
          floor(FLOOR_B, TENANT_B, ESTABLISHMENT_B, "Piso B", "reservation-list-floor-b");
          sector(SECTOR_B, TENANT_B, FLOOR_B, "Sector B", "reservation-list-sector-b");
          element(ELEMENT_B, TENANT_B, SECTOR_B);
          person(PERSON_B, TENANT_B, USER_B, "Cliente B", "cliente-b@reservation-list.test");
          reservation(
              RESERVATION_B,
              TENANT_B,
              ESTABLISHMENT_B,
              PERSON_B,
              USER_B,
              Instant.parse("2026-10-11T10:00:00Z"));
          elementoDeReserva(TENANT_B, RESERVATION_B, ELEMENT_B);
        });
  }

  @Test
  void listaSoloLasReservasDelTenantAutenticado() {
    http()
        .get()
        .uri("/api/v1/reservations")
        .header("Authorization", bearer(token(USER_A, TENANT_A)))
        .exchange()
        .expectStatus()
        .isOk()
        .expectBody()
        .jsonPath("$.length()")
        .isEqualTo(2)
        .jsonPath("$[0].id")
        .isEqualTo(RESERVATION_A_NEW.toString())
        .jsonPath("$[0].establishmentId")
        .isEqualTo(ESTABLISHMENT_A.toString())
        .jsonPath("$[0].personId")
        .isEqualTo(PERSON_A.toString())
        .jsonPath("$[0].status")
        .isEqualTo("CREATED")
        .jsonPath("$[0].spaceElementIds.length()")
        .isEqualTo(1)
        .jsonPath("$[0].spaceElementIds[0]")
        .isEqualTo(ELEMENT_A.toString())
        .jsonPath("$[1].id")
        .isEqualTo(RESERVATION_A_OLD.toString());
  }

  @Test
  void lasReservasDeOtroTenantNuncaAparecen() {
    http()
        .get()
        .uri("/api/v1/reservations")
        .header("Authorization", bearer(token(USER_B, TENANT_B)))
        .exchange()
        .expectStatus()
        .isOk()
        .expectBody()
        .jsonPath("$.length()")
        .isEqualTo(1)
        .jsonPath("$[0].id")
        .isEqualTo(RESERVATION_B.toString());
  }

  @Test
  void rechazaLaPeticionAnonima() {
    http().get().uri("/api/v1/reservations").exchange().expectStatus().isUnauthorized();
  }

  /**
   * La RLS está viva en esta suite: sin tenant en la sesión la tabla no devuelve nada.
   *
   * <p>Sin esta comprobación, el aislamiento de los tests anteriores podría venir de
   * un owner que ignora las políticas, y no de la consulta.
   */
  @Test
  void laRlsEstaActivaEnEstaSuite() {
    Long visibles = jdbc.queryForObject("select count(*) from reservation", Long.class);
    assertThat(visibles).isZero();
  }

  // ===== Helpers =====

  private RestTestClient http() {
    return RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
  }

  private String token(UUID userId, String tenantId) {
    return tokens
        .issue(
            new AuthenticatedUser(
                userId,
                TenantId.of(tenantId),
                "staff@reservation-list.test",
                "Reservation Listing Tester",
                UserRole.STAFF))
        .value();
  }

  private void enTenant(String tenantId, Runnable body) {
    transactions.executeWithoutResult(
        status -> {
          jdbc.queryForObject(
              "select set_config('app.tenant_id', ?, true)", String.class, tenantId);
          body.run();
        });
  }

  private void limpiar(String tenantId) {
    enTenant(
        tenantId,
        () -> {
          jdbc.update("delete from reservation_space_element where tenant_id = ?", tenantId);
          jdbc.update("delete from reservation where tenant_id = ?", tenantId);
          jdbc.update("delete from person where tenant_id = ?", tenantId);
          jdbc.update("delete from space_element where tenant_id = ?", tenantId);
          jdbc.update("delete from sector where tenant_id = ?", tenantId);
          jdbc.update("delete from floor where tenant_id = ?", tenantId);
          jdbc.update("delete from establishment where tenant_id = ?", tenantId);
          jdbc.update("delete from app_user where tenant_id = ?", tenantId);
        });
  }

  private void tenant(String id, String name) {
    jdbc.update(
        "insert into tenant (id, name, slug, status, vertical) values (?, ?, ?, 'ACTIVE', 'RESTAURANT')",
        id,
        name,
        id);
  }

  private void user(UUID id, String tenantId, String email) {
    jdbc.update(
        "insert into app_user (id, tenant_id, email, password_hash, full_name, role) values (?, ?, ?, 'unused', 'Reservation Tester', 'STAFF')",
        id,
        tenantId,
        email);
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

  private void element(UUID id, String tenantId, UUID sectorId) {
    jdbc.update(
        "insert into space_element (id, tenant_id, sector_id, type, state, x, y) values (?, ?, ?, 'TABLE', 'AVAILABLE', 1, 1)",
        id,
        tenantId,
        sectorId);
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

  private void reservation(
      UUID id,
      String tenantId,
      UUID establishmentId,
      UUID personId,
      UUID actor,
      Instant createdAt) {
    jdbc.update(
        "insert into reservation (id, tenant_id, establishment_id, person_id, starts_at, ends_at, status, created_at, created_by, updated_at) values (?, ?, ?, ?, ?, ?, 'CREATED', ?, ?, ?)",
        id,
        tenantId,
        establishmentId,
        personId,
        Timestamp.from(Instant.parse("2026-10-10T10:00:00Z")),
        Timestamp.from(Instant.parse("2026-10-10T12:00:00Z")),
        Timestamp.from(createdAt),
        actor,
        Timestamp.from(createdAt));
  }

  private void elementoDeReserva(String tenantId, UUID reservationId, UUID elementId) {
    jdbc.update(
        "insert into reservation_space_element (tenant_id, reservation_id, space_element_id) values (?, ?, ?)",
        tenantId,
        reservationId,
        elementId);
  }

  private static String bearer(String token) {
    return "Bearer " + token;
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
