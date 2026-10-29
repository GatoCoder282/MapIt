package com.mapit.verticals;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

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

/**
 * HU-7.01/7.02 · MAP-232: la vertical operativa se resuelve desde el establecimiento, queda
 * aislada por tenant y Unleash solo la habilita (CA-1…CA-4).
 */
@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@Import(VerticalProfileIntegrationTest.TenantFlags.class)
class VerticalProfileIntegrationTest {

  @Container
  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16-alpine")
          .withDatabaseName("mapit")
          .withUsername("mapit")
          .withPassword("test_password");

  private static final String TENANT_A = "vertical-profile-a";
  private static final String TENANT_B = "vertical-profile-b";
  private static final UUID ADMIN_A = uuid("71000000-0000-0000-0000-000000000001");
  private static final UUID ADMIN_B = uuid("72000000-0000-0000-0000-000000000001");
  private static final UUID HOTEL_A = uuid("71000000-0000-0000-0000-000000000011");
  private static final UUID RESTAURANT_A = uuid("71000000-0000-0000-0000-000000000012");
  private static final UUID FLOOR_A = uuid("71000000-0000-0000-0000-000000000021");
  private static final UUID SECTOR_A = uuid("71000000-0000-0000-0000-000000000031");

  /** Flags apagadas por tenant, como haría una estrategia de Unleash con {@code tenantId}. */
  private static final Set<String> APAGADAS = ConcurrentHashMap.newKeySet();

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
    APAGADAS.clear();
    jdbc.update("delete from sector where tenant_id in (?, ?)", TENANT_A, TENANT_B);
    jdbc.update("delete from floor where tenant_id in (?, ?)", TENANT_A, TENANT_B);
    jdbc.update("delete from establishment where tenant_id in (?, ?)", TENANT_A, TENANT_B);
    jdbc.update("delete from app_user where tenant_id in (?, ?)", TENANT_A, TENANT_B);
    jdbc.update("delete from tenant where id in (?, ?)", TENANT_A, TENANT_B);

