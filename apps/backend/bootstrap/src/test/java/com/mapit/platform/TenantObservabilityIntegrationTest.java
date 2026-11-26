package com.mapit.platform;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

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
import org.springframework.jdbc.datasource.DriverManagerDataSource;
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
 * HU-7.08 · MAP-309/MAP-312: permisos, flag, ausencia de datos personales, supresión,
 * aislamiento entre empresas y registro de accesos inalterable.
 */
@Tag("integration")
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TenantObservabilityIntegrationTest.Flags.class)
class TenantObservabilityIntegrationTest {

  @Container
  static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:17-alpine")
          .withDatabaseName("mapit")
          .withUsername("mapit")
          .withPassword("test_password");

  private static final String ROOT = "/api/v1/platform/observability";
  private static final String BIG = "obs-grande";
  private static final String SMALL = "obs-pequena";
  private static final UUID SUPER_ADMIN = UUID.fromString("74000000-0000-0000-0000-000000000001");
  private static final AtomicBoolean ENABLED = new AtomicBoolean(true);
  private static boolean seeded;

  @DynamicPropertySource
  static void properties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", () -> "mapit_app");
    registry.add("spring.datasource.password", () -> "obs_test_password");
    registry.add("spring.flyway.url", POSTGRES::getJdbcUrl);
    registry.add("spring.flyway.user", POSTGRES::getUsername);
    registry.add("spring.flyway.password", POSTGRES::getPassword);
    registry.add("spring.flyway.placeholders.mapitAppDbPassword", () -> "obs_test_password");
    registry.add("mapit.super-admin.password", () -> "");
    registry.add("mapit.unleash.enabled", () -> "false");
    registry.add("mapit.realtime.outbox.poll-interval-ms", () -> "3600000");
  }

  @LocalServerPort int port;
  @Autowired JdbcTemplate runtime;
  @Autowired AccessTokenIssuer tokens;

  private JdbcTemplate owner;

  @BeforeEach
  void seed() {
    ENABLED.set(true);
    owner =
        new JdbcTemplate(
            new DriverManagerDataSource(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()));
    owner.update("delete from platform_access_log");
    if (seeded) {
      return;
    }
    seeded = true;
    user(SUPER_ADMIN, "platform", "obs-super@mapit.test", "SUPER_ADMIN");
    tenant(BIG, "Casa Grande", 12);
    tenant(SMALL, "Casa Chica", 2);
  }

  @Test
  void solo_super_admin_accede() {
    for (String path : new String[] {ROOT, ROOT + "/tenants", ROOT + "/tenants/" + BIG}) {
      http().get().uri(path).exchange().expectStatus().isUnauthorized();
      for (UserRole role : new UserRole[] {UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER}) {
        get(path, member(role)).expectStatus().isForbidden();
      }
    }
    assertThat(accesses()).isZero();
  }

  @Test
  void ninguna_vista_expone_datos_personales_ni_financieros() {
    String superAdmin = superAdmin();
    for (String path : new String[] {ROOT, ROOT + "/tenants", ROOT + "/tenants/" + BIG}) {
      String body =
          get(path, superAdmin)
              .expectStatus()
              .isOk()
              .expectBody(String.class)
              .returnResult()
              .getResponseBody();
      assertThat(body)
          .doesNotContain("Persona Secreta", "secreta@cliente.test", "+591 7000999")
          .doesNotContain("operador@", "Operador Interno")
          .doesNotContainIgnoringCase("password", "token", "qr", "amount", "email", "phone");
    }
  }

  @Test
  void el_resumen_agrega_por_estado_y_dia_sin_deducir_conteos_pequenos() {
    get(ROOT + "?days=7", superAdmin())
        .expectStatus()
        .isOk()
        .expectBody()
        .jsonPath("$.activeTenants").value(Integer.class, count -> assertThat(count).isGreaterThanOrEqualTo(2))
        .jsonPath("$.suppressionThreshold").isEqualTo(5)
        .jsonPath("$.databaseAvailable").isEqualTo(true)
        .jsonPath("$.reservations.value").isEqualTo(14)
        // 12 CREATED + 2 CANCELLED: el pequeño arrastra al siguiente para que no se reste.
        .jsonPath("$.reservationsByStatus.CANCELLED.suppressed").isEqualTo(true)
        .jsonPath("$.reservationsByStatus.CANCELLED.value").doesNotExist()
        .jsonPath("$.reservationsByStatus.CREATED.suppressed").isEqualTo(true);

    get(ROOT + "?days=14", superAdmin()).expectStatus().isBadRequest();
  }

  @Test
  void el_listado_pagina_filtra_y_suprime_por_empresa() {
    String superAdmin = superAdmin();
    get(ROOT + "/tenants?search=casa grande", superAdmin)
        .expectStatus()
        .isOk()
        .expectBody()
        .jsonPath("$.totalElements").isEqualTo(1)
        .jsonPath("$.content[0].tenant.slug").isEqualTo(BIG)
        .jsonPath("$.content[0].reservations.value").isEqualTo(12)
        .jsonPath("$.content[0].alerts[0]").isEqualTo("DELIVERY_FAILURES");
    get(ROOT + "/tenants?search=casa chica", superAdmin)
        .expectStatus()
        .isOk()
        .expectBody()
        .jsonPath("$.content[0].reservations.suppressed").isEqualTo(true)
        .jsonPath("$.content[0].reservations.value").doesNotExist()
        .jsonPath("$.content[0].alerts.length()").isEqualTo(0);
    get(ROOT + "/tenants?search=platform", superAdmin)
        .expectStatus()
        .isOk()
        .expectBody()
        .jsonPath("$.totalElements").isEqualTo(0);
  }

  @Test
  void el_detalle_es_de_una_sola_empresa() {
    String superAdmin = superAdmin();
    get(ROOT + "/tenants/" + BIG, superAdmin)
        .expectStatus()
        .isOk()
        .expectBody()
        .jsonPath("$.reservations.value").isEqualTo(12)
        .jsonPath("$.establishmentsByVertical.RESTAURANT").isEqualTo(1)
        .jsonPath("$.failingDeliveries").isEqualTo(1)
        .jsonPath("$.paymentMethodEnabled").isEqualTo(false);
    get(ROOT + "/tenants/no-existe", superAdmin).expectStatus().isNotFound();
    get(ROOT + "/tenants/platform", superAdmin).expectStatus().isNotFound();
  }

  @Test
  void con_la_flag_apagada_no_responde_ni_registra() {
    ENABLED.set(false);

    get(ROOT, superAdmin())
        .expectStatus()
        .isNotFound()
        .expectBody()
        .jsonPath("$.type").isEqualTo("https://mapit.local/problems/tenant-observability-disabled");
    assertThat(accesses()).isZero();
  }

  @Test
  void cada_consulta_se_registra_y_el_registro_no_se_puede_alterar() {
    String superAdmin = superAdmin();
    get(ROOT, superAdmin).expectStatus().isOk();
    get(ROOT + "/tenants", superAdmin).expectStatus().isOk();
    get(ROOT + "/tenants/" + BIG, superAdmin).expectStatus().isOk();

    assertThat(
            owner.queryForList(
                "select view || ':' || coalesce(subject_tenant_id, '-') from platform_access_log order by occurred_at",
                String.class))
        .containsExactly("OVERVIEW:-", "TENANT_LIST:-", "TENANT_DETAIL:" + BIG);
    assertThatThrownBy(() -> runtime.update("delete from platform_access_log"))
        .hasStackTraceContaining("permission denied");
    assertThatThrownBy(() -> runtime.update("update platform_access_log set view = 'OVERVIEW'"))
        .hasStackTraceContaining("permission denied");
  }

  /** Empresa con un local, un cliente, {@code reservations} reservas y datos personales. */
  private void tenant(String id, String name, int reservations) {
    owner.update(
        "insert into tenant (id, name, slug, status, vertical) values (?, ?, ?, 'ACTIVE', 'RESTAURANT')",
        id,
        name,
        id);
    UUID operator = UUID.randomUUID();
    user(operator, id, "operador@" + id + ".test", "ADMIN");
    UUID venue = UUID.randomUUID();
    UUID person = UUID.randomUUID();
    owner.update(
        "insert into establishment (id, tenant_id, name, type, slug) values (?, ?, 'Sede', 'RESTAURANT', 'sede')",
        venue,
        id);
    owner.update(
        "insert into person (id, tenant_id, full_name, email, phone) values (?, ?, 'Persona Secreta', 'secreta@cliente.test', '+591 7000999')",
        person,
        id);
    for (int index = 0; index < reservations; index++) {
      owner.update(
          "insert into reservation (tenant_id, establishment_id, person_id, starts_at, ends_at, status, created_by) values (?, ?, ?, now() + interval '1 day', now() + interval '2 days', ?, ?)",
          id,
          venue,
          person,
          // La empresa pequeña aporta las dos canceladas.
          reservations < 5 ? "CANCELLED" : "CREATED",
          operator);
    }
    if (reservations >= 5) {
      owner.update(
          "insert into realtime_event_outbox (event_id, tenant_id, event_type, schema_version, occurred_at, establishment_id, aggregate_version, payload, attempts) values (?, ?, 'x', 1, now(), ?, 1, '{}'::jsonb, 5)",
          UUID.randomUUID(),
          id,
          venue);
    }
  }

  private void user(UUID id, String tenant, String email, String role) {
    owner.update(
        "insert into app_user (id, tenant_id, email, password_hash, full_name, role) values (?, ?, ?, 'unused', 'Operador Interno', ?) on conflict do nothing",
        id,
        tenant,
        email,
        role);
  }

  private int accesses() {
    return owner.queryForObject("select count(*) from platform_access_log", Integer.class);
  }

  private RestTestClient http() {
    return RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
  }

  private RestTestClient.ResponseSpec get(String path, String token) {
    return http().get().uri(path).header("Authorization", "Bearer " + token).exchange();
  }

  private String superAdmin() {
    return issue(SUPER_ADMIN, "platform", "obs-super@mapit.test", UserRole.SUPER_ADMIN);
  }

  private String member(UserRole role) {
    UUID id = UUID.randomUUID();
    String email = id + "@mapit.test";
    user(id, BIG, email, role.name());
    return issue(id, BIG, email, role);
  }

  private String issue(UUID id, String tenant, String email, UserRole role) {
    return tokens
        .issue(new AuthenticatedUser(id, TenantId.of(tenant), email, "Operador Interno", role))
        .value();
  }

  @TestConfiguration
  static class Flags {
    @Bean
    @Primary
    FeatureFlagPort featureFlags() {
      return new FeatureFlagPort() {
        @Override
        public boolean isEnabled(FeatureFlag flag) {
          return flag == FeatureFlag.MAPIT_S6_TENANT_OBSERVABILITY
              ? ENABLED.get()
              : flag.valorPorDefecto();
        }

        @Override
        public boolean isEnabled(FeatureFlag flag, boolean defaultValue) {
          return isEnabled(flag);
        }
      };
    }
  }
}
