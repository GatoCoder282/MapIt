package com.mapit.platform;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
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
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.mapit.identity.domain.AccessTokenIssuer;
import com.mapit.identity.domain.AuthenticatedUser;
import com.mapit.identity.domain.UserRole;
import com.mapit.platform.domain.BusinessApplicationDecisionEmailPort;
import com.mapit.platform.domain.BusinessApplicationStatus;
import com.mapit.platform.domain.BusinessApplicationVerificationEmailPort;
import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagPort;
import com.mapit.shared.tenant.TenantId;

/** MAP-262: recepción y verificación públicas con persistencia real y rate limit compartido. */
@Tag("integration")
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(BusinessApplicationApiIntegrationTest.EnabledFlag.class)
class BusinessApplicationApiIntegrationTest {
  private static final String PASSWORD = "business_application_api_test";
  private static final AtomicBoolean ENABLED = new AtomicBoolean(false);
  private static final String PATH = "/api/v1/public/business-applications";
  private static final String BODY = """
      {"businessName":"Hotel Norte","vertical":"HOTEL","location":"Cochabamba",
       "contactName":"Ana Pérez","contactEmail":"Ana@Example.com"}
      """;

  @Container
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine")
      .withDatabaseName("mapit").withUsername("mapit").withPassword("test_password");

