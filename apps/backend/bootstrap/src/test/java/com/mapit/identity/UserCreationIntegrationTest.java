package com.mapit.identity;


import java.util.UUID;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
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
import com.mapit.shared.tenant.TenantId;

/**
 * MAP-185: POST /api/v1/users contra la configuración real. Matriz de
 * autorización por rol (SUPER_ADMIN cross-tenant, ADMIN solo STAFF en su
 * tenant, MANAGER/STAFF 403) con duplicados, escalación y payload completo.
 */
@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class UserCreationIntegrationTest {

  @Container
  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16-alpine")
          .withDatabaseName("mapit")
          .withUsername("mapit")
          .withPassword("test_password");

  @DynamicPropertySource
  static void databaseProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.flyway.url", POSTGRES::getJdbcUrl);
    registry.add("spring.flyway.user", POSTGRES::getUsername);
    registry.add("spring.flyway.password", POSTGRES::getPassword);
    registry.add("spring.flyway.placeholders.mapitAppDbPassword", () -> "test_app_password");
  }

  @LocalServerPort private int port;
  @Autowired private AccessTokenIssuer tokens;
  @Autowired private JdbcTemplate jdbc;

  private RestTestClient http() {
    return RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
  }

  private String token(UserRole role, String tenantId) {
    return tokens
        .issue(new AuthenticatedUser(UUID.randomUUID(), TenantId.of(tenantId),
            "u@t.test", "Tester", role))
        .value();
  }

  private String createTenant(String slug) {
    jdbc.update("insert into tenant (id, name, slug, status, vertical) values (?, ?, ?, 'ACTIVE', 'RESTAURANT') on conflict (id) do nothing",
        slug, "Empresa", slug);
    return slug;
  }

  private record CreateUserBody(String tenantSlug, String email, String fullName, String password, String role) {}

  private CreateUserBody staff(String email, String slug) {
    return new CreateUserBody(slug, email, "Operador Uno", "S3cur3?P4ss!", "STAFF");
  }

  @Test
  void super_admin_crea_admin_en_cualquier_tenant_y_admin_crea_staff_en_el_suyo() {
    String tenantA = createTenant("ua-a-" + UUID.randomUUID().toString().substring(0, 8));
    String tenantB = createTenant("ua-b-" + UUID.randomUUID().toString().substring(0, 8));

    // SUPER_ADMIN crea ADMIN en el tenantB (sin ser de allí).
    http().post().uri("/api/v1/users")
        .header("Authorization", "Bearer " + token(UserRole.SUPER_ADMIN, "platform"))
        .contentType(MediaType.APPLICATION_JSON)
        .body(new CreateUserBody(tenantB, "dueno@b.test", "Dueño B", "S3cur3?P4ss!", "ADMIN"))
        .exchange().expectStatus().isCreated();

    // ADMIN del tenantB crea STAFF en su tenant (sin indicar slug).
    http().post().uri("/api/v1/users")
        .header("Authorization", "Bearer " + token(UserRole.ADMIN, tenantB))
        .contentType(MediaType.APPLICATION_JSON)
        .body(new CreateUserBody(null, "staff@b.test", "Staff B", "S3cur3?P4ss!", "STAFF"))
        .exchange().expectStatus().isCreated();

    // Duplicado en el mismo tenant → 409.
    http().post().uri("/api/v1/users")
        .header("Authorization", "Bearer " + token(UserRole.ADMIN, tenantB))
        .contentType(MediaType.APPLICATION_JSON)
        .body(new CreateUserBody(null, "staff@b.test", "Otro", "S3cur3?P4ss!", "STAFF"))
        .exchange().expectStatus().isEqualTo(409);

    // Mismo correo, otro tenant → permitido (regla: único por tenant, no global).
    http().post().uri("/api/v1/users")
        .header("Authorization", "Bearer " + token(UserRole.SUPER_ADMIN, "platform"))
        .contentType(MediaType.APPLICATION_JSON)
        .body(new CreateUserBody(tenantA, "staff@b.test", "Otro Staff", "S3cur3?P4ss!", "STAFF"))
        .exchange().expectStatus().isCreated();
  }

  @Test
  void escalacion_y_cross_tenant_y_roles_bajos_son_403() {
    String tenantA = createTenant("ub-a-" + UUID.randomUUID().toString().substring(0, 8));

    // ADMIN no crea ADMIN (ni MANAGER): escalación de privilegios.
    http().post().uri("/api/v1/users")
        .header("Authorization", "Bearer " + token(UserRole.ADMIN, tenantA))
        .contentType(MediaType.APPLICATION_JSON)
        .body(new CreateUserBody(null, "x@a.test", "X", "S3cur3?P4ss!", "ADMIN"))
        .exchange().expectStatus().isForbidden();

    // ADMIN no puede escribir en otro tenant aunque lo anuncie.
    http().post().uri("/api/v1/users")
        .header("Authorization", "Bearer " + token(UserRole.ADMIN, tenantA))
        .contentType(MediaType.APPLICATION_JSON)
        .body(new CreateUserBody("otro-tenant", "y@a.test", "Y", "S3cur3?P4ss!", "STAFF"))
        .exchange().expectStatus().isForbidden();

    // STAFF y MANAGER no crean a nadie.
    for (UserRole role : new UserRole[] {UserRole.STAFF, UserRole.MANAGER}) {
      http().post().uri("/api/v1/users")
          .header("Authorization", "Bearer " + token(role, tenantA))
          .contentType(MediaType.APPLICATION_JSON)
          .body(new CreateUserBody(null, "z@a.test", "Z", "S3cur3?P4ss!", "STAFF"))
          .exchange().expectStatus().isForbidden();
    }

    // Nadie crea SUPER_ADMIN por API.
    http().post().uri("/api/v1/users")
        .header("Authorization", "Bearer " + token(UserRole.SUPER_ADMIN, "platform"))
        .contentType(MediaType.APPLICATION_JSON)
        .body(new CreateUserBody(tenantA, "s@a.test", "S", "S3cur3?P4ss!", "SUPER_ADMIN"))
        .exchange().expectStatus().isForbidden();
  }

  @Test
  void sin_jwt_es_401_y_contrasena_debil_es_400() {
    http().post().uri("/api/v1/users")
        .contentType(MediaType.APPLICATION_JSON)
        .body(staff("q@a.test", null))
        .exchange().expectStatus().isUnauthorized();

    String tenant = createTenant("uc-" + UUID.randomUUID().toString().substring(0, 8));
    http().post().uri("/api/v1/users")
        .header("Authorization", "Bearer " + token(UserRole.ADMIN, tenant))
        .contentType(MediaType.APPLICATION_JSON)
        .body(new CreateUserBody(null, "w@a.test", "W", "abc", "STAFF"))
        .exchange().expectStatus().isBadRequest();
  }
}
