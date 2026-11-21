package com.mapit.platform;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
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
import com.mapit.shared.tenant.TenantId;

/** MAP-264: la bandeja usa RLS de platform y autorización real por rol. */
@Tag("integration")
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class BusinessApplicationReviewIntegrationTest {
  @Container
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine")
      .withDatabaseName("mapit").withUsername("mapit").withPassword("test_password");

  @DynamicPropertySource
  static void properties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", () -> "mapit_app");
    registry.add("spring.datasource.password", () -> "review_test_password");
    registry.add("spring.flyway.url", POSTGRES::getJdbcUrl);
    registry.add("spring.flyway.user", POSTGRES::getUsername);
    registry.add("spring.flyway.password", POSTGRES::getPassword);
    registry.add("spring.flyway.placeholders.mapitAppDbPassword", () -> "review_test_password");
    registry.add("mapit.super-admin.password", () -> "");
    registry.add("mapit.unleash.enabled", () -> "false");
    registry.add("mapit.realtime.outbox.poll-interval-ms", () -> "3600000");
  }

  @LocalServerPort int port;
  @Autowired JdbcTemplate jdbc;
  @Autowired PlatformTransactionManager transactions;
  @Autowired AccessTokenIssuer tokens;

  @Test
  void solo_super_admin_ve_listado_filtrado_y_detalle_sin_hash() {
    UUID id = UUID.randomUUID();
    new TransactionTemplate(transactions).executeWithoutResult(tx -> {
      jdbc.queryForObject("select set_config('app.tenant_id', 'platform', true)", String.class);
      jdbc.update("""
          insert into business_application
          (id, tenant_id, business_name, vertical, location, contact_name, contact_email,
           verification_token_hash, verification_expires_at)
          values (?, 'platform', 'Hotel MAP264', 'HOTEL', 'La Paz', 'Ana', 'ana264@example.com', ?, now() + interval '1 day')
          """, id, "a".repeat(64));
    });
    RestTestClient http = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
    http.get().uri("/api/v1/business-applications").exchange().expectStatus().isUnauthorized();
    http.get().uri("/api/v1/business-applications/" + id).exchange().expectStatus().isUnauthorized();
    String admin = token(UserRole.ADMIN);
    http.get().uri("/api/v1/business-applications").header("Authorization", "Bearer " + admin)
        .exchange().expectStatus().isForbidden();
    http.get().uri("/api/v1/business-applications/" + id).header("Authorization", "Bearer " + admin)
        .exchange().expectStatus().isForbidden();

    String superAdmin = token(UserRole.SUPER_ADMIN);
    String page = http.get().uri("/api/v1/business-applications?status=PENDING&search=MAP264")
        .header("Authorization", "Bearer " + superAdmin)
        .exchange().expectStatus().isOk().expectBody(String.class).returnResult().getResponseBody();
    assertThat(page).contains(id.toString(), "Hotel MAP264", "\"totalElements\":1");
    assertThat(page).doesNotContain("verificationTokenHash", "a".repeat(64));
    String detail = http.get().uri("/api/v1/business-applications/" + id)
        .header("Authorization", "Bearer " + superAdmin)
        .exchange().expectStatus().isOk().expectBody(String.class).returnResult().getResponseBody();
    assertThat(detail).contains("ana264@example.com", "Hotel MAP264");
    assertThat(detail).doesNotContain("verificationTokenHash", "a".repeat(64));
    http.get().uri("/api/v1/business-applications/" + UUID.randomUUID())
        .header("Authorization", "Bearer " + superAdmin)
        .exchange().expectStatus().isNotFound();
  }

  private String token(UserRole role) {
    return tokens.issue(new AuthenticatedUser(UUID.randomUUID(), TenantId.of("auth-a"),
        "review@example.test", "Reviewer", role)).value();
  }
}
