package com.mapit.spaces;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
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
 * Contrato HTTP de extremo a extremo del layout de plantas (HU-4.01): lectura
 * agregada (CA-1), guardado por lotes con concurrencia optimista (CA-2/CA-8),
 * duplicado de sector (CA-5) y borrado de elemento con guarda de reservas (RN-1).
 *
 * <p>Las peticiones usan un JWT ADMIN auténtico del tenant explícito {@code demo};
 * el aislamiento RLS bidireccional lo cubre la suite de aislamiento.
 */
@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class FloorLayoutApiIntegrationTest {

  @Container
  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16-alpine")
          .withDatabaseName("mapit")
          .withUsername("mapit")
          .withPassword("test_password");

  private static final String TENANT = "demo";
  private static final UUID ESTABLISHMENT_ID =
      UUID.fromString("91000000-0000-0000-0000-000000000001");
  private static final UUID FLOOR_ID = UUID.fromString("91000000-0000-0000-0000-000000000002");
  private static final UUID SECTOR_ID = UUID.fromString("91000000-0000-0000-0000-000000000003");
  private static final UUID PERSON_ID = UUID.fromString("91000000-0000-0000-0000-000000000004");
  private static final UUID ADMIN_ID = UUID.fromString("91000000-0000-0000-0000-000000000005");

  @LocalServerPort private int port;

  @Autowired private JdbcTemplate jdbcTemplate;
  @Autowired private AccessTokenIssuer tokens;

  private RestTestClient client() {
    return client(TENANT, ADMIN_ID);
  }

  private RestTestClient client(String tenant, UUID actor) {
    String token = tokens.issue(new AuthenticatedUser(
        actor, TenantId.of(tenant), "layout@example.test", "Layout tester", UserRole.ADMIN)).value();
    return RestTestClient.bindToServer().baseUrl("http://localhost:" + port)
        .defaultHeader("Authorization", "Bearer " + token).build();
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
    jdbcTemplate.update(
        "insert into tenant (id, name, slug, status, vertical) values (?, ?, ?, 'ACTIVE', 'RESTAURANT') "
            + "on conflict (id) do nothing",
        TENANT, "Demo", "demo");
    jdbcTemplate.update(
        "insert into app_user (id, tenant_id, email, password_hash, full_name, role) "
            + "values (?, ?, 'layout@example.test', 'unused', 'Layout tester', 'ADMIN') on conflict do nothing",
        ADMIN_ID, TENANT);
    jdbcTemplate.update(
        "insert into establishment (id, tenant_id, name, type, slug) values (?, ?, ?, 'RESTAURANT', 'est-layout') "
            + "on conflict (id) do nothing",
        ESTABLISHMENT_ID, TENANT, "Sede Layout");
    jdbcTemplate.update("delete from reservation_space_element where tenant_id = ?", TENANT);
    jdbcTemplate.update("delete from reservation where tenant_id = ?", TENANT);
    jdbcTemplate.update("delete from person where tenant_id = ?", TENANT);
    jdbcTemplate.update("delete from space_element where tenant_id = ?", TENANT);
    jdbcTemplate.update("delete from sector where tenant_id = ?", TENANT);
    jdbcTemplate.update("delete from floor where tenant_id = ?", TENANT);
    jdbcTemplate.update("delete from establishment where tenant_id = ?", TENANT);
    jdbcTemplate.update(
        "insert into establishment (id, tenant_id, name, type, slug) values (?, ?, ?, 'RESTAURANT', 'est-layout')",
        ESTABLISHMENT_ID, TENANT, "Sede Layout");
    jdbcTemplate.update(
        "insert into floor (id, tenant_id, establishment_id, name, level, slug) values (?, ?, ?, 'PB', 1, 'pb-layout')",
        FLOOR_ID, TENANT, ESTABLISHMENT_ID);
    jdbcTemplate.update(
        "insert into sector (id, tenant_id, floor_id, name, slug, max_capacity) values (?, ?, ?, 'Salón', 'salon-layout', 40)",
        SECTOR_ID, TENANT, FLOOR_ID);
  }

  private record SectorDto(UUID id, String name, double x, double y, double rotation,
      double width, double height, Instant updatedAt, List<ElementoJson> elements) {}

  private record FloorDto(UUID id, String name, int level, double canvasWidth,
      double canvasHeight, Instant updatedAt) {}

  private record FloorLayoutJson(FloorDto floor, List<SectorDto> sectors) {}

  private record ElementoJson(UUID id, UUID sectorId, String type, double x, double y,
      double width, double height, double rotation, String state,
      Instant createdAt, Instant updatedAt, String label, String name, Integer capacity) {}

  private record SectorLayoutJson(SectorJson sector, List<ElementoJson> elements) {}

  private record SectorJson(UUID id, String name, String slug, Integer maxCapacity,
      double x, double y, double rotation, double width, double height,
      Instant createdAt, Instant updatedAt) {}

  private UUID crearElemento(double x, double y) {
    var creado = client()
        .post()
        .uri("/api/v1/sectors/{s}/elements", SECTOR_ID)
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"type\":\"TABLE\",\"x\":" + x + ",\"y\":" + y
            + ",\"width\":80,\"height\":80,\"rotation\":0,\"label\":\"Mesa Ventana\",\"capacity\":4}")
        .exchange()
        .expectStatus()
        .isCreated()
        .expectBody(ElementoJson.class)
        .returnResult()
        .getResponseBody();
    assertThat(creado).isNotNull();
    return creado.id();
  }

  private FloorLayoutJson leerLayout() {
    var body = client()
        .get()
        .uri("/api/v1/floors/{f}/layout", FLOOR_ID)
        .exchange()
        .expectStatus()
        .isOk()
        .expectBody(FloorLayoutJson.class)
        .returnResult()
        .getResponseBody();
    assertThat(body).isNotNull();
    return body;
  }

  @Test
  void lectura_agregada_devuelve_planta_con_lienzo_y_sector_con_elementos() {
    UUID elementoId = crearElemento(10, 10);

    FloorLayoutJson layout = leerLayout();

    assertThat(layout.floor().canvasWidth()).isEqualTo(1200);
    assertThat(layout.sectors()).hasSize(1);
    SectorDto sector = layout.sectors().get(0);
    assertThat(sector.id()).isEqualTo(SECTOR_ID);
    assertThat(sector.width()).isEqualTo(800); // default de V18
    assertThat(sector.x()).isZero(); // colocación por defecto del backfill
    assertThat(sector.elements())
        .filteredOn(element -> element.id().equals(elementoId))
        .singleElement()
        .satisfies(element -> {
          assertThat(element.label()).isEqualTo("Mesa Ventana");
          assertThat(element.name()).isEqualTo("Mesa Ventana");
          assertThat(element.capacity()).isEqualTo(4);
        });
  }

  @Test
  void apariencia_se_persiste_se_comparte_y_se_limpia_al_borrar_elementos() {
    UUID element = crearElemento(30, 40);
    var initial = leerLayout().sectors().getFirst();
    client().put().uri("/api/v1/sectors/{id}/layout", SECTOR_ID)
        .contentType(MediaType.APPLICATION_JSON)
        .body("""
            {"sector":{"width":800,"height":600,"updatedAt":"%s"},"elements":[],
             "appearance":{"room":{"floorColor":"#c0ffee","wallColor":"#123456","floorPattern":"wood"},
             "elements":{"%s":{"boardMaterial":"wood","showName":true,"chairArms":false}}}}
            """.formatted(initial.updatedAt(), element))
        .exchange().expectStatus().isOk()
        .expectBody()
        .jsonPath("$.sector.appearance.room.floorColor").isEqualTo("#c0ffee");

    client().get().uri("/api/v1/floors/{id}/sectors", FLOOR_ID)
        .exchange().expectStatus().isOk()
        .expectBody().jsonPath("$[0].appearance.room.floorColor").isEqualTo("#c0ffee");
    client().get().uri("/api/v1/floors/{id}/layout", FLOOR_ID)
        .exchange().expectStatus().isOk()
        .expectBody().jsonPath("$.sectors[0].appearance.room.floorColor").isEqualTo("#c0ffee");

    var saved = leerLayout().sectors().getFirst();
    client().put().uri("/api/v1/sectors/{id}/layout", SECTOR_ID)
        .contentType(MediaType.APPLICATION_JSON)
        .body("""
            {"sector":{"width":800,"height":600,"updatedAt":"%s"},"elements":[],
             "appearance":{"elements":{"%s":{"color":"#ffffff"}}}}
            """.formatted(saved.updatedAt(), UUID.randomUUID()))
        .exchange().expectStatus().isBadRequest();

    var version = saved.elements().getFirst().updatedAt();
    client().put().uri("/api/v1/sectors/{id}/layout", SECTOR_ID)
        .contentType(MediaType.APPLICATION_JSON)
        .body("""
            {"sector":{"width":800,"height":600,"updatedAt":"%s"},"elements":[],
             "deletedElements":[{"id":"%s","updatedAt":"%s"}]}
            """.formatted(saved.updatedAt(), element, version))
        .exchange().expectStatus().isOk()
        .expectBody()
        .jsonPath("$.sector.appearance.room.floorColor").isEqualTo("#c0ffee")
        .jsonPath("$.sector.appearance.elements").isEmpty();
  }

  @Test
  void guardar_layout_mueve_el_sector_sin_tocar_sus_elementos() {
    UUID elementoId = crearElemento(30, 40);
    FloorLayoutJson antes = leerLayout();
    SectorDto sector = antes.sectors().get(0);

    client()
        .put()
        .uri("/api/v1/floors/{f}/layout", FLOOR_ID)
        .contentType(MediaType.APPLICATION_JSON)
        .body("""
          {"floor": {"canvasWidth": 1600, "canvasHeight": 900, "updatedAt": "%s"},
           "sectors": [{"id": "%s", "x": 120, "y": 80, "rotation": 0, "width": 500, "height": 350, "updatedAt": "%s"}]}
          """.formatted(antes.floor().updatedAt(), SECTOR_ID, sector.updatedAt()))
        .exchange()
        .expectStatus()
        .isOk();

    FloorLayoutJson despues = leerLayout();
    SectorDto movido = despues.sectors().get(0);
    assertThat(movido.x()).isEqualTo(120);
    assertThat(movido.rotation()).isZero();
    assertThat(movido.width()).isEqualTo(500);
    assertThat(movido.height()).isEqualTo(350);
    assertThat(despues.floor().canvasWidth()).isEqualTo(1600);
    // RN-2: el elemento no se movió (coordenadas relativas al sector)
    ElementoJson el = despues.sectors().get(0).elements().stream()
        .filter(e -> e.id().equals(elementoId)).findFirst().orElseThrow();
    assertThat(el.x()).isEqualTo(30);
    assertThat(el.y()).isEqualTo(40);
  }

  @Test
  void guardar_layout_con_version_obsoleta_devuelve_409_con_conflicto() {
    FloorLayoutJson antes = leerLayout();
    SectorDto sector = antes.sectors().get(0);

    client()
        .put()
        .uri("/api/v1/floors/{f}/layout", FLOOR_ID)
        .contentType(MediaType.APPLICATION_JSON)
        .body("""
          {"floor": {"canvasWidth": 1200, "canvasHeight": 800, "updatedAt": "%s"},
           "sectors": [{"id": "%s", "x": 10, "y": 10, "rotation": 0, "updatedAt": "2000-01-01T00:00:00Z"}]}
          """.formatted(antes.floor().updatedAt(), SECTOR_ID))
        .exchange()
        .expectStatus()
        .isEqualTo(409);
  }

  @Test
  void duplicar_sector_crea_copia_con_ids_nuevos_y_elementos_clonados() {
    UUID original = crearElemento(50, 60);

    SectorLayoutJson copia = client()
        .post()
        .uri("/api/v1/floors/{f}/sectors:duplicate", FLOOR_ID)
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"sourceSectorId\": \"%s\", \"x\": 80, \"y\": 60}".formatted(SECTOR_ID))
        .exchange()
        .expectStatus()
        .isCreated()
        .expectBody(SectorLayoutJson.class)
        .returnResult()
        .getResponseBody();

    assertThat(copia).isNotNull();
    assertThat(copia.sector().id()).isNotEqualTo(SECTOR_ID);
    assertThat(copia.sector().name()).isEqualTo("Salón (copia)");
    assertThat(leerLayout().sectors()).anySatisfy(sector -> {
      assertThat(sector.id()).isEqualTo(copia.sector().id());
      assertThat(sector.x()).isEqualTo(80);
      assertThat(sector.y()).isEqualTo(60);
    });
    assertThat(copia.elements()).hasSize(1);
    assertThat(copia.elements().get(0).id()).isNotEqualTo(original);
    assertThat(copia.elements().get(0).x()).isEqualTo(50);
    assertThat(copia.elements().get(0).state()).isEqualTo("AVAILABLE");
  }

  @Test
  void guarda_orden_visual_sin_cambiar_nivel_y_rechaza_orden_obsoleto() {
    var second = UUID.randomUUID();
    jdbcTemplate.update(
        "insert into floor (id, tenant_id, establishment_id, name, level, slug) values (?, ?, ?, 'PA', 2, 'pa-layout')",
        second, TENANT, ESTABLISHMENT_ID);
    String path = "/api/v1/establishments/" + ESTABLISHMENT_ID + "/floors";
    String request = """
        {"previousIds":["%s","%s"],"floorIds":["%s","%s"]}
        """.formatted(FLOOR_ID, second, second, FLOOR_ID);
    client().put().uri(path + "/order").contentType(MediaType.APPLICATION_JSON).body(request)
        .exchange().expectStatus().isOk().expectBody().jsonPath("$[0].id").isEqualTo(second.toString());
    client().get().uri(path).exchange().expectStatus().isOk().expectBody()
        .jsonPath("$[0].id").isEqualTo(second.toString())
        .jsonPath("$[0].level").isEqualTo(2)
        .jsonPath("$[1].level").isEqualTo(1);
    client().put().uri(path + "/order").contentType(MediaType.APPLICATION_JSON).body(request)
        .exchange().expectStatus().isEqualTo(409);
  }

  @Test
  void la_baja_de_estructura_respeta_dependencias_y_tenant() {
    String sector = "/api/v1/sectors/" + SECTOR_ID;
    String floor = "/api/v1/floors/" + FLOOR_ID;
    UUID element = crearElemento(50, 50);

    RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build()
        .delete().uri(sector).exchange().expectStatus().isUnauthorized();
    var otherActor = UUID.randomUUID();
    jdbcTemplate.update(
        "insert into tenant (id, name, slug, status, vertical) values ('otro-tenant', 'Otro', 'otro-tenant', 'ACTIVE', 'RESTAURANT') on conflict do nothing");
    jdbcTemplate.update(
        "insert into app_user (id, tenant_id, email, password_hash, full_name, role) values (?, 'otro-tenant', 'layout-otro@example.test', 'unused', 'Layout tester', 'ADMIN')",
        otherActor);
    client("otro-tenant", otherActor).delete().uri(sector).exchange().expectStatus().isNotFound();
    client().delete().uri(floor).exchange().expectStatus().isEqualTo(409);
    client().delete().uri(sector).exchange().expectStatus().isEqualTo(409);
    assertThat(leerLayout().sectors().getFirst().elements().getFirst().id()).isEqualTo(element);

    client().delete().uri(sector + "/elements/" + element).exchange().expectStatus().isNoContent();
    client().delete().uri(sector).exchange().expectStatus().isNoContent();
    client().delete().uri(floor).exchange().expectStatus().isNoContent();
  }

  @Test
  void borrar_elemento_sin_reservas_204_y_con_reserva_409() {
    UUID elementoId = crearElemento(70, 70);

    client()
        .delete()
        .uri("/api/v1/sectors/{s}/elements/{e}", SECTOR_ID, elementoId)
        .exchange()
        .expectStatus()
        .isNoContent();

    UUID conReserva = crearElemento(90, 90);
    UUID usuarioId = UUID.randomUUID();
    jdbcTemplate.update(
        "insert into app_user (id, tenant_id, email, password_hash, full_name, role) "
            + "values (?, ?, ?, 'x', 'Staff', 'STAFF') on conflict do nothing",
        usuarioId, TENANT, usuarioId + "@mapit.dev");
    jdbcTemplate.update(
        "insert into person (id, tenant_id, full_name) values (?, ?, 'Cliente') on conflict do nothing",
        PERSON_ID, TENANT);
    UUID reservaId = UUID.randomUUID();
    jdbcTemplate.update(
        "insert into reservation (id, tenant_id, establishment_id, person_id, starts_at, ends_at, status, created_by) "
            + "values (?, ?, ?, ?, '2026-10-20T18:00:00Z', '2026-10-20T20:00:00Z', 'CREATED', ?)",
        reservaId, TENANT, ESTABLISHMENT_ID, PERSON_ID, usuarioId);
    jdbcTemplate.update(
        "insert into reservation_space_element (tenant_id, reservation_id, space_element_id) values (?, ?, ?)",
        TENANT, reservaId, conReserva);

    client()
        .delete()
        .uri("/api/v1/sectors/{s}/elements/{e}", SECTOR_ID, conReserva)
        .exchange()
        .expectStatus()
        .isEqualTo(409);
  }
}
