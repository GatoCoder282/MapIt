package com.mapit.spaces.infrastructure.template;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.client.RestTestClient;

import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.application.template.ElementTemplateService;
import com.mapit.spaces.domain.spaceelement.SpaceElementType;
import com.mapit.spaces.domain.template.ElementTemplate;
import com.mapit.spaces.domain.template.ElementTemplateId;
import com.mapit.spaces.domain.template.ElementTemplateRepository;

/**
 * Contrato HTTP del controlador de plantillas de elemento (HU-4.02 / MAP-207).
 *
 * <p>RestTestClient montado sobre el controller puro (sin SecurityConfig):
 * trata mapping, validación y Problem Details. El aislamiento cross-tenant por RLS
 * se verificaría en un test de integración con Testcontainers (MAP-207 extended).
 *
 * <p>Patrón idéntico al de {@code SpaceElementControllerTest}: repositorio en memoria,
 * TenantContext fijo, Clock fijo.
 */
class ElementTemplateControllerTest {

  private static final TenantId TENANT_A = TenantId.of("tenant-a");
  private static final TenantId TENANT_B = TenantId.of("tenant-b");
  private static final Instant AHORA = Instant.parse("2026-10-04T12:00:00Z");

  private InMemoryElementTemplates repo;
  private RestTestClient client;

  @BeforeEach
  void setUp() {
    repo = new InMemoryElementTemplates();
    TenantContext tenantContext = () -> Optional.of(TENANT_A);
    Clock clock = Clock.fixed(AHORA, ZoneOffset.UTC);
    ElementTemplateService service = new ElementTemplateService(repo, tenantContext, clock);
    ElementTemplateController controller = new ElementTemplateController(service);
    client = RestTestClient.bindToController(controller).build();
  }

  // ===== POST /api/v1/element-templates =====

  @Test
  void create_valido_devuelve_201_y_la_plantilla() {
    var body = client
        .post()
        .uri("/api/v1/element-templates")
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"name\":\"Mesa redonda\",\"type\":\"TABLE\"}")
        .exchange()
        .expectStatus().isCreated()
        .expectBody(TemplateJson.class)
        .returnResult()
        .getResponseBody();