  @DynamicPropertySource
  static void properties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", () -> "mapit_app");
    registry.add("spring.datasource.password", () -> PASSWORD);
    registry.add("spring.flyway.url", POSTGRES::getJdbcUrl);
    registry.add("spring.flyway.user", POSTGRES::getUsername);
    registry.add("spring.flyway.password", POSTGRES::getPassword);
    registry.add("spring.flyway.placeholders.mapitAppDbPassword", () -> PASSWORD);
    registry.add("mapit.super-admin.password", () -> "");
    registry.add("mapit.unleash.enabled", () -> "false");
    registry.add("mapit.realtime.outbox.poll-interval-ms", () -> "3600000");
  }

  @LocalServerPort int port;
  @Autowired JdbcTemplate jdbc;
  @Autowired PlatformTransactionManager transactions;
  @Autowired AccessTokenIssuer tokens;
  @MockitoBean BusinessApplicationVerificationEmailPort email;
  @MockitoBean BusinessApplicationDecisionEmailPort decisionEmail;

  @Test
  void solicitud_duplicada_es_neutra_no_crea_tenant_y_token_se_consumen_una_vez() {
    ENABLED.set(false);
    var http = http();
    Long tenantsBefore = jdbc.queryForObject("select count(*) from tenant", Long.class);
    http.post().uri(PATH).body(BODY.replace("Ana@Example.com", "correo-invalido"))
        .exchange().expectStatus().isBadRequest();
    http.post().uri(PATH).body(BODY).exchange().expectStatus().isEqualTo(503);
    ENABLED.set(true);
    http.post().uri(PATH).body(BODY).exchange().expectStatus().isAccepted();
    http.post().uri(PATH).body(BODY).exchange().expectStatus().isAccepted();

    new TransactionTemplate(transactions).executeWithoutResult(status -> {
      jdbc.queryForObject("select set_config('app.tenant_id', 'platform', true)", String.class);
      assertThat(jdbc.queryForObject("select count(*) from business_application", Long.class)).isEqualTo(1);
      assertThat(jdbc.queryForObject("select count(*) from tenant", Long.class)).isEqualTo(tenantsBefore);
    });

    ArgumentCaptor<String> urls = ArgumentCaptor.forClass(String.class);
    verify(email, times(2)).send(anyString(), anyString(), urls.capture());
    String firstToken = urls.getAllValues().get(0).split("#token=")[1];
    String latestToken = urls.getAllValues().get(1).split("#token=")[1];
    http.post().uri(PATH + "/verify-contact").body("{\"token\":\"" + firstToken + "\"}")
        .exchange().expectStatus().isAccepted();
    http.post().uri(PATH + "/verify-contact").body("{\"token\":\"" + latestToken + "\"}")
        .exchange().expectStatus().isAccepted();

    new TransactionTemplate(transactions).executeWithoutResult(status -> {
      jdbc.queryForObject("select set_config('app.tenant_id', 'platform', true)", String.class);
      assertThat(jdbc.queryForObject(
          "select count(*) from business_application where contact_verified_at is not null", Long.class))
          .isEqualTo(1);
    });
    // El contador usa la IP de la conexión, no la cabecera que controle el cliente.
    for (int i = 0; i < 8; i++) {
      http.post().uri(PATH).body(BODY.replace("Ana@Example.com", "ana" + i + "@example.com"))
          .exchange().expectStatus().isAccepted();
    }
    http.post().uri(PATH).header("X-Forwarded-For", "203.0.113.12")
        .body(BODY.replace("Ana@Example.com", "otra@example.com"))
        .exchange().expectStatus().isEqualTo(429);

    // Rollback del toggle: nuevas altas se cierran, pero la revisión y la
    // trazabilidad de solicitudes anteriores siguen disponibles.
    ENABLED.set(false);
    http.post().uri(PATH).body(BODY.replace("Ana@Example.com", "despues@example.com"))
        .exchange().expectStatus().isEqualTo(503);
    UUID actor = UUID.randomUUID();
    UUID applicationId = new TransactionTemplate(transactions).execute(status -> {
      jdbc.queryForObject("select set_config('app.tenant_id', 'platform', true)", String.class);
      jdbc.update("""
          insert into app_user (id, tenant_id, email, password_hash, full_name, role)
          values (?, 'platform', ?, 'unused-test-hash', 'Super Admin', 'SUPER_ADMIN')
          """, actor, "rollback-" + actor + "@example.test");
      return jdbc.queryForObject("select id from business_application where contact_email = 'ana@example.com'",
          UUID.class);
    });
    String bearer = "Bearer " + tokens.issue(new AuthenticatedUser(actor, TenantId.of("platform"),
        "rollback@example.test", "Super Admin", UserRole.SUPER_ADMIN)).value();
    http.get().uri("/api/v1/business-applications?search=Hotel%20Norte")
        .header("Authorization", bearer).exchange().expectStatus().isOk();
    http.get().uri("/api/v1/business-applications/" + applicationId)
        .header("Authorization", bearer).exchange().expectStatus().isOk();
    http.post().uri("/api/v1/business-applications/" + applicationId + "/reject")
        .header("Authorization", bearer).body("{\"reason\":\"Datos insuficientes\"}")
        .exchange().expectStatus().isOk();
    verify(decisionEmail, times(1)).send("ana@example.com", "Hotel Norte", BusinessApplicationStatus.REJECTED);
    new TransactionTemplate(transactions).executeWithoutResult(status -> {
      jdbc.queryForObject("select set_config('app.tenant_id', 'platform', true)", String.class);
      assertThat(jdbc.queryForObject("select status from business_application where id = ?",
          String.class, applicationId)).isEqualTo("REJECTED");
      assertThat(jdbc.queryForObject("select count(*) from tenant", Long.class)).isEqualTo(tenantsBefore);
    });
  }

  private RestTestClient http() {
    return RestTestClient.bindToServer().baseUrl("http://localhost:" + port)
        .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE).build();
  }

  @TestConfiguration(proxyBeanMethods = false)
  static class EnabledFlag {
    @Bean @Primary FeatureFlagPort businessApplicationFlags() {
      return new FeatureFlagPort() {
        @Override public boolean isEnabled(FeatureFlag flag) {
          return flag == FeatureFlag.BUSINESS_APPLICATIONS && ENABLED.get();
        }
        @Override public boolean isEnabled(FeatureFlag flag, boolean fallback) {
          return isEnabled(flag);
        }
      };
    }
  }
}
