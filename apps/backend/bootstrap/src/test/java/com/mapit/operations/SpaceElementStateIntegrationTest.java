package com.mapit.operations;

import static org.assertj.core.api.Assertions.assertThat;

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

/** Flujo HTTP, seguridad, persistencia y aislamiento de HU-3.01 / MAP-144. */
@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@Import(SpaceElementStateIntegrationTest.TestFlags.class)
class SpaceElementStateIntegrationTest {

  @Container
  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16-alpine")
          .withDatabaseName("mapit")
          .withUsername("mapit")
          .withPassword("test_password");

  private static final String TENANT_A = "state-it-a";
  private static final String TENANT_B = "state-it-b";
  private static final UUID ADMIN_A =
      UUID.fromString("31000000-0000-0000-0000-000000000001");
  private static final UUID STAFF_A =
      UUID.fromString("31000000-0000-0000-0000-000000000002");
  private static final UUID ESTABLISHMENT_A =
      UUID.fromString("31000000-0000-0000-0000-000000000011");
  private static final UUID ESTABLISHMENT_B =
      UUID.fromString("31000000-0000-0000-0000-000000000012");
  private static final UUID FLOOR_A =
      UUID.fromString("31000000-0000-0000-0000-000000000021");
  private static final UUID FLOOR_B =
      UUID.fromString("31000000-0000-0000-0000-000000000022");
  private static final UUID SECTOR_A =
      UUID.fromString("31000000-0000-0000-0000-000000000031");
  private static final UUID SECTOR_B =
      UUID.fromString("31000000-0000-0000-0000-000000000032");
  private static final UUID ELEMENT_A =
      UUID.fromString("31000000-0000-0000-0000-000000000041");
  private static final UUID ELEMENT_B =
      UUID.fromString("31000000-0000-0000-0000-000000000042");

