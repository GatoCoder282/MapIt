package com.mapit.platform;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;

import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
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
import com.mapit.platform.domain.AdminInvitationEmailPort;
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
  @MockitoBean AdminInvitationEmailPort invitationEmail;

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

  @Test
  void decision_crea_tenant_invitacion_y_auditoria_una_sola_vez() {
    UUID actor = UUID.randomUUID();
    UUID approvedId = UUID.randomUUID();
    UUID rejectedId = UUID.randomUUID();
    new TransactionTemplate(transactions).executeWithoutResult(tx -> {
      jdbc.queryForObject("select set_config('app.tenant_id', 'platform', true)", String.class);
      jdbc.update("""
          insert into app_user (id, tenant_id, email, password_hash, full_name, role)
          values (?, 'platform', ?, 'unused-test-hash', 'Super Admin', 'SUPER_ADMIN')
          """, actor, "decider-" + actor + "@example.test");
      for (UUID id : new UUID[] {approvedId, rejectedId}) {
        jdbc.update("""
            insert into business_application
              (id, tenant_id, business_name, vertical, location, contact_name, contact_email,
               contact_verified_at)
            values (?, 'platform', ?, 'HOTEL', 'La Paz', 'Ana', ?, now())
            """, id, "Hotel " + id, "owner-" + id + "@example.test");
      }
    });
    RestTestClient http = RestTestClient.bindToServer().baseUrl("http://localhost:" + port)
        .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE).build();
    String approval = "/api/v1/business-applications/" + approvedId + "/approve";
    String rejection = "/api/v1/business-applications/" + rejectedId + "/reject";
    http.post().uri(approval).body("{\"slug\":\"hotel-map265\"}")
        .exchange().expectStatus().isUnauthorized();
    http.post().uri(approval).header("Authorization", "Bearer " + token(UserRole.ADMIN))
        .body("{\"slug\":\"hotel-map265\"}").exchange().expectStatus().isForbidden();
    String authorization = "Bearer " + tokens.issue(new AuthenticatedUser(actor, TenantId.of("platform"),
        "decider@example.test", "Super Admin", UserRole.SUPER_ADMIN)).value();
    http.post().uri(approval).header("Authorization", authorization)
        .body("{\"slug\":\"hotel-map265\"}").exchange().expectStatus().isOk();
    http.post().uri(approval).header("Authorization", authorization)
        .body("{\"slug\":\"hotel-map265\"}").exchange().expectStatus().isOk();
    http.post().uri(rejection).header("Authorization", authorization)
        .body("{\"reason\":\"Datos insuficientes\"}").exchange().expectStatus().isOk();
    http.post().uri(rejection).header("Authorization", authorization)
        .body("{\"reason\":\"Datos insuficientes\"}").exchange().expectStatus().isOk();
    http.post().uri(rejection).header("Authorization", authorization)
        .body("{\"reason\":\"Otro motivo\"}").exchange().expectStatus().isEqualTo(409);

    new TransactionTemplate(transactions).executeWithoutResult(tx -> {
      jdbc.queryForObject("select set_config('app.tenant_id', 'platform', true)", String.class);
      assertThat(jdbc.queryForObject("select count(*) from business_application where status = 'APPROVED' and id = ?",
          Integer.class, approvedId)).isEqualTo(1);
      assertThat(jdbc.queryForObject("select count(*) from audit_log where tenant_id = 'platform' and resource_id in (?, ?)",
          Integer.class, approvedId, rejectedId)).isEqualTo(2);
      String tenant = jdbc.queryForObject("select approved_tenant_id from business_application where id = ?",
          String.class, approvedId);
      assertThat(jdbc.queryForObject("select count(*) from tenant where id = ? and slug = 'hotel-map265'",
          Integer.class, tenant)).isEqualTo(1);
      jdbc.queryForObject("select set_config('app.tenant_id', ?, true)", String.class, tenant);
      assertThat(jdbc.queryForObject("select count(*) from invitation_tokens where tenant_id = ?",
          Integer.class, tenant)).isEqualTo(1);
    });
  }

  @Test
  void aprobaciones_concurrentes_crean_un_solo_tenant_y_una_sola_auditoria() throws Exception {
    UUID actor = UUID.randomUUID();
    UUID id = UUID.randomUUID();
    new TransactionTemplate(transactions).executeWithoutResult(tx -> {
      jdbc.queryForObject("select set_config('app.tenant_id', 'platform', true)", String.class);
      jdbc.update("""
          insert into app_user (id, tenant_id, email, password_hash, full_name, role)
          values (?, 'platform', ?, 'unused-test-hash', 'Super Admin', 'SUPER_ADMIN')
          """, actor, "race-" + actor + "@example.test");
      jdbc.update("""
          insert into business_application
            (id, tenant_id, business_name, vertical, location, contact_name, contact_email,
             contact_verified_at)
          values (?, 'platform', 'Hotel Race', 'HOTEL', 'La Paz', 'Ana', ?, now())
          """, id, "race-" + id + "@example.test");
    });
    String bearer = "Bearer " + tokens.issue(new AuthenticatedUser(actor, TenantId.of("platform"),
        "race@example.test", "Super Admin", UserRole.SUPER_ADMIN)).value();
    RestTestClient http = RestTestClient.bindToServer().baseUrl("http://localhost:" + port)
        .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE).build();
    CountDownLatch start = new CountDownLatch(1);
    try (var pool = Executors.newFixedThreadPool(2)) {
      var first = CompletableFuture.runAsync(() -> approveConcurrently(http, bearer, id, start), pool);
      var second = CompletableFuture.runAsync(() -> approveConcurrently(http, bearer, id, start), pool);
      start.countDown();
      CompletableFuture.allOf(first, second).get(20, TimeUnit.SECONDS);
    }
    new TransactionTemplate(transactions).executeWithoutResult(tx -> {
      jdbc.queryForObject("select set_config('app.tenant_id', 'platform', true)", String.class);
      assertThat(jdbc.queryForObject("select count(*) from tenant where slug = 'hotel-race265'",
          Integer.class)).isEqualTo(1);
      assertThat(jdbc.queryForObject("select count(*) from audit_log where resource_id = ?",
          Integer.class, id)).isEqualTo(1);
    });
  }

  @Test
  void fallo_de_invitacion_revierte_tenant_y_decision() {
    UUID actor = UUID.randomUUID();
    UUID id = UUID.randomUUID();
    new TransactionTemplate(transactions).executeWithoutResult(tx -> {
      jdbc.queryForObject("select set_config('app.tenant_id', 'platform', true)", String.class);
      jdbc.update("""
          insert into app_user (id, tenant_id, email, password_hash, full_name, role)
          values (?, 'platform', ?, 'unused-test-hash', 'Super Admin', 'SUPER_ADMIN')
          """, actor, "failure-" + actor + "@example.test");
      jdbc.update("""
          insert into business_application
            (id, tenant_id, business_name, vertical, location, contact_name, contact_email,
             contact_verified_at)
          values (?, 'platform', 'Hotel Rollback', 'HOTEL', 'La Paz', 'Ana', ?, now())
          """, id, "failure-" + id + "@example.test");
    });
    doThrow(new IllegalStateException("correo indisponible"))
        .when(invitationEmail).send(any(), anyString(), anyString());
    String bearer = "Bearer " + tokens.issue(new AuthenticatedUser(actor, TenantId.of("platform"),
        "failure@example.test", "Super Admin", UserRole.SUPER_ADMIN)).value();
    RestTestClient http = RestTestClient.bindToServer().baseUrl("http://localhost:" + port)
        .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE).build();
    http.post().uri("/api/v1/business-applications/" + id + "/approve")
        .header("Authorization", bearer).body("{\"slug\":\"hotel-rollback265\"}")
        .exchange().expectStatus().isEqualTo(503);
    new TransactionTemplate(transactions).executeWithoutResult(tx -> {
      jdbc.queryForObject("select set_config('app.tenant_id', 'platform', true)", String.class);
      assertThat(jdbc.queryForObject("select status from business_application where id = ?",
          String.class, id)).isEqualTo("PENDING");
      assertThat(jdbc.queryForObject("select count(*) from tenant where slug = 'hotel-rollback265'",
          Integer.class)).isZero();
      assertThat(jdbc.queryForObject("select count(*) from audit_log where resource_id = ?",
          Integer.class, id)).isZero();
    });
  }

  private static void approveConcurrently(RestTestClient http, String bearer, UUID id, CountDownLatch start) {
    try {
      start.await();
      http.post().uri("/api/v1/business-applications/" + id + "/approve")
          .header("Authorization", bearer).body("{\"slug\":\"hotel-race265\"}")
          .exchange().expectStatus().isOk();
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException(interrupted);
    }
  }

  private String token(UserRole role) {
    return tokens.issue(new AuthenticatedUser(UUID.randomUUID(), TenantId.of("auth-a"),
        "review@example.test", "Reviewer", role)).value();
  }
}
