package com.mapit.platform;

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
import org.springframework.http.HttpStatus;
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
import com.mapit.platform.domain.AdminInvitationEmailPort;
import com.mapit.shared.tenant.TenantId;

/**
 * Ciclo de vida de tenants contra la configuraciÃ³n REAL de seguridad: sin JWT es
 * 401, con JWT de otro rol es 403, y solo SUPER_ADMIN opera la administraciÃ³n.
 */
@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@Import(TenantAdministrationIntegrationTest.TestDoubles.class)
class TenantAdministrationIntegrationTest {

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
    registry.add("mapit.super-admin.password", () -> "");
  }

  @LocalServerPort private int port;
  @Autowired private JdbcTemplate jdbcTemplate;
  @Autowired private AccessTokenIssuer tokens;

  private RestTestClient client() {
    return RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
  }

  private String tokenFor(UserRole role) {
    return tokens
        .issue(
            new AuthenticatedUser(
                UUID.randomUUID(), TenantId.of("auth-a"), "tester@example.test", "Tester", role))
        .value();
  }

  private static String uniqueSlug(String base) {
    return base + "-" + UUID.randomUUID().toString().substring(0, 8);
  }

  @Test
  void sin_jwt_recibe_401_en_todos_los_verbos() {
    client().get().uri("/api/v1/tenants").exchange().expectStatus().isUnauthorized();
    client().get().uri("/api/v1/tenants/cualquiera").exchange().expectStatus().isUnauthorized();
    client()
        .patch()
        .uri("/api/v1/tenants/cualquiera")
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"name\": \"X\"}")
        .exchange()
        .expectStatus()
        .isUnauthorized();
    client()
        .post()
        .uri("/api/v1/tenants")
        .contentType(MediaType.APPLICATION_JSON)
        .body(
            "{\"name\": \"X\", \"slug\": \"x-sa-no\", \"vertical\": \"HOTEL\", \"administratorEmail\": \"a@b.c\"}")
        .exchange()
        .expectStatus()
        .isUnauthorized();
  }

  @Test
  void roles_de_negocio_reciben_403() {
    for (UserRole role : new UserRole[] {UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF}) {
      String token = tokenFor(role);
      client()
          .get()
          .uri("/api/v1/tenants")
          .header("Authorization", "Bearer " + token)
          .exchange()
          .expectStatus()
          .isForbidden();
      client()
          .post()
          .uri("/api/v1/tenants")
          .header("Authorization", "Bearer " + token)
          .contentType(MediaType.APPLICATION_JSON)
          .body(
              "{\"name\": \"X\", \"slug\": \"x-sa-forb\", \"vertical\": \"HOTEL\", \"administratorEmail\": \"a@b.c\"}")
          .exchange()
          .expectStatus()
          .isForbidden();
    }
  }

  @Test
  void super_admin_ejecuta_el_ciclo_completo() {
    String slug = uniqueSlug("sa-flow");
    String token = tokenFor(UserRole.SUPER_ADMIN);

    TenantView created =
        client()
            .post()
            .uri("/api/v1/tenants")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .body(
                new TenantRequestView(
                    "Empresa SA", slug, "RESTAURANT", "admin@sa-test.bo"))
            .exchange()
            .expectStatus()
            .isCreated()
            .expectBody(TenantView.class)
            .returnResult()
            .getResponseBody();
    assertThat(created).isNotNull();
    assertThat(created.status()).isEqualTo("PENDING_APPROVAL");

    // Listado: sin filtro y con bÃºsqueda por fragmento de nombre/slug.
    TenantPageView page =
        client()
            .get()
            .uri(uri -> uri.path("/api/v1/tenants").queryParam("search", "empresa sa").build())
            .header("Authorization", "Bearer " + token)
            .exchange()
            .expectStatus()
            .isOk()
            .expectBody(TenantPageView.class)
            .returnResult()
            .getResponseBody();
    assertThat(page).isNotNull();
    assertThat(page.content()).extracting(TenantView::slug).contains(slug);

    // Detalle.
    client()
        .get()
        .uri("/api/v1/tenants/" + created.id())
        .header("Authorization", "Bearer " + token)
        .exchange()
        .expectStatus()
        .isOk();

    // PATCH: solo name; slug y vertical permanecen.
    TenantView renamed =
        client()
            .patch()
            .uri("/api/v1/tenants/" + created.id())
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .body("{\"name\": \"Empresa SA Renombrada\"}")
            .exchange()
            .expectStatus()
            .isOk()
            .expectBody(TenantView.class)
            .returnResult()
            .getResponseBody();
    assertThat(renamed).isNotNull();
    assertThat(renamed.name()).isEqualTo("Empresa SA Renombrada");
    assertThat(renamed.slug()).isEqualTo(slug);
    assertThat(renamed.vertical()).isEqualTo("RESTAURANT");

    // Aprobar, suspender y reactivar; volver a aprobación es 400.
    TenantView approved =
        patchStatus(created.id(), "ACTIVE", token).expectStatus().isOk()
            .expectBody(TenantView.class).returnResult().getResponseBody();
    assertThat(approved).isNotNull();
    assertThat(approved.status()).isEqualTo("ACTIVE");
    patchStatus(created.id(), "PENDING_APPROVAL", token).expectStatus().isBadRequest();
    TenantView suspended =
        patchStatus(created.id(), "SUSPENDED", token).expectStatus().isOk()
            .expectBody(TenantView.class).returnResult().getResponseBody();
    assertThat(suspended).isNotNull();
    assertThat(suspended.status()).isEqualTo("SUSPENDED");
    TenantView reactivated =
        patchStatus(created.id(), "ACTIVE", token).expectStatus().isOk()
            .expectBody(TenantView.class).returnResult().getResponseBody();
    assertThat(reactivated).isNotNull();
    assertThat(reactivated.status()).isEqualTo("ACTIVE");

    // 404 al editar algo que no existe.
    patchStatus("no-existe", "SUSPENDED", token).expectStatus().isNotFound();
  }

  @Test
  void filtros_por_estado_y_slug_duplicado_409() {
    String slug = uniqueSlug("sa-conflict");
    String token = tokenFor(UserRole.SUPER_ADMIN);
    String body =
        java.text.MessageFormat.format(
            "'{'\"name\": \"Dup\", \"slug\": \"{0}\", \"vertical\": \"HOTEL\", \"administratorEmail\": \"d@d.bo\"'}'",
            slug);

    client().post().uri("/api/v1/tenants")
        .header("Authorization", "Bearer " + token)
        .contentType(MediaType.APPLICATION_JSON).body(body)
        .exchange().expectStatus().isCreated();
    client().post().uri("/api/v1/tenants")
        .header("Authorization", "Bearer " + token)
        .contentType(MediaType.APPLICATION_JSON).body(body)
        .exchange().expectStatus().isEqualTo(HttpStatus.CONFLICT);

    TenantPageView suspendedOnly =
        client().get().uri("/api/v1/tenants?status=SUSPENDED")
            .header("Authorization", "Bearer " + token)
            .exchange().expectStatus().isOk()
            .expectBody(TenantPageView.class).returnResult().getResponseBody();
    assertThat(suspendedOnly).isNotNull();
    assertThat(suspendedOnly.content())
        .allSatisfy(t -> assertThat(t.status()).isEqualTo("SUSPENDED"));

    // PaginaciÃ³n invÃ¡lida: 400, no 500.
    client().get().uri("/api/v1/tenants?size=101")
        .header("Authorization", "Bearer " + token)
        .exchange().expectStatus().isBadRequest();
  }

  private RestTestClient.ResponseSpec patchStatus(String id, String status, String token) {
    return client()
        .patch()
        .uri("/api/v1/tenants/" + id)
        .header("Authorization", "Bearer " + token)
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"status\": \"" + status + "\"}")
        .exchange();
  }

  record TenantRequestView(String name, String slug, String vertical, String administratorEmail) {}

  record TenantView(
      String id,
      String name,
      String slug,
      String vertical,
      String status,
      String createdAt,
      String updatedAt) {}

  record TenantPageView(
      java.util.List<TenantView> content, int page, int size, long totalElements, int totalPages) {}

  @TestConfiguration(proxyBeanMethods = false)
  static class TestDoubles {

    @Bean
    @Primary
    AdminInvitationEmailPort adminInvitationEmailPort() {
      return (tenant, email, url) -> {};
    }
  }
}
