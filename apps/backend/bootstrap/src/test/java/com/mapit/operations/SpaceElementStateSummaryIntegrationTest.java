package com.mapit.operations;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
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

import com.mapit.identity.domain.AccessTokenIssuer;
import com.mapit.identity.domain.AuthenticatedUser;
import com.mapit.identity.domain.UserRole;
import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagPort;
import com.mapit.shared.tenant.TenantId;

/** Aislamiento multi-tenant y recuento agregado del resumen de estados (CU-14). */
@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@Import(SpaceElementStateSummaryIntegrationTest.TestFlags.class)
class SpaceElementStateSummaryIntegrationTest {

  @Container
  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16-alpine")
          .withDatabaseName("mapit")
          .withUsername("mapit")
          .withPassword("test_password");

  private static final String TENANT_A = "summary-it-a";
  private static final String TENANT_B = "summary-it-b";
  private static final UUID ADMIN_A =
      UUID.fromString("32000000-0000-0000-0000-000000000001");
  private static final UUID ADMIN_B =
      UUID.fromString("32000000-0000-0000-0000-000000000002");
  private static final UUID ESTABLISHMENT_A =
      UUID.fromString("32000000-0000-0000-0000-000000000011");
  private static final UUID ESTABLISHMENT_B =
      UUID.fromString("32000000-0000-0000-0000-000000000012");
  private static final UUID FLOOR_A =
      UUID.fromString("32000000-0000-0000-0000-000000000021");
  private static final UUID FLOOR_B =
      UUID.fromString("32000000-0000-0000-0000-000000000022");
  private static final UUID SECTOR_A =
      UUID.fromString("32000000-0000-0000-0000-000000000031");
  private static final UUID SECTOR_B =
      UUID.fromString("32000000-0000-0000-0000-000000000032");

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
    jdbc.update("delete from space_element where tenant_id in (?, ?)", TENANT_A, TENANT_B);
    jdbc.update("delete from app_user where tenant_id in (?, ?)", TENANT_A, TENANT_B);
    jdbc.update("delete from sector where tenant_id in (?, ?)", TENANT_A, TENANT_B);
    jdbc.update("delete from floor where tenant_id in (?, ?)", TENANT_A, TENANT_B);
    jdbc.update("delete from establishment where tenant_id in (?, ?)", TENANT_A, TENANT_B);
    jdbc.update("delete from tenant where id in (?, ?)", TENANT_A, TENANT_B);

    tenant(TENANT_A, "Empresa Resumen A");
    tenant(TENANT_B, "Empresa Resumen B");
    establishment(ESTABLISHMENT_A, TENANT_A, "Local A", "summary-it-local-a");
    establishment(ESTABLISHMENT_B, TENANT_B, "Local B", "summary-it-local-b");
    floor(FLOOR_A, TENANT_A, ESTABLISHMENT_A, "Piso A", "summary-it-floor-a");
    floor(FLOOR_B, TENANT_B, ESTABLISHMENT_B, "Piso B", "summary-it-floor-b");
    sector(SECTOR_A, TENANT_A, FLOOR_A, "Sector A", "summary-it-sector-a");
    sector(SECTOR_B, TENANT_B, FLOOR_B, "Sector B", "summary-it-sector-b");
    user(ADMIN_A, TENANT_A, "admin@summary-it-a.test", UserRole.ADMIN);
    user(ADMIN_B, TENANT_B, "admin@summary-it-b.test", UserRole.ADMIN);
  }

  @Test
  void cada_estado_cae_en_su_cubeta_y_el_estado_ausente_vuelve_como_cero() {
    element(TENANT_A, SECTOR_A, "AVAILABLE");
    element(TENANT_A, SECTOR_A, "AVAILABLE");
    element(TENANT_A, SECTOR_A, "OCCUPIED");
    element(TENANT_A, SECTOR_A, "RESERVED");
    element(TENANT_A, SECTOR_A, "CLEANING");
    element(TENANT_A, SECTOR_A, "OUT_OF_SERVICE");

    SummaryView summary = getSummary(token(ADMIN_A, TENANT_A, UserRole.ADMIN));

    assertThat(summary.total()).isEqualTo(6);
    assertThat(summary.byState())
        .containsEntry("AVAILABLE", 2)
        .containsEntry("OCCUPIED", 1)
        .containsEntry("RESERVED", 1)
        .containsEntry("CLEANING", 1)
        .containsEntry("OUT_OF_SERVICE", 1);
  }

  @Test
  void cuenta_solo_los_elementos_del_tenant_actual() {
    element(TENANT_A, SECTOR_A, "AVAILABLE");
    element(TENANT_B, SECTOR_B, "OCCUPIED");
    element(TENANT_B, SECTOR_B, "OCCUPIED");

    SummaryView summaryA = getSummary(token(ADMIN_A, TENANT_A, UserRole.ADMIN));
    SummaryView summaryB = getSummary(token(ADMIN_B, TENANT_B, UserRole.ADMIN));

    assertThat(summaryA.total()).isEqualTo(1);
    assertThat(summaryA.byState())
        .containsEntry("AVAILABLE", 1)
        .containsEntry("OCCUPIED", 0);
    assertThat(summaryB.total()).isEqualTo(2);
    assertThat(summaryB.byState())
        .containsEntry("AVAILABLE", 0)
        .containsEntry("OCCUPIED", 2);
  }

  @Test
  void los_elementos_dados_de_baja_no_se_cuentan() {
    UUID deleted = element(TENANT_A, SECTOR_A, "AVAILABLE");
    jdbc.update("update space_element set deleted_at = now() where id = ?", deleted);
    element(TENANT_A, SECTOR_A, "AVAILABLE");

    SummaryView summary = getSummary(token(ADMIN_A, TENANT_A, UserRole.ADMIN));

    assertThat(summary.total()).isEqualTo(1);
    assertThat(summary.byState()).containsEntry("AVAILABLE", 1);
  }

  @Test
  void el_resumen_exige_jwt() {
    http().get().uri("/api/v1/element-states/summary").exchange().expectStatus().isUnauthorized();
  }

  private RestTestClient http() {
    return RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
  }

  private SummaryView getSummary(String token) {
    SummaryView summary =
        http()
            .get()
            .uri("/api/v1/element-states/summary")
            .header("Authorization", "Bearer " + token)
            .exchange()
            .expectStatus()
            .isOk()
            .expectBody(SummaryView.class)
            .returnResult()
            .getResponseBody();
    assertThat(summary).isNotNull();
    return summary;
  }

  private String token(UUID userId, String tenantId, UserRole role) {
    return tokens
        .issue(
            new AuthenticatedUser(
                userId,
                TenantId.of(tenantId),
                role.name().toLowerCase() + "@summary-it.test",
                "Integration Tester",
                role))
        .value();
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

  private UUID element(String tenantId, UUID sectorId, String state) {
    UUID id = UUID.randomUUID();
    jdbc.update(
        "insert into space_element (id, tenant_id, sector_id, type, state, x, y) values (?, ?, ?, 'TABLE', ?, 1, 1)",
        id,
        tenantId,
        sectorId,
        state);
    return id;
  }

  private void user(UUID id, String tenantId, String email, UserRole role) {
    jdbc.update(
        "insert into app_user (id, tenant_id, email, password_hash, full_name, role) values (?, ?, ?, 'unused', 'Integration Tester', ?)",
        id,
        tenantId,
        email,
        role.name());
  }

  private record SummaryView(int total, Map<String, Integer> byState) {}

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
