package com.mapit.platform;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashMap;
import java.util.Map;
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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.mapit.identity.domain.AccessTokenIssuer;
import com.mapit.identity.domain.AuthenticatedUser;
import com.mapit.identity.domain.UserRole;
import com.mapit.reservations.application.history.CustomerHistoryPolicy;
import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagPort;
import com.mapit.shared.tenant.TenantId;

/** HU-7.07 · MAP-303/MAP-306: permisos, flag, validación, auditoría y efecto real. */
@Tag("integration")
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(PlatformSettingsIntegrationTest.Flags.class)
class PlatformSettingsIntegrationTest {

  @Container
  static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:17-alpine")
          .withDatabaseName("mapit")
          .withUsername("mapit")
          .withPassword("test_password");

  private static final String LINK = "customer-history.link-ttl-minutes";
  private static final UUID SUPER_ADMIN = UUID.fromString("73000000-0000-0000-0000-000000000001");
  private static final AtomicBoolean ENABLED = new AtomicBoolean(true);

  @DynamicPropertySource
  static void properties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", () -> "mapit_app");
    registry.add("spring.datasource.password", () -> "settings_test_password");
    registry.add("spring.flyway.url", POSTGRES::getJdbcUrl);
    registry.add("spring.flyway.user", POSTGRES::getUsername);
    registry.add("spring.flyway.password", POSTGRES::getPassword);
    registry.add("spring.flyway.placeholders.mapitAppDbPassword", () -> "settings_test_password");
    registry.add("mapit.super-admin.password", () -> "");
    registry.add("mapit.unleash.enabled", () -> "false");
    registry.add("mapit.realtime.outbox.poll-interval-ms", () -> "3600000");
  }

  @LocalServerPort int port;
  @Autowired JdbcTemplate jdbc;
  @Autowired PlatformTransactionManager transactions;
  @Autowired AccessTokenIssuer tokens;
  @Autowired CustomerHistoryPolicy historyPolicy;

  @BeforeEach
  void reset() {
    ENABLED.set(true);
    // El rol de runtime no puede borrar la bitácora: solo se limpia la tabla de valores.
    jdbc.update("delete from platform_setting");
    new TransactionTemplate(transactions)
        .executeWithoutResult(
            tx -> {
              jdbc.queryForObject(
                  "select set_config('app.tenant_id', 'platform', true)", String.class);
              jdbc.update(
                  """
                  insert into app_user (id, tenant_id, email, password_hash, full_name, role)
                  values (?, 'platform', 'settings@mapit.test', 'unused', 'Sofía Plataforma', 'SUPER_ADMIN')
                  on conflict do nothing
                  """,
                  SUPER_ADMIN);
            });
  }

  @Test
  void solo_super_admin_accede() {
    http().get().uri("/api/v1/platform/settings").exchange().expectStatus().isUnauthorized();
    http().get().uri("/api/v1/platform/settings/changes").exchange().expectStatus().isUnauthorized();
    for (UserRole role : new UserRole[] {UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER}) {
      get("/api/v1/platform/settings", token(role, "demo")).expectStatus().isForbidden();
      change(LINK, 20, 15, "Motivo suficientemente largo", token(role, "demo"))
          .expectStatus()
          .isForbidden();
    }
    assertThat(saved()).isZero();
  }

  @Test
  void la_consulta_expone_la_allowlist_sin_secretos() {
    String body =
        get("/api/v1/platform/settings", superAdmin())
            .expectStatus()
            .isOk()
            .expectBody(String.class)
            .returnResult()
            .getResponseBody();

    assertThat(body)
        .contains(LINK, "customer-history.session-ttl-minutes", "customer-history.ip-limit")
        .contains("mapit.s6.platform-settings", "\"flagProvider\":\"DISABLED\"")
        .contains("\"databaseAvailable\":true")
        .doesNotContainIgnoringCase("secret", "password", "token", "jdbc:", "unleash-insecure");
  }

  @Test
  void un_cambio_persiste_rige_sin_reiniciar_y_queda_auditado() {
    assertThat(historyPolicy.linkMinutes()).isEqualTo(15);

    change(LINK, 45, 15, "  Los clientes piden más tiempo  ", superAdmin())
        .expectStatus()
        .isOk()
        .expectBody()
        .jsonPath("$.value").isEqualTo(45)
        .jsonPath("$.defaultValue").isEqualTo(15)
        .jsonPath("$.overridden").isEqualTo(true);

    assertThat(historyPolicy.linkMinutes()).isEqualTo(45);
    assertThat(historyPolicy.sessionMinutes()).isEqualTo(30);

    change(LINK, null, 45, "Se vuelve a la política original", superAdmin())
        .expectStatus()
        .isOk()
        .expectBody()
        .jsonPath("$.value").isEqualTo(15)
        .jsonPath("$.overridden").isEqualTo(false);

    get("/api/v1/platform/settings/changes", superAdmin())
        .expectStatus()
        .isOk()
        .expectBody()
        .jsonPath("$[0].previousValue").isEqualTo("45")
        .jsonPath("$[0].newValue").isEqualTo("15")
        .jsonPath("$[1].newValue").isEqualTo("45")
        .jsonPath("$[1].reason").isEqualTo("Los clientes piden más tiempo")
        .jsonPath("$[1].actorName").isEqualTo("Sofía Plataforma");
  }

  @Test
  void rechaza_clave_valor_o_motivo_invalidos_sin_escribir() {
    String superAdmin = superAdmin();
    change("jwt.secret", 20, 15, "Motivo suficientemente largo", superAdmin)
        .expectStatus()
        .isNotFound();
    change(LINK, 4, 15, "Motivo suficientemente largo", superAdmin).expectStatus().isBadRequest();
    change(LINK, 61, 15, "Motivo suficientemente largo", superAdmin).expectStatus().isBadRequest();
    change(LINK, 20, 15, "corto", superAdmin).expectStatus().isBadRequest();
    change(LINK, 20, 15, "          ", superAdmin).expectStatus().isBadRequest();
    assertThat(saved()).isZero();
  }

  @Test
  void un_valor_obsoleto_recibe_conflicto() {
    String superAdmin = superAdmin();
    change(LINK, 20, 15, "Primer ajuste de vigencia", superAdmin).expectStatus().isOk();

    change(LINK, 25, 15, "Segundo ajuste con pantalla vieja", superAdmin)
        .expectStatus()
        .isEqualTo(409)
        .expectBody()
        .jsonPath("$.type").isEqualTo("https://mapit.local/problems/platform-setting-conflict");

    assertThat(historyPolicy.linkMinutes()).isEqualTo(20);
  }

  @Test
  void con_la_flag_apagada_responde_404_y_rigen_los_valores_del_despliegue() {
    String superAdmin = superAdmin();
    change(LINK, 50, 15, "Ajuste previo al apagado", superAdmin).expectStatus().isOk();

    ENABLED.set(false);

    get("/api/v1/platform/settings", superAdmin)
        .expectStatus()
        .isNotFound()
        .expectBody()
        .jsonPath("$.type").isEqualTo("https://mapit.local/problems/platform-settings-disabled");
    change(LINK, 30, 50, "No debe aplicarse apagada", superAdmin).expectStatus().isNotFound();
    assertThat(historyPolicy.linkMinutes()).isEqualTo(15);
    // El valor no se borra: al volver a encender rige de nuevo.
    ENABLED.set(true);
    assertThat(historyPolicy.linkMinutes()).isEqualTo(50);
  }

  private RestTestClient http() {
    return RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
  }

  private RestTestClient.ResponseSpec get(String path, String token) {
    return http().get().uri(path).header("Authorization", "Bearer " + token).exchange();
  }

  private RestTestClient.ResponseSpec change(
      String key, Integer value, int expected, String reason, String token) {
    Map<String, Object> body = new HashMap<>();
    body.put("value", value);
    body.put("expectedValue", expected);
    body.put("reason", reason);
    return http()
        .put()
        .uri("/api/v1/platform/settings/{key}", key)
        .header("Authorization", "Bearer " + token)
        .contentType(MediaType.APPLICATION_JSON)
        .body(body)
        .exchange();
  }

  private int saved() {
    return jdbc.queryForObject("select count(*) from platform_setting", Integer.class);
  }

  private String superAdmin() {
    return token(UserRole.SUPER_ADMIN, "platform");
  }

  /** El filtro JWT exige que el usuario exista, así que cada rol se da de alta de verdad. */
  private String token(UserRole role, String tenant) {
    UUID id = role == UserRole.SUPER_ADMIN ? SUPER_ADMIN : UUID.randomUUID();
    String email = role == UserRole.SUPER_ADMIN ? "settings@mapit.test" : id + "@mapit.test";
    if (role != UserRole.SUPER_ADMIN) {
      new TransactionTemplate(transactions)
          .executeWithoutResult(
              tx -> {
                jdbc.queryForObject(
                    "select set_config('app.tenant_id', ?, true)", String.class, tenant);
                jdbc.update(
                    "insert into app_user (id, tenant_id, email, password_hash, full_name, role) values (?, ?, ?, 'unused', 'Operador', ?)",
                    id,
                    tenant,
                    email,
                    role.name());
              });
    }
    return tokens
        .issue(new AuthenticatedUser(id, TenantId.of(tenant), email, "Sofía Plataforma", role))
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
          return flag == FeatureFlag.MAPIT_S6_PLATFORM_SETTINGS
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
