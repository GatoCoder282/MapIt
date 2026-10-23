package com.mapit.spaces;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
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
 * Contrato HTTP de extremo a extremo de las plantillas de elemento (HU-4.02 / MAP-204,
 * MAP-207): petición → seguridad JWT → controller → service → JPA → Postgres del contenedor,
 * y de vuelta.
 *
 * <p>{@code /api/v1/element-templates/**} no está en las rutas públicas: exige
 * autenticación (cualquier rol de staff), así que cada llamada lleva un JWT real emitido
 * por {@code AccessTokenIssuer}. El aislamiento entre tenants se verifica aquí a nivel HTTP
 * (404 al tocar lo ajeno) y a nivel RLS en
 * {@link ElementTemplateTenantIsolationIntegrationTest}.
 *
 * <p>El simple arranque del contexto valida la migración V16 contra {@code ddl-auto:
 * validate}.
 */
@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class ElementTemplateApiIntegrationTest {

  @Container
  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16-alpine")
          .withDatabaseName("mapit")
          .withUsername("mapit")
          .withPassword("test_password");

  private static final String TENANT_A = "template-it-a";
  private static final String TENANT_B = "template-it-b";
  private static final UUID ADMIN_A = UUID.fromString("32000000-0000-0000-0000-000000000001");
  private static final UUID ADMIN_B = UUID.fromString("32000000-0000-0000-0000-000000000002");

  @LocalServerPort private int port;
  @Autowired private JdbcTemplate jdbc;
  @Autowired private AccessTokenIssuer tokens;

  private RestTestClient http() {
    return RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
  }

  @DynamicPropertySource
  static void databaseProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.flyway.url", POSTGRES::getJdbcUrl);
    registry.add("spring.flyway.user", POSTGRES::getUsername);
    registry.add("spring.flyway.password", POSTGRES::getPassword);
    registry.add("spring.flyway.placeholders.mapitAppDbPassword", () -> "test_app_password");
    registry.add("mapit.realtime.outbox.poll-interval-ms", () -> "3600000");
    registry.add("mapit.realtime.outbox.cleanup-interval-ms", () -> "3600000");
  }

  @BeforeEach
  void fixtures() {
    jdbc.update("delete from element_template where tenant_id in (?, ?)", TENANT_A, TENANT_B);
    jdbc.update("delete from app_user where tenant_id in (?, ?)", TENANT_A, TENANT_B);
    jdbc.update("delete from tenant where id in (?, ?)", TENANT_A, TENANT_B);

    tenant(TENANT_A);
    tenant(TENANT_B);
    user(ADMIN_A, TENANT_A, "admin@template-it-a.test");
    user(ADMIN_B, TENANT_B, "admin@template-it-b.test");
  }

  // ===== Migración V16 aplicada =====

  @Test
  void arranque_con_la_migracion_aplicada() {
    // Que el contexto de Spring arranque ya valida Flyway + ddl-auto: validate con V16.
    Long tablas =
        jdbc.queryForObject(
            "select count(*) from information_schema.tables where table_name = 'element_template'",
            Long.class);
    assertThat(tablas).isEqualTo(1L);
  }

  // ===== Seguridad =====

  @Test
  void sin_jwt_devuelve_401() {
    http().get().uri("/api/v1/element-templates").exchange().expectStatus().isUnauthorized();

    http().post()
        .uri("/api/v1/element-templates")
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"name\":\"X\",\"type\":\"TABLE\"}")
        .exchange()
        .expectStatus()
        .isUnauthorized();
  }

  // ===== POST /api/v1/element-templates =====

  @Test
  void crear_valida_devuelve_201_y_persiste_aislada_al_tenant() {
    var creada =
        http().post()
            .uri("/api/v1/element-templates")
            .header("Authorization", bearer(token(ADMIN_A, TENANT_A)))
            .contentType(MediaType.APPLICATION_JSON)
            .body("{\"name\":\"Mesa redonda 6 pax\",\"type\":\"TABLE\"}")
            .exchange()
            .expectStatus()
            .isCreated()
            .expectBody(PlantillaJson.class)
            .returnResult()
            .getResponseBody();

    assertThat(creada).isNotNull();
    assertThat(creada.id()).isNotNull();
    assertThat(creada.name()).isEqualTo("Mesa redonda 6 pax");
    assertThat(creada.type()).isEqualTo("TABLE");
    assertThat(creada.createdAt()).isNotNull();
    assertThat(creada.updatedAt()).isNotNull();

    assertThat(
            jdbc.queryForObject(
                "select count(*) from element_template where tenant_id = ? and name = ? and deleted_at is null",
                Long.class,
                TENANT_A,
                "Mesa redonda 6 pax"))
        .isEqualTo(1L);
  }

  @Test
  void crear_nombre_duplicado_devuelve_409_problem() {
    alta("Barra central", "BAR");

    http().post()
        .uri("/api/v1/element-templates")
        .header("Authorization", bearer(token(ADMIN_A, TENANT_A)))
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"name\":\"barra central\",\"type\":\"BAR\"}")
        .exchange()
        .expectStatus()
        .isEqualTo(409)
        .expectHeader()
        .contentTypeCompatibleWith("application/problem+json");
  }

  @Test
  void crear_payload_invalido_devuelve_400() {
    http().post()
        .uri("/api/v1/element-templates")
        .header("Authorization", bearer(token(ADMIN_A, TENANT_A)))
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"name\":\"X\",\"type\":\"DRAGON\"}")
        .exchange()
        .expectStatus()
        .isBadRequest()
        .expectHeader()
        .contentTypeCompatibleWith("application/problem+json");

    http().post()
        .uri("/api/v1/element-templates")
        .header("Authorization", bearer(token(ADMIN_A, TENANT_A)))
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"name\":\"\",\"type\":\"TABLE\"}")
        .exchange()
        .expectStatus()
        .isBadRequest();
  }

  // ===== GET =====

  @Test
  void lista_solo_las_vivas_ordenadas_por_nombre() {
    alta("Zeta", "DECOR");
    alta("Alfa", "TABLE");
    var eliminada = alta("Eliminada", "BAR");

    http().delete()
        .uri("/api/v1/element-templates/{id}", eliminada.id())
        .header("Authorization", bearer(token(ADMIN_A, TENANT_A)))
        .exchange()
        .expectStatus()
        .isNoContent();

    List<PlantillaJson> lista =
        List.of(
            http().get()
                .uri("/api/v1/element-templates")
                .header("Authorization", bearer(token(ADMIN_A, TENANT_A)))
                .exchange()
                .expectStatus()
                .isOk()
                .expectBody(PlantillaJson[].class)
                .returnResult()
                .getResponseBody());

    assertThat(lista).hasSize(2);
    assertThat(lista.get(0).name()).isEqualTo("Alfa");
    assertThat(lista.get(1).name()).isEqualTo("Zeta");
  }

  @Test
  void get_por_id_devuelve_la_plantilla_y_404_si_no_existe() {
    var creada = alta("Butaca numerada", "SEAT");

    http().get()
        .uri("/api/v1/element-templates/{id}", creada.id())
        .header("Authorization", bearer(token(ADMIN_A, TENANT_A)))
        .exchange()
        .expectStatus()
        .isOk()
        .expectBody()
        .jsonPath("$.name")
        .isEqualTo("Butaca numerada");

    http().get()
        .uri("/api/v1/element-templates/{id}", UUID.randomUUID())
        .header("Authorization", bearer(token(ADMIN_A, TENANT_A)))
        .exchange()
        .expectStatus()
        .isNotFound()
        .expectHeader()
        .contentTypeCompatibleWith("application/problem+json");
  }

  // ===== Aislamiento entre tenants a nivel HTTP =====

  @Test
  void tenant_b_no_puede_leer_modificar_ni_borrar_plantillas_de_a() {
    var deA = alta("Privada de A", "ROOM");
    String tokenB = bearer(token(ADMIN_B, TENANT_B));

    http().get()
        .uri("/api/v1/element-templates/{id}", deA.id())
        .header("Authorization", tokenB)
        .exchange()
        .expectStatus()
        .isNotFound();

    http().put()
        .uri("/api/v1/element-templates/{id}", deA.id())
        .header("Authorization", tokenB)
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"name\":\"Robada\",\"type\":\"BAR\"}")
        .exchange()
        .expectStatus()
        .isNotFound();

    http().delete()
        .uri("/api/v1/element-templates/{id}", deA.id())
        .header("Authorization", tokenB)
        .exchange()
        .expectStatus()
        .isNotFound();

    // La plantilla de A sigue intacta.
    assertThat(
            jdbc.queryForObject(
                "select name from element_template where id = ?", String.class, deA.id()))
        .isEqualTo("Privada de A");
  }

  // ===== PUT =====

  @Test
  void put_reemplaza_nombre_y_tipo() {
    var creada = alta("Original", "TABLE");

    var actualizada =
        http().put()
            .uri("/api/v1/element-templates/{id}", creada.id())
            .header("Authorization", bearer(token(ADMIN_A, TENANT_A)))
            .contentType(MediaType.APPLICATION_JSON)
            .body("{\"name\":\"Actualizada\",\"type\":\"BAR\"}")
            .exchange()
            .expectStatus()
            .isOk()
            .expectBody(PlantillaJson.class)
            .returnResult()
            .getResponseBody();

    assertThat(actualizada).isNotNull();
    assertThat(actualizada.id()).isEqualTo(creada.id());
    assertThat(actualizada.name()).isEqualTo("Actualizada");
    assertThat(actualizada.type()).isEqualTo("BAR");
  }

  @Test
  void put_a_inexistente_devuelve_404() {
    http().put()
        .uri("/api/v1/element-templates/{id}", UUID.randomUUID())
        .header("Authorization", bearer(token(ADMIN_A, TENANT_A)))
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"name\":\"X\",\"type\":\"TABLE\"}")
        .exchange()
        .expectStatus()
        .isNotFound();
  }

  // ===== DELETE =====

  @Test
  void delete_es_baja_logica_204_y_luego_404() {
    var creada = alta("Para borrar", "STAGE");

    http().delete()
        .uri("/api/v1/element-templates/{id}", creada.id())
        .header("Authorization", bearer(token(ADMIN_A, TENANT_A)))
        .exchange()
        .expectStatus()
        .isNoContent();

    // La fila sigue existiendo (baja lógica), pero ya no es visible por la API.
    assertThat(
            jdbc.queryForObject(
                "select count(*) from element_template where id = ? and deleted_at is not null",
                Long.class,
                creada.id()))
        .isEqualTo(1L);

    http().get()
        .uri("/api/v1/element-templates/{id}", creada.id())
        .header("Authorization", bearer(token(ADMIN_A, TENANT_A)))
        .exchange()
        .expectStatus()
        .isNotFound();

    // Tras la baja, el nombre queda libre para una plantilla nueva.
    http().post()
        .uri("/api/v1/element-templates")
        .header("Authorization", bearer(token(ADMIN_A, TENANT_A)))
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"name\":\"Para borrar\",\"type\":\"STAGE\"}")
        .exchange()
        .expectStatus()
        .isCreated();
  }

  // ===== Utilidades =====

  private PlantillaJson alta(String name, String type) {
    var creada =
        http().post()
            .uri("/api/v1/element-templates")
            .header("Authorization", bearer(token(ADMIN_A, TENANT_A)))
            .contentType(MediaType.APPLICATION_JSON)
            .body("{\"name\":\"" + name + "\",\"type\":\"" + type + "\"}")
            .exchange()
            .expectStatus()
            .isCreated()
            .expectBody(PlantillaJson.class)
            .returnResult()
            .getResponseBody();
    assertThat(creada).isNotNull();
    return creada;
  }

  private String token(UUID userId, String tenantId) {
    return tokens
        .issue(
            new AuthenticatedUser(
                userId,
                TenantId.of(tenantId),
                "admin@" + tenantId + ".test",
                "Integration Tester",
                UserRole.ADMIN))
        .value();
  }

  private static String bearer(String token) {
    return "Bearer " + token;
  }

  private void tenant(String id) {
    jdbc.update(
        "insert into tenant (id, name, slug, status, vertical) values (?, ?, ?, 'ACTIVE', 'RESTAURANT')",
        id,
        "Empresa " + id,
        id);
  }

  private void user(UUID id, String tenantId, String email) {
    jdbc.update(
        "insert into app_user (id, tenant_id, email, password_hash, full_name, role) values (?, ?, ?, 'unused', 'Integration Tester', 'ADMIN')",
        id,
        tenantId,
        email);
  }

  public record PlantillaJson(
      UUID id, String name, String type, java.time.Instant createdAt, java.time.Instant updatedAt) {}
}
