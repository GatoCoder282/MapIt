package com.mapit.spaces.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
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
import com.mapit.spaces.application.spaceelement.CreateSpaceElementUseCase;
import com.mapit.spaces.application.spaceelement.SpaceElementQueryService;
import com.mapit.spaces.application.spaceelement.UpdateSpaceElementUseCase;
import com.mapit.spaces.domain.AuditTrail;
import com.mapit.spaces.domain.Slug;
import com.mapit.spaces.domain.establishment.Establishment;
import com.mapit.spaces.domain.establishment.EstablishmentRepository;
import com.mapit.spaces.domain.establishment.EstablishmentType;
import com.mapit.spaces.domain.floor.Floor;
import com.mapit.spaces.domain.floor.FloorRepository;
import com.mapit.spaces.domain.sector.Sector;
import com.mapit.spaces.domain.sector.SectorId;
import com.mapit.spaces.domain.sector.SectorRepository;
import com.mapit.spaces.domain.spaceelement.SpaceElement;
import com.mapit.spaces.domain.spaceelement.SpaceElementId;
import com.mapit.spaces.domain.spaceelement.SpaceElementRepository;
import com.mapit.spaces.domain.spaceelement.SpaceElementType;
import com.mapit.spaces.infrastructure.spaceelement.SpaceElementController;

/**
 * Contrato HTTP del controlador de elementos espaciales (HU-2.03 / MAP-115).
 *
 * <p>RestTestClient montado sobre el controller puro (sin arrancar SecurityConfig):
 * este test trata mapping, validación y Problem Details, no la cadena de seguridad.
 * La aislamiento cross-tenant efectivo por RLS lo cubre
 * {@code SpaceElementTenantIsolationIntegrationTest} en bootstrap.
 */
class SpaceElementControllerTest {

  private static final TenantId TENANT_A = TenantId.of("tenant-a");
  private static final Instant AHORA = Instant.parse("2026-09-23T12:00:00Z");

  private static final UUID EST_A = UUID.fromString("70000000-0000-0000-0000-000000000001");
  private static final UUID FLOOR_A = UUID.fromString("70000000-0000-0000-0000-000000000002");
  private static final UUID SECTOR_A = UUID.fromString("70000000-0000-0000-0000-000000000003");

  private InMemorySpaceElements elements;
  private RestTestClient client;

  @BeforeEach
  void setUp() {
    elements = new InMemorySpaceElements();
    Sector sector =
        Sector.register(
            SectorId.of(SECTOR_A), TENANT_A, FLOOR_A, "Sector A", 100, Slug.of("sector-a"),
            AHORA, null);
    Floor floor = Floor.register(FLOOR_A, TENANT_A, EST_A, "PB", 1, Slug.of("pb"), AHORA, null);
    Establishment est =
        new Establishment(
            EST_A, TENANT_A, "Rest A", EstablishmentType.RESTAURANT, Slug.of("rest-a"),
            "America/La_Paz", AuditTrail.created(AHORA, null));
    SectorRepository sectors = new PantrySectorRepository(List.of(sector));
    FloorRepository floors = new PantryFloorRepository(List.of(floor));
    EstablishmentRepository establishments = new PantryEstablishmentRepository(List.of(est));
    TenantContext tenantContext = () -> Optional.of(TENANT_A);
    var support = new com.mapit.spaces.application.spaceelement.SpaceElementSupport(sectors, floors, establishments);
    var clock = java.time.Clock.fixed(AHORA, java.time.ZoneOffset.UTC);

    SpaceElementController controller =
        new SpaceElementController(
            new CreateSpaceElementUseCase(elements, support, tenantContext, clock),
            new UpdateSpaceElementUseCase(elements, support, tenantContext, clock),
            new SpaceElementQueryService(elements, support, tenantContext));
    client = RestTestClient.bindToController(controller).build();
  }

  // ===== POST /sectors/{id}/elements =====

  @Test
  void alta_valida_devuelve_201_y_el_elemento() {
    var response =
        client
            .post()
            .uri("/api/v1/sectors/{s}/elements", SECTOR_A)
            .contentType(MediaType.APPLICATION_JSON)
            .body("{\"type\":\"TABLE\",\"x\":10,\"y\":20,\"initialState\":\"AVAILABLE\"}")
            .exchange()
            .expectStatus()
            .isCreated()
            .expectBody(SpaceElementControllerTest.SpaceElementJson.class)
            .returnResult()
            .getResponseBody();

    assertThat(response).isNotNull();
    assertThat(response.type).isEqualTo("TABLE");
    assertThat(response.state).isEqualTo("AVAILABLE");
    assertThat(response.sectorId).isEqualTo(SECTOR_A);
  }

