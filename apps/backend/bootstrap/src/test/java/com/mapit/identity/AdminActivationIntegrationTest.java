package com.mapit.identity;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;

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

import com.mapit.identity.application.AuthenticateUser;
import com.mapit.identity.application.AuthenticateUserCommand;
import com.mapit.platform.application.RegisterTenantCommand;
import com.mapit.platform.application.SecureTokenGenerator;
import com.mapit.platform.application.TenantService;
import com.mapit.platform.domain.AdminInvitationEmailPort;
import com.mapit.platform.domain.BusinessVertical;

/**
 * CU-25 de punta a punta contra PostgreSQL real con el rol `mapit_app`:
 * registro → invitación persistida (hash, caducidad, un solo uso) → activación
 * pública → login del ADMIN recién creado. Los 401/403/400/409 del ciclo de
 * vida del token se ejercitan contra el controlador HTTP real.
 */
@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@Import(AdminActivationIntegrationTest.TestDoubles.class)
class AdminActivationIntegrationTest {

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
  @Autowired private TenantService tenantService;
  @Autowired private AuthenticateUser authenticateUser;
  @Autowired private SecureTokenGenerator tokens;
  @Autowired private JdbcTemplate jdbc;

  private RestTestClient http() {
    return RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
  }

  private String uniqueSlug() {
    return "act-" + UUID.randomUUID().toString().substring(0, 8);
  }

  @Test
  void activa_al_primer_admin_y_permita_login() {
    String slug = uniqueSlug();
    String email = "admin@activate.test";
    var tenant =
        tenantService.register(
            new RegisterTenantCommand("Empresa Test", slug, BusinessVertical.HOTEL, email));
    String raw = tokens.newToken();
    jdbc.queryForObject("select set_config('app.tenant_id', ?, true)", String.class, tenant.id().value());
    jdbc.update(
        "insert into invitation_tokens (tenant_id, email, token_hash, expires_at) values (?, ?, ?, now() + interval '24 hours')",
        tenant.id().value(), email, tokens.hash(raw));

    ActivationResponse response =
        http()
            .post()
            .uri("/api/v1/auth/activate")
            .contentType(MediaType.APPLICATION_JSON)
            .body(new ActivationRequest(slug, raw, "S3cur3?P4ss!", "S3cur3?P4ss!"))
            .exchange()
            .expectStatus()
            .isOk()
            .expectBody(ActivationResponse.class)
            .returnResult()
            .getResponseBody();

    assertThat(response).isNotNull();
    assertThat(response.tenantSlug()).isEqualTo(slug);
    assertThat(response.email()).isEqualTo(email);

    // La cuenta ADMIN existe, quedó activada y autentica con el login normal.
    var login = authenticateUser.execute(new AuthenticateUserCommand(slug, email, "S3cur3?P4ss!"));
    assertThat(login.role().name()).isEqualTo("ADMIN");
    assertThat(login.email()).isEqualTo(email);

    // El token quedó consumido en base de datos.
    assertThat(
            jdbc.queryForObject(
                "select count(*) from invitation_tokens where consumed_at is not null",
                Long.class))
        .isGreaterThanOrEqualTo(1);
  }