    assertThat(body).isNotNull();
    assertThat(body.name()).isEqualTo("Mesa redonda");
    assertThat(body.type()).isEqualTo("TABLE");
    assertThat(body.id()).isNotNull();
  }

  @Test
  void create_tipo_invalido_devuelve_400() {
    client.post()
        .uri("/api/v1/element-templates")
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"name\":\"Test\",\"type\":\"DRAGON\"}")
        .exchange()
        .expectStatus().isBadRequest()
        .expectHeader().contentTypeCompatibleWith("application/problem+json");
  }

  @Test
  void create_nombre_vacio_devuelve_400() {
    client.post()
        .uri("/api/v1/element-templates")
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"name\":\"\",\"type\":\"TABLE\"}")
        .exchange()
        .expectStatus().isBadRequest();
  }

  @Test
  void create_nombre_duplicado_devuelve_409() {
    // Primera creación
    client.post()
        .uri("/api/v1/element-templates")
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"name\":\"Barra central\",\"type\":\"BAR\"}")
        .exchange()
        .expectStatus().isCreated();

    // Segunda con el mismo nombre → 409
    client.post()
        .uri("/api/v1/element-templates")
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"name\":\"Barra central\",\"type\":\"BAR\"}")
        .exchange()
        .expectStatus().isEqualTo(409)
        .expectHeader().contentTypeCompatibleWith("application/problem+json");
  }

  // ===== GET /api/v1/element-templates =====

  @Test
  void list_devuelve_solo_vivas_del_tenant() {
    // Crear 2 plantillas
    altaDirecta("Mesa A", SpaceElementType.TABLE);
    altaDirecta("Barra B", SpaceElementType.BAR);

    client.get()
        .uri("/api/v1/element-templates")
        .exchange()
        .expectStatus().isOk()
        .expectBody()
        .jsonPath("$.length()").isEqualTo(2);
  }

  @Test
  void list_no_devuelve_dadas_de_baja() {
    ElementTemplate t = altaDirecta("Mesa para borrar", SpaceElementType.TABLE);
    repo.save(t.softDelete(AHORA, null));

    client.get()
        .uri("/api/v1/element-templates")
        .exchange()
        .expectStatus().isOk()
        .expectBody()
        .jsonPath("$.length()").isEqualTo(0);
  }

  // ===== GET /api/v1/element-templates/{id} =====

  @Test
  void get_by_id_devuelve_la_plantilla() {
    ElementTemplate t = altaDirecta("Butaca numerada", SpaceElementType.SEAT);

    client.get()
        .uri("/api/v1/element-templates/{id}", t.id().value())
        .exchange()
        .expectStatus().isOk()
        .expectBody()
        .jsonPath("$.name").isEqualTo("Butaca numerada");
  }

  @Test
  void get_by_id_inexistente_devuelve_404() {
    client.get()
        .uri("/api/v1/element-templates/{id}", UUID.randomUUID())
        .exchange()
        .expectStatus().isNotFound()
        .expectHeader().contentTypeCompatibleWith("application/problem+json");
  }

  // ===== PUT /api/v1/element-templates/{id} =====

  @Test
  void update_modifica_nombre_y_tipo() {
    ElementTemplate t = altaDirecta("Original", SpaceElementType.TABLE);

    var body = client.put()
        .uri("/api/v1/element-templates/{id}", t.id().value())
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"name\":\"Actualizado\",\"type\":\"BAR\"}")
        .exchange()
        .expectStatus().isOk()
        .expectBody(TemplateJson.class)
        .returnResult()
        .getResponseBody();

    assertThat(body).isNotNull();
    assertThat(body.name()).isEqualTo("Actualizado");
    assertThat(body.type()).isEqualTo("BAR");
  }

  @Test
  void update_inexistente_devuelve_404() {
    client.put()
        .uri("/api/v1/element-templates/{id}", UUID.randomUUID())
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"name\":\"X\",\"type\":\"TABLE\"}")
        .exchange()
        .expectStatus().isNotFound();
  }

  // ===== DELETE /api/v1/element-templates/{id} =====

  @Test
  void delete_devuelve_204_y_baja_logica() {
    ElementTemplate t = altaDirecta("Para borrar", SpaceElementType.DECOR);

    client.delete()
        .uri("/api/v1/element-templates/{id}", t.id().value())
        .exchange()
        .expectStatus().isNoContent();

    // Ya no debe aparecer en lista
    client.get()
        .uri("/api/v1/element-templates")
        .exchange()
        .expectStatus().isOk()
        .expectBody()
        .jsonPath("$.length()").isEqualTo(0);
  }

  @Test
  void delete_inexistente_devuelve_404() {
    client.delete()
        .uri("/api/v1/element-templates/{id}", UUID.randomUUID())
        .exchange()
        .expectStatus().isNotFound();
  }

  // ===== Aislamiento multi-tenant =====

  @Test
  void tenant_b_no_ve_plantillas_de_tenant_a() {
    // El repo en memoria filtra por tenant correctamente.
    altaDirecta("Plantilla de A", SpaceElementType.TABLE);

    // Simular contexto de tenant B: repo solo retorna las del tenant efectivo
    InMemoryElementTemplates repoShared = this.repo;
    TenantContext ctxB = () -> Optional.of(TENANT_B);
    ElementTemplateService serviceB =
        new ElementTemplateService(repoShared, ctxB, Clock.fixed(AHORA, ZoneOffset.UTC));
    ElementTemplateController controllerB = new ElementTemplateController(serviceB);
    RestTestClient clientB = RestTestClient.bindToController(controllerB).build();

    clientB.get()
        .uri("/api/v1/element-templates")
        .exchange()
        .expectStatus().isOk()
        .expectBody()
        .jsonPath("$.length()").isEqualTo(0); // Tenant B no ve nada de A
  }

  // ===== Utilidades de fixture =====

  private ElementTemplate altaDirecta(String name, SpaceElementType type) {
    ElementTemplate t =
        ElementTemplate.register(
            ElementTemplateId.generate(), TENANT_A, name, type, AHORA, null);
    repo.save(t);
    return t;
  }

  public record TemplateJson(UUID id, String name, String type, Instant createdAt, Instant updatedAt) {}

  // ===== Repositorio en memoria =====

  static final class InMemoryElementTemplates implements ElementTemplateRepository {
    private final List<ElementTemplate> data = new ArrayList<>();

    @Override
    public List<ElementTemplate> findAllAliveByTenant(TenantId tenantId) {
      return data.stream()
          .filter(t -> t.tenantId().equals(tenantId) && !t.isDeleted())
          .sorted(java.util.Comparator.comparing(t -> t.name().toLowerCase()))
          .toList();
    }

    @Override
    public Optional<ElementTemplate> findAliveById(TenantId tenantId, ElementTemplateId id) {
      return data.stream()
          .filter(t -> t.tenantId().equals(tenantId) && t.id().equals(id) && !t.isDeleted())
          .findFirst();
    }

    @Override
    public ElementTemplate save(ElementTemplate template) {
      data.removeIf(t -> t.id().equals(template.id()));
      data.add(template);
      return template;
    }

    @Override
    public boolean existsAliveByName(TenantId tenantId, String name) {
      return data.stream()
          .anyMatch(t -> t.tenantId().equals(tenantId)
              && t.name().equalsIgnoreCase(name)
              && !t.isDeleted());
    }
  }
}
