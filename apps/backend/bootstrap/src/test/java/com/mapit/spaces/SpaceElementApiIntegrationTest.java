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

/**
 * Contrato HTTP de extremo a extremo de los elementos espaciales (HU-2.03 / MAP-115):
 * petición → seguridad → controller → service → JPA → Postgres del contenedor, y de vuelta.
 *
 * <p>La ruta aún es pública (igual que el resto de CU-04/CU-05 hasta CU-23/CU-24), así que
 * el tenant activo es el fallback {@code demo} de {@code SecurityTenantContext}. El test
 * de aislamiento RLS entre tenants es {@link SpaceElementTenantIsolationIntegrationTest}.
 */
@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class SpaceElementApiIntegrationTest {

  @Container
  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16-alpine")
          .withDatabaseName("mapit")
          .withUsername("mapit")
          .withPassword("test_password");

  private static final String TENANT = "demo";
  private static final UUID ESTABLISHMENT_ID =
      UUID.fromString("80000000-0000-0000-0000-000000000001");
  private static final UUID FLOOR_ID = UUID.fromString("80000000-0000-0000-0000-000000000002");
  private static final UUID SECTOR_ID = UUID.fromString("80000000-0000-0000-0000-000000000003");
  private static final UUID SECTOR_EVENT_HALL_ID =
      UUID.fromString("80000000-0000-0000-0000-000000000004");
  private static final UUID EST_EVENT_HALL =
      UUID.fromString("80000000-0000-0000-0000-000000000005");
  private static final UUID FLOOR_EVENT_HALL_ID =
      UUID.fromString("80000000-0000-0000-0000-000000000006");

  @LocalServerPort private int port;

  @Autowired private JdbcTemplate jdbcTemplate;

  private RestTestClient client() {
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
  }

  @BeforeEach
  void fixtures() {
    // Encadena demo → establishment → floor → sector en la base real del contenedor.
    jdbcTemplate.update(
        "insert into tenant (id, name, slug, status, vertical) values (?, ?, ?, 'ACTIVE', 'RESTAURANT') "
            + "on conflict (id) do nothing",
        TENANT, "Demo", "demo");
    jdbcTemplate.update(
        "insert into establishment (id, tenant_id, name, type, slug) values (?, ?, ?, 'RESTAURANT', 'est-api') "
            + "on conflict (id) do nothing",
        ESTABLISHMENT_ID, TENANT, "Restaurante API");
    jdbcTemplate.update(
        "insert into establishment (id, tenant_id, name, type, slug) values (?, ?, ?, 'EVENT_HALL', 'est-api-hall') "
            + "on conflict (id) do nothing",
        EST_EVENT_HALL, TENANT, "Salón de eventos API");
    jdbcTemplate.update(
        "delete from space_element where tenant_id = ?", TENANT);
    jdbcTemplate.update(
        "insert into floor (id, tenant_id, establishment_id, name, level, slug) values (?, ?, ?, 'Planta Baja', 1, 'pb-api') "
            + "on conflict do nothing",
        FLOOR_ID, TENANT, ESTABLISHMENT_ID);
    jdbcTemplate.update(
        "insert into floor (id, tenant_id, establishment_id, name, level, slug) values (?, ?, ?, 'Planta Hall', 1, 'planta-hall-api') "
            + "on conflict do nothing",
        FLOOR_EVENT_HALL_ID, TENANT, EST_EVENT_HALL);
    jdbcTemplate.update(
        "insert into sector (id, tenant_id, floor_id, name, slug, max_capacity) values (?, ?, ?, 'Zona principal', 'zona-api', 40) "
            + "on conflict do nothing",
        SECTOR_ID, TENANT, FLOOR_ID);
    jdbcTemplate.update(
        "insert into sector (id, tenant_id, floor_id, name, slug, max_capacity) values (?, ?, ?, 'Platea', 'platea-api', 200) "
            + "on conflict do nothing",
        SECTOR_EVENT_HALL_ID, TENANT, FLOOR_EVENT_HALL_ID);
  }

  // ===== CA-1 — alta válida =====

  @Test
  void arranque_con_la_migracion_aplicada() {
    // Que el contexto de Spring arranque ya valida Flyway + ddl-auto: validate con V12.
    Long tablas = jdbcTemplate.queryForObject(
        "select count(*) from information_schema.tables where table_name = 'space_element'",
        Long.class);
    assertThat(tablas).isEqualTo(1L);
  }

  @Test
  void alta_valida_devuelve_201_y_aislado_persiste() {
    var creado = client()
        .post()
        .uri("/api/v1/sectors/{s}/elements", SECTOR_ID)
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"type\":\"TABLE\",\"x\":12.5,\"y\":8}")
        .exchange()
        .expectStatus()
        .isCreated()
        .expectBody(ElementoJson.class)
        .returnResult()
        .getResponseBody();
    assertThat(creado).isNotNull();
    assertThat(creado.state()).isEqualTo("AVAILABLE");
    assertThat(creado.type()).isEqualTo("TABLE");

    assertThat(jdbcTemplate.queryForObject(
        "select count(*) from space_element where tenant_id = ? and sector_id = ? and type = 'TABLE'",
        Long.class, TENANT, SECTOR_ID)).isEqualTo(1L);
  }

  @Test
  void get_lista_solo_los_del_sector() {
    alta(9, 9);
    alta(3, 3);
    List<ElementoJson> lista = List.of(client()
        .get()
        .uri("/api/v1/sectors/{s}/elements", SECTOR_ID)
        .exchange()
        .expectStatus()
        .isOk()
        .expectBody(ElementoJson[].class)
        .returnResult()
        .getResponseBody());
    assertThat(lista).hasSizeGreaterThanOrEqualTo(2);
  }

  // ===== CA-2/CA-3 — sector inexistente =====

  @Test
  void sector_inexistente_devuelve_404() {
    client()
        .post()
        .uri("/api/v1/sectors/{s}/elements", UUID.randomUUID())
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"type\":\"TABLE\",\"x\":1,\"y\":1}")
        .exchange()
        .expectStatus()
        .isNotFound()
        .expectHeader()
        .contentTypeCompatibleWith("application/problem+json");
  }

  // ===== CA-4 — validación por vertical =====

  @Test
  void room_en_un_restaurante_es_400_y_butaca_en_salon_es_201() {
    client()
        .post()
        .uri("/api/v1/sectors/{s}/elements", SECTOR_ID)
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"type\":\"ROOM\",\"x\":1,\"y\":1}")
        .exchange()
        .expectStatus()
        .isBadRequest();

    client()
        .post()
        .uri("/api/v1/sectors/{s}/elements", SECTOR_EVENT_HALL_ID)
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"type\":\"SEAT\",\"x\":1,\"y\":1}")
        .exchange()
        .expectStatus()
        .isCreated();
  }

  // ===== CA-5/CA-6 — payload inválido =====

  @Test
  void payload_invalido_o_incompleto_es_400() {
    client()
        .post()
        .uri("/api/v1/sectors/{s}/elements", SECTOR_ID)
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"type\":\"DRAGON\",\"x\":1,\"y\":1}")
        .exchange()
        .expectStatus()
        .isBadRequest();

    client()
        .post()
        .uri("/api/v1/sectors/{s}/elements", SECTOR_ID)
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"x\":1,\"y\":1}")
        .exchange()
        .expectStatus()
        .isBadRequest();
  }

  // ===== CA-7/CA-8 — PUT =====

  @Test
  void put_actualiza_y_conserva_estado() {
    var creado = alta(5, 5);
    var actualizado = client()
        .put()
        .uri("/api/v1/sectors/{s}/elements/{e}", SECTOR_ID, creado.id())
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"type\":\"BAR\",\"x\":7,\"y\":7}")
        .exchange()
        .expectStatus()
        .isOk()
        .expectBody(ElementoJson.class)
        .returnResult()
        .getResponseBody();
    assertThat(actualizado).isNotNull();
    assertThat(actualizado.type()).isEqualTo("BAR");
    assertThat(actualizado.state()).isEqualTo(creado.state());
  }

  @Test
  void put_a_inexistente_o_ajeno_es_404() {
    client()
        .put()
        .uri("/api/v1/sectors/{s}/elements/{e}", SECTOR_ID, UUID.randomUUID())
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"type\":\"TABLE\",\"x\":1,\"y\":1}")
        .exchange()
        .expectStatus()
        .isNotFound();
  }

  // ===== Utilidades =====

  private ElementoJson alta(double x, double y) {
    var estado = client()
        .post()
        .uri("/api/v1/sectors/{s}/elements", SECTOR_ID)
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"type\":\"TABLE\",\"x\":" + x + ",\"y\":" + y + "}")
        .exchange()
        .expectStatus()
        .isCreated()
        .expectBody(ElementoJson.class)
        .returnResult()
        .getResponseBody();
    assertThat(estado).isNotNull();
    return estado;
  }

  public record ElementoJson(
      UUID id,
      UUID sectorId,
      String type,
      double x,
      double y,
      String state,
      java.time.Instant createdAt,
      java.time.Instant updatedAt) {}
}