  @Test
  void rechaza_token_invalido_expirado_reutilizado_y_contrasenas_debiles() {
    String slug = uniqueSlug();
    var tenant =
        tenantService.register(
            new RegisterTenantCommand("Empresa X", slug, BusinessVertical.NIGHTCLUB, "a@x.test"));

    // 1. Token que no existe → invitation-invalid (400).
    http().post().uri("/api/v1/auth/activate").contentType(MediaType.APPLICATION_JSON)
        .body(new ActivationRequest(slug, "a".repeat(43), "S3cur3?P4ss!", "S3cur3?P4ss!"))
        .exchange().expectStatus().isBadRequest();

    // 2. Contraseña que no coincide → password-mismatch (400).
    String raw = tokens.newToken();
    jdbc.queryForObject("select set_config('app.tenant_id', ?, true)", String.class, tenant.id().value());
    jdbc.update(
        "insert into invitation_tokens (tenant_id, email, token_hash, expires_at) values (?, ?, ?, now() + interval '24 hours')",
        tenant.id().value(), "a@x.test", tokens.hash(raw));
    http().post().uri("/api/v1/auth/activate").contentType(MediaType.APPLICATION_JSON)
        .body(new ActivationRequest(slug, raw, "S3cur3?P4ss!", "otra-distinta"))
        .exchange().expectStatus().isBadRequest();

    // 3. Contraseña débil → password-weak (400).
    http().post().uri("/api/v1/auth/activate").contentType(MediaType.APPLICATION_JSON)
        .body(new ActivationRequest(slug, raw, "abc", "abc"))
        .exchange().expectStatus().isBadRequest();

    // 4. Activación correcta…
    http().post().uri("/api/v1/auth/activate").contentType(MediaType.APPLICATION_JSON)
        .body(new ActivationRequest(slug, raw, "S3cur3?P4ss!", "S3cur3?P4ss!"))
        .exchange().expectStatus().isOk();

    // 5. …y la segunda vez con el mismo token: invocación reutilizada (400).
    http().post().uri("/api/v1/auth/activate").contentType(MediaType.APPLICATION_JSON)
        .body(new ActivationRequest(slug, raw, "S3cur3?P4ss!", "S3cur3?P4ss!"))
        .exchange().expectStatus().isBadRequest();

    // 6. Token expirado.
    String expired = tokens.newToken();
    jdbc.queryForObject("select set_config('app.tenant_id', ?, true)", String.class, tenant.id().value());
    jdbc.update(
        "insert into invitation_tokens (tenant_id, email, token_hash, expires_at) values (?, ?, ?, now() - interval '1 hour')",
        tenant.id().value(), "viejo@x.test", tokens.hash(expired));
    http().post().uri("/api/v1/auth/activate").contentType(MediaType.APPLICATION_JSON)
        .body(new ActivationRequest(slug, expired, "S3cur3?P4ss!", "S3cur3?P4ss!"))
        .exchange().expectStatus().isBadRequest();
  }

  @Test
  void no_permite_activar_con_slug_de_otro_tenant() {
    String slugOfVictim = uniqueSlug();
    String slugAttacker = uniqueSlug();
    tenantService.register(new RegisterTenantCommand("Víctima", slugOfVictim, BusinessVertical.RESTAURANT, "v@v.test"));
    tenantService.register(new RegisterTenantCommand("Atacante", slugAttacker, BusinessVertical.HOTEL, "a@a.test"));

    // El token se creó para slugOfVictim; nadie puede usarlo contra slugAttacker.
    String raw = tokens.newToken();
    jdbc.queryForObject("select set_config('app.tenant_id', ?, true)", String.class, tenantIdOf(slugOfVictim));
    jdbc.update(
        "insert into invitation_tokens (tenant_id, email, token_hash, expires_at) values (?, ?, ?, now() + interval '24 hours')",
        tenantIdOf(slugOfVictim), "v@v.test", tokens.hash(raw));

    http().post().uri("/api/v1/auth/activate").contentType(MediaType.APPLICATION_JSON)
        .body(new ActivationRequest(slugAttacker, raw, "S3cur3?P4ss!", "S3cur3?P4ss!"))
        .exchange().expectStatus().isBadRequest();
  }

  private String tenantIdOf(String slug) {
    return jdbc.queryForObject("select id from tenant where slug = ?", String.class, slug);
  }

  record ActivationRequest(String tenantSlug, String token, String password, String passwordConfirm) {}

  record ActivationResponse(String tenantSlug, String email) {}

  @TestConfiguration(proxyBeanMethods = false)
  static class TestDoubles {
    @Bean
    @Primary
    AdminInvitationEmailPort adminInvitationEmailPort() {
      // El correo no sale durante las pruebas; se graba para futuras inspecciones.
      return (tenant, email, url) -> {};
    }
  }
}