  @Test
  void sector_inexistente_devuelve_404() {
    client
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

  @Test
  void tipo_no_permitido_por_la_vertical_devuelve_400() {
    client
        .post()
        .uri("/api/v1/sectors/{s}/elements", SECTOR_A)
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"type\":\"ROOM\",\"x\":1,\"y\":1}")
        .exchange()
        .expectStatus()
        .isBadRequest()
        .expectBody()
        .jsonPath("$.title")
        .isEqualTo("Tipo de elemento no permitido");
  }

  @Test
  void tipo_invalido_devuelve_400() {
    client
        .post()
        .uri("/api/v1/sectors/{s}/elements", SECTOR_A)
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"type\":\"DRAGON\",\"x\":1,\"y\":1}")
        .exchange()
        .expectStatus()
        .isBadRequest();
  }

  @Test
  void coordenada_negativa_devuelve_400() {
    client
        .post()
        .uri("/api/v1/sectors/{s}/elements", SECTOR_A)
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"type\":\"TABLE\",\"x\":-5,\"y\":1}")
        .exchange()
        .expectStatus()
        .isBadRequest();
  }

  @Test
  void payload_incompleto_devuelve_400() {
    client
        .post()
        .uri("/api/v1/sectors/{s}/elements", SECTOR_A)
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"x\":1,\"y\":1}") // falta type
        .exchange()
        .expectStatus()
        .isBadRequest();
  }

  @Test
  void payload_con_tipo_pero_sin_coordenadas_devuelve_400_no_500() {
    client
        .post()
        .uri("/api/v1/sectors/{s}/elements", SECTOR_A)
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"type\":\"TABLE\"}") // sin x/y: antes era un 500 NPE, ahora 400 Problem
        .exchange()
        .expectStatus()
        .isBadRequest()
        .expectHeader()
        .contentTypeCompatibleWith("application/problem+json");
  }

  // ===== PUT /sectors/{sectorId}/elements/{elementId} =====

  @Test
  void put_actualiza_campos_editables_y_conserva_estado() {
    UUID id = altaDirecta("TABLE", 1, 1, "OCCUPIED");
    var response =
        client
            .put()
            .uri("/api/v1/sectors/{s}/elements/{e}", SECTOR_A, id)
            .contentType(MediaType.APPLICATION_JSON)
            .body("{\"type\":\"BAR\",\"x\":42,\"y\":42}")
            .exchange()
            .expectStatus()
            .isOk()
            .expectBody(SpaceElementJson.class)
            .returnResult()
            .getResponseBody();
    assertThat(response).isNotNull();
    assertThat(response.type).isEqualTo("BAR");
    assertThat(response.state).isEqualTo("OCCUPIED");
  }

  @Test
  void put_a_elemento_inexistente_devuelve_404() {
    client
        .put()
        .uri("/api/v1/sectors/{s}/elements/{e}", SECTOR_A, UUID.randomUUID())
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"type\":\"TABLE\",\"x\":1,\"y\":1}")
        .exchange()
        .expectStatus()
        .isNotFound();
  }

  @Test
  void put_a_elemento_de_otro_sector_devuelve_404() {
    // Elemento creado en sector inexistente para el tenant: GET/PUT deben 404.
    UUID id = altaDirecta("TABLE", 1, 1, "AVAILABLE");
    client
        .put()
        .uri("/api/v1/sectors/{s}/elements/{e}", UUID.randomUUID(), id)
        .contentType(MediaType.APPLICATION_JSON)
        .body("{\"type\":\"TABLE\",\"x\":1,\"y\":1}")
        .exchange()
        .expectStatus()
        .isNotFound();
  }

  // ===== GETs (consulta) =====

  @Test
  void lista_elementos_del_sector() {
    altaDirecta("TABLE", 1, 1, "AVAILABLE");
    altaDirecta("BAR", 2, 2, "AVAILABLE");
    client
        .get()
        .uri("/api/v1/sectors/{s}/elements", SECTOR_A)
        .exchange()
        .expectStatus()
        .isOk()
        .expectBody()
        .jsonPath("$.length()")
        .isEqualTo(2);
  }

  @Test
  void get_por_id_devuelve_404_cuando_es_de_otro_sector() {
    UUID id = altaDirecta("TABLE", 1, 1, "AVAILABLE");
    client
        .get()
        .uri("/api/v1/sectors/{s}/elements/{e}", UUID.randomUUID(), id)
        .exchange()
        .expectStatus()
        .isNotFound();
  }

  // ===== Utilidades de fixture =====

  private UUID altaDirecta(String type, double x, double y, String state) {
    SpaceElement e =
        SpaceElement.register(
            SpaceElementId.generate(),
            TENANT_A,
            SECTOR_A,
            SpaceElementType.valueOf(type),
            x,
            y,
            com.mapit.shared.realtime.SpaceElementState.valueOf(state),
            AHORA,
            null);
    elements.store(e);
    return e.id().value();
  }

  public record SpaceElementJson(
      UUID id,
      UUID sectorId,
      String type,
      double x,
      double y,
      String state,
      Instant createdAt,
      Instant updatedAt) {}

  private static final class InMemorySpaceElements implements SpaceElementRepository {
    private final List<SpaceElement> data = new ArrayList<>();

    void store(SpaceElement e) {
      data.add(e);
    }

    @Override
    public List<SpaceElement> findAliveBySectorId(TenantId tenantId, UUID sectorId) {
      return data.stream()
          .filter(e -> e.tenantId().equals(tenantId) && e.sectorId().equals(sectorId))
          .toList();
    }

    @Override
    public Optional<SpaceElement> findAliveById(
        TenantId tenantId, UUID sectorId, SpaceElementId id) {
      return data.stream()
          .filter(
              e ->
                  e.tenantId().equals(tenantId)
                      && e.sectorId().equals(sectorId)
                      && e.id().equals(id))
          .findFirst();
    }

    @Override
    public SpaceElement save(SpaceElement element) {
      data.add(element);
      return element;
    }
  }

  private record PantrySectorRepository(List<Sector> vivos) implements SectorRepository {
    @Override
    public List<Sector> findAliveByFloorId(TenantId tenantId, UUID floorId) {
      return vivos;
    }
    @Override
    public Optional<Sector> findAliveById(TenantId tenantId, SectorId id) {
      return vivos.stream().filter(s -> s.id().equals(id)).findFirst();
    }
    @Override
    public Optional<Sector> findAliveBySlug(TenantId tenantId, UUID floorId, Slug slug) {
      return Optional.empty();
    }
    @Override
    public Sector save(Sector sector) {
      return sector;
    }
  }

  private record PantryFloorRepository(List<Floor> vivos) implements FloorRepository {
    @Override
    public List<Floor> findAliveByEstablishmentId(TenantId tenantId, UUID establishmentId) {
      return vivos;
    }
    @Override
    public Optional<Floor> findAliveById(TenantId tenantId, UUID id) {
      return vivos.stream().filter(f -> f.id().equals(id)).findFirst();
    }
    @Override
    public Optional<Floor> findAliveBySlug(TenantId tenantId, UUID establishmentId, Slug slug) {
      return Optional.empty();
    }
    @Override
    public boolean existsAliveByLevel(TenantId tenantId, UUID establishmentId, int level) {
      return false;
    }
    @Override
    public Optional<Integer> findMaxLevel(TenantId tenantId, UUID establishmentId) {
      return Optional.empty();
    }
    @Override
    public Floor save(Floor floor) {
      return floor;
    }
  }

  private record PantryEstablishmentRepository(List<Establishment> vivos)
      implements EstablishmentRepository {
    @Override
    public List<Establishment> findAllAlive(TenantId tenantId) {
      return vivos;
    }
    @Override
    public Optional<Establishment> findAliveById(TenantId tenantId, UUID id) {
      return vivos.stream().filter(e -> e.id().equals(id)).findFirst();
    }
    @Override
    public Optional<Establishment> findAliveBySlug(TenantId tenantId, Slug slug) {
      return Optional.empty();
    }
    @Override
    public Establishment save(Establishment establishment) {
      return establishment;
    }
  }
}