  @LocalServerPort private int port;
  @Autowired private JdbcTemplate jdbc;
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
        "delete from space_element_state_change where tenant_id in (?, ?)", TENANT_A, TENANT_B);
    jdbc.update("delete from space_element where tenant_id in (?, ?)", TENANT_A, TENANT_B);
    jdbc.update("delete from app_user where tenant_id in (?, ?)", TENANT_A, TENANT_B);
    jdbc.update("delete from sector where tenant_id in (?, ?)", TENANT_A, TENANT_B);
    jdbc.update("delete from floor where tenant_id in (?, ?)", TENANT_A, TENANT_B);
    jdbc.update("delete from establishment where tenant_id in (?, ?)", TENANT_A, TENANT_B);
    jdbc.update("delete from tenant where id in (?, ?)", TENANT_A, TENANT_B);

    tenant(TENANT_A, "Empresa Estado A");
    tenant(TENANT_B, "Empresa Estado B");
    establishment(ESTABLISHMENT_A, TENANT_A, "Local A", "state-it-local-a");
    establishment(ESTABLISHMENT_B, TENANT_B, "Local B", "state-it-local-b");
    floor(FLOOR_A, TENANT_A, ESTABLISHMENT_A, "Piso A", "state-it-floor-a");
    floor(FLOOR_B, TENANT_B, ESTABLISHMENT_B, "Piso B", "state-it-floor-b");
    sector(SECTOR_A, TENANT_A, FLOOR_A, "Sector A", "state-it-sector-a");
    sector(SECTOR_B, TENANT_B, FLOOR_B, "Sector B", "state-it-sector-b");
    element(ELEMENT_A, TENANT_A, SECTOR_A);
    element(ELEMENT_B, TENANT_B, SECTOR_B);
    user(ADMIN_A, TENANT_A, "admin@state-it.test", UserRole.ADMIN);
    user(STAFF_A, TENANT_A, "staff@state-it.test", UserRole.STAFF);
  }

  @Test
  void admin_y_staff_cambian_estado_y_la_auditoria_conserva_actor_y_secuencia() {
    StateView reserved = patch(SECTOR_A, ELEMENT_A, "RESERVED", token(ADMIN_A, UserRole.ADMIN))
        .expectStatus()
        .isOk()
        .expectBody(StateView.class)
        .returnResult()
        .getResponseBody();
    assertThat(reserved).isNotNull();
    assertThat(reserved.state()).isEqualTo("RESERVED");

    StateView occupied = patch(SECTOR_A, ELEMENT_A, "OCCUPIED", token(STAFF_A, UserRole.STAFF))
        .expectStatus()
        .isOk()
        .expectBody(StateView.class)
        .returnResult()
        .getResponseBody();
    assertThat(occupied).isNotNull();
    assertThat(occupied.state()).isEqualTo("OCCUPIED");
    assertThat(stateOf(ELEMENT_A)).isEqualTo("OCCUPIED");

    List<HistoryView> history =
        List.of(
            http()
                .get()
                .uri(historyUri(SECTOR_A, ELEMENT_A))
                .header("Authorization", bearer(token(STAFF_A, UserRole.STAFF)))
                .exchange()
                .expectStatus()
                .isOk()
                .expectBody(HistoryView[].class)
                .returnResult()
                .getResponseBody());

    assertThat(history).hasSize(2);
    assertThat(history.get(0).previousState()).isEqualTo("RESERVED");
    assertThat(history.get(0).newState()).isEqualTo("OCCUPIED");
    assertThat(history.get(0).changedBy()).isEqualTo(STAFF_A);
    assertThat(history.get(0).changedAt()).isNotNull();
    assertThat(history.get(1).previousState()).isEqualTo("AVAILABLE");
    assertThat(history.get(1).newState()).isEqualTo("RESERVED");
    assertThat(history.get(1).changedBy()).isEqualTo(ADMIN_A);
  }

  @Test
  void transicion_invalida_devuelve_409_y_no_modifica_estado_ni_auditoria() {
    patch(SECTOR_A, ELEMENT_A, "CLEANING", token(ADMIN_A, UserRole.ADMIN))
        .expectStatus()
        .isEqualTo(409)
        .expectHeader()
        .contentTypeCompatibleWith("application/problem+json")
        .expectBody()
        .jsonPath("$.title")
        .isEqualTo("Transición de estado no permitida")
        .jsonPath("$.currentState")
        .isEqualTo("AVAILABLE")
        .jsonPath("$.requestedState")
        .isEqualTo("CLEANING");

    assertThat(stateOf(ELEMENT_A)).isEqualTo("AVAILABLE");
    assertThat(auditCount(ELEMENT_A)).isZero();
  }

  @Test
  void endpoint_exige_jwt_y_rechaza_roles_no_autorizados() {
    patch(SECTOR_A, ELEMENT_A, "RESERVED", null).expectStatus().isUnauthorized();
    patch(SECTOR_A, ELEMENT_A, "RESERVED", token(UUID.randomUUID(), UserRole.MANAGER))
        .expectStatus()
        .isForbidden();
    patch(SECTOR_A, ELEMENT_A, "RESERVED", token(UUID.randomUUID(), UserRole.SUPER_ADMIN))
        .expectStatus()
        .isForbidden();

    assertThat(stateOf(ELEMENT_A)).isEqualTo("AVAILABLE");
    assertThat(auditCount(ELEMENT_A)).isZero();
  }

  @Test
  void tenant_sector_elemento_inexistente_y_baja_responden_404_sin_filtrar_datos() {
    String adminA = token(ADMIN_A, UserRole.ADMIN);

    patch(SECTOR_B, ELEMENT_B, "RESERVED", adminA).expectStatus().isNotFound();
    patch(SECTOR_B, ELEMENT_A, "RESERVED", adminA).expectStatus().isNotFound();
    patch(SECTOR_A, UUID.randomUUID(), "RESERVED", adminA).expectStatus().isNotFound();

    jdbc.update("update space_element set deleted_at = now() where id = ?", ELEMENT_A);
    patch(SECTOR_A, ELEMENT_A, "RESERVED", adminA).expectStatus().isNotFound();

    assertThat(stateOf(ELEMENT_B)).isEqualTo("AVAILABLE");
    assertThat(auditCount(ELEMENT_A) + auditCount(ELEMENT_B)).isZero();
  }

  private RestTestClient http() {
    return RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
  }

  private RestTestClient.ResponseSpec patch(
      UUID sectorId, UUID elementId, String state, String token) {
    RestTestClient.RequestBodySpec request =
        http()
            .patch()
            .uri("/api/v1/sectors/{sectorId}/elements/{elementId}/state", sectorId, elementId)
            .contentType(MediaType.APPLICATION_JSON);
    if (token != null) {
      request.header("Authorization", bearer(token));
    }
    return request.body("{\"state\":\"" + state + "\"}").exchange();
  }

  private String token(UUID userId, UserRole role) {
    return tokens
        .issue(
            new AuthenticatedUser(
                userId,
                TenantId.of(TENANT_A),
                role.name().toLowerCase() + "@state-it.test",
                "Integration Tester",
                role))
        .value();
  }

  private static String bearer(String token) {
    return "Bearer " + token;
  }

  private static String historyUri(UUID sectorId, UUID elementId) {
    return "/api/v1/sectors/" + sectorId + "/elements/" + elementId + "/state-history";
  }

  private String stateOf(UUID elementId) {
    return jdbc.queryForObject(
        "select state from space_element where id = ?", String.class, elementId);
  }

  private long auditCount(UUID elementId) {
    Long count =
        jdbc.queryForObject(
            "select count(*) from space_element_state_change where space_element_id = ?",
            Long.class,
            elementId);
    return count == null ? 0 : count;
  }

  private void tenant(String id, String name) {
    jdbc.update(
        "insert into tenant (id, name, slug, status, vertical) values (?, ?, ?, 'ACTIVE', 'RESTAURANT')",
        id,
        name,
        id);
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
        "insert into sector (id, tenant_id, floor_id, name, slug, max_capacity) values (?, ?, ?, ?, ?, 50)",
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

  private void user(UUID id, String tenantId, String email, UserRole role) {
    jdbc.update(
        "insert into app_user (id, tenant_id, email, password_hash, full_name, role) values (?, ?, ?, 'unused', 'Integration Tester', ?)",
        id,
        tenantId,
        email,
        role.name());
  }

  private record StateView(UUID id, UUID sectorId, String state, Instant updatedAt) {}

  private record HistoryView(
      UUID id,
      UUID elementId,
      String previousState,
      String newState,
      UUID changedBy,
      Instant changedAt) {}

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