    // El tenant A se registró como restaurante: su hotel debe comportarse como hotel (D1).
    tenant(TENANT_A, "RESTAURANT");
    tenant(TENANT_B, "HOTEL");
    user(ADMIN_A, TENANT_A, "admin-a@vertical-profile.test");
    user(ADMIN_B, TENANT_B, "admin-b@vertical-profile.test");
    establishment(HOTEL_A, TENANT_A, "HOTEL", "hotel-a");
    establishment(RESTAURANT_A, TENANT_A, "RESTAURANT", "restaurante-a");
    jdbc.update(
        "insert into floor (id, tenant_id, establishment_id, name, level, slug) values (?, ?, ?, 'Piso 1', 1, 'piso-1')",
        FLOOR_A,
        TENANT_A,
        HOTEL_A);
    jdbc.update(
        "insert into sector (id, tenant_id, floor_id, name, slug, max_capacity) values (?, ?, ?, 'Ala norte', 'ala-norte', 40)",
        SECTOR_A,
        TENANT_A,
        FLOOR_A);
  }

  @Test
  void el_perfil_sale_del_tipo_del_establecimiento_y_no_del_tenant() {
    profile("/api/v1/establishments/{id}/vertical-profile", HOTEL_A, admin(ADMIN_A, TENANT_A))
        .expectStatus()
        .isOk()
        .expectBody()
        .jsonPath("$.establishmentType").isEqualTo("HOTEL")
        .jsonPath("$.bookingMode").isEqualTo("STAY")
        .jsonPath("$.enabled").isEqualTo(true)
        .jsonPath("$.allowedElementTypes").isEqualTo(java.util.List.of("ROOM", "DECOR"))
        .jsonPath("$.reservableElementTypes").isEqualTo(java.util.List.of("ROOM"))
        .jsonPath("$.maxDurationMinutes").isEmpty()
        .jsonPath("$.minNights").isEqualTo(1)
        .jsonPath("$.maxNights").isEqualTo(30)
        .jsonPath("$.defaultStartTime").isEqualTo("15:00")
        .jsonPath("$.defaultEndTime").isEqualTo("12:00");

    profile("/api/v1/establishments/{id}/vertical-profile", RESTAURANT_A, admin(ADMIN_A, TENANT_A))
        .expectStatus()
        .isOk()
        .expectBody()
        .jsonPath("$.bookingMode").isEqualTo("SHIFT")
        .jsonPath("$.allowsOvernight").isEqualTo(false)
        .jsonPath("$.maxDurationMinutes").isEqualTo(360)
        .jsonPath("$.defaultStartTime").isEmpty();
  }

  @Test
  void el_editor_resuelve_la_vertical_desde_el_sector() {
    profile("/api/v1/sectors/{id}/vertical-profile", SECTOR_A, admin(ADMIN_A, TENANT_A))
        .expectStatus()
        .isOk()
        .expectBody()
        .jsonPath("$.establishmentType").isEqualTo("HOTEL")
        .jsonPath("$.allowedElementTypes").isEqualTo(java.util.List.of("ROOM", "DECOR"));
  }

  @Test
  void otro_tenant_recibe_404_como_si_no_existiera() {
    String adminB = admin(ADMIN_B, TENANT_B);

    profile("/api/v1/establishments/{id}/vertical-profile", HOTEL_A, adminB)
        .expectStatus()
        .isNotFound();
    profile("/api/v1/sectors/{id}/vertical-profile", SECTOR_A, adminB)
        .expectStatus()
        .isNotFound();
    profile("/api/v1/establishments/{id}/vertical-profile", UUID.randomUUID(), adminB)
        .expectStatus()
        .isNotFound();
  }

  @Test
  void sin_jwt_no_se_filtra_el_perfil_de_otro_tenant() {
    // Las rutas de establecimientos siguen abiertas con DemoTenantContext (CU-04, temporal):
    // un anónimo cae en el tenant demo y no ve establecimientos ajenos.
    profile("/api/v1/establishments/{id}/vertical-profile", HOTEL_A, null)
        .expectStatus()
        .isNotFound();
  }

  @Test
  void flag_apagada_rechaza_el_alta_sin_tocar_la_vertical_existente() {
    APAGADAS.add(FeatureFlag.VERTICAL_HOTEL.clave() + "@" + TENANT_A);
    String adminA = admin(ADMIN_A, TENANT_A);

    createEstablishment(adminA, "HOTEL", "hotel-nuevo")
        .expectStatus()
        .isForbidden()
        .expectBody()
        .jsonPath("$.type").isEqualTo("https://mapit.local/problems/vertical-disabled")
        .jsonPath("$.vertical").isEqualTo("HOTEL");
    assertThat(
            jdbc.queryForObject(
                "select count(*) from establishment where tenant_id = ? and slug = 'hotel-nuevo'",
                Long.class,
                TENANT_A))
        .isZero();

    // El hotel existente sigue siendo hotel: solo cambia `enabled`.
    profile("/api/v1/establishments/{id}/vertical-profile", HOTEL_A, adminA)
        .expectStatus()
        .isOk()
        .expectBody()
        .jsonPath("$.establishmentType").isEqualTo("HOTEL")
        .jsonPath("$.enabled").isEqualTo(false);

    // Las verticales base y otros tenants no se ven afectados.
    createEstablishment(adminA, "RESTAURANT", "restaurante-nuevo").expectStatus().isCreated();
    createEstablishment(admin(ADMIN_B, TENANT_B), "HOTEL", "hotel-b").expectStatus().isCreated();
  }

  @Test
  void flag_encendida_permite_crear_y_recargar_la_vertical() {
    String adminA = admin(ADMIN_A, TENANT_A);

    createEstablishment(adminA, "EVENT_HALL", "salon-a").expectStatus().isCreated();
    UUID salon =
        jdbc.queryForObject(
            "select id from establishment where tenant_id = ? and slug = 'salon-a'",
            UUID.class,
            TENANT_A);

    profile("/api/v1/establishments/{id}/vertical-profile", salon, adminA)
        .expectStatus()
        .isOk()
        .expectBody()
        .jsonPath("$.establishmentType").isEqualTo("EVENT_HALL")
        .jsonPath("$.bookingMode").isEqualTo("EVENT")
        .jsonPath("$.allowsOvernight").isEqualTo(true)
        .jsonPath("$.enabled").isEqualTo(true);
  }

  private RestTestClient.ResponseSpec profile(String path, UUID id, String token) {
    RestTestClient.RequestHeadersSpec<?> request = http().get().uri(path, id);
    if (token != null) {
      request.header("Authorization", "Bearer " + token);
    }
    return request.exchange();
  }

  private RestTestClient.ResponseSpec createEstablishment(String token, String type, String slug) {
    return http()
        .post()
        .uri("/api/v1/establishments")
        .contentType(MediaType.APPLICATION_JSON)
        .header("Authorization", "Bearer " + token)
        .body(Map.of("name", "Local " + slug, "type", type, "slug", slug))
        .exchange();
  }

  private RestTestClient http() {
    return RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
  }

  private String admin(UUID userId, String tenantId) {
    return tokens
        .issue(
            new AuthenticatedUser(
                userId,
                TenantId.of(tenantId),
                "admin@" + tenantId + ".test",
                "Vertical Integration Tester",
                UserRole.ADMIN))
        .value();
  }

  private void tenant(String id, String vertical) {
    jdbc.update(
        "insert into tenant (id, name, slug, status, vertical) values (?, ?, ?, 'ACTIVE', ?)",
        id,
        "Empresa " + id,
        id,
        vertical);
  }

  private void user(UUID id, String tenantId, String email) {
    jdbc.update(
        "insert into app_user (id, tenant_id, email, password_hash, full_name, role) values (?, ?, ?, 'unused', 'Vertical Tester', 'ADMIN')",
        id,
        tenantId,
        email);
  }

  private void establishment(UUID id, String tenantId, String type, String slug) {
    jdbc.update(
        "insert into establishment (id, tenant_id, name, type, slug) values (?, ?, ?, ?, ?)",
        id,
        tenantId,
        "Local " + slug,
        type,
        slug);
  }

  private static UUID uuid(String value) {
    return UUID.fromString(value);
  }

  @TestConfiguration
  static class TenantFlags {

    @Bean
    @Primary
    FeatureFlagPort featureFlags() {
      return new FeatureFlagPort() {
        @Override
        public boolean isEnabled(FeatureFlag flag) {
          return flag.valorPorDefecto();
        }

        @Override
        public boolean isEnabled(FeatureFlag flag, boolean defaultValue) {
          return defaultValue;
        }

        @Override
        public boolean isEnabledFor(FeatureFlag flag, TenantId tenantId) {
          return !APAGADAS.contains(flag.clave() + "@" + tenantId.value());
        }
      };
    }
  }
}
