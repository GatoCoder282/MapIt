package com.mapit.spaces.application.spaceelement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.mapit.shared.realtime.SpaceElementState;
import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.application.sector.SectorNotFoundException;
import com.mapit.spaces.domain.AuditTrail;
import com.mapit.spaces.domain.Establishment;
import com.mapit.spaces.domain.EstablishmentRepository;
import com.mapit.spaces.domain.EstablishmentType;
import com.mapit.spaces.domain.Floor;
import com.mapit.spaces.domain.FloorRepository;
import com.mapit.spaces.domain.Sector;
import com.mapit.spaces.domain.SectorId;
import com.mapit.spaces.domain.SectorRepository;
import com.mapit.spaces.domain.Slug;
import com.mapit.spaces.domain.SpaceElement;
import com.mapit.spaces.domain.SpaceElementId;
import com.mapit.spaces.domain.SpaceElementRepository;
import com.mapit.spaces.domain.SpaceElementType;

/**
 * Reglas del caso de uso de SpaceElement (HU-2.03 / MAP-114) con puertos en memoria.
 * Sin contexto Spring: la jerarquía y las validaciones se prueban en milisegundos.
 */
class SpaceElementUseCaseTest {

  private static final TenantId TENANT_A = TenantId.of("tenant-a");
  private static final TenantId TENANT_B = TenantId.of("tenant-b");
  private static final Instant AHORA = Instant.parse("2026-09-23T12:00:00Z");

  private static final UUID EST_A = UUID.randomUUID();
  private static final UUID EST_B = UUID.randomUUID();
  private static final UUID FLOOR_A = UUID.randomUUID();
  private static final UUID FLOOR_B = UUID.randomUUID();
  private static final UUID SECTOR_A = UUID.randomUUID();
  private static final UUID SECTOR_B = UUID.randomUUID();

  private static final Sector SECTOR_TENANT_A =
      Sector.register(
          SectorId.of(SECTOR_A),
          TENANT_A,
          FLOOR_A,
          "Salón Principal",
          100,
          Slug.of("salon-principal"),
          AHORA,
          null);
  private static final Floor FLOOR_TENANT_A =
      Floor.register(FLOOR_A, TENANT_A, EST_A, "PB", 1, Slug.of("pb"), AHORA, null);
  private static final Establishment EST_TENANT_A =
      new Establishment(
          EST_A, TENANT_A, "Est A", EstablishmentType.RESTAURANT, Slug.of("est-a"),
          "America/La_Paz", AuditTrail.created(AHORA, null));
  private static final Establishment EST_TENANT_B_HOTEL =
      new Establishment(
          EST_B, TENANT_B, "Hotel B", EstablishmentType.HOTEL, Slug.of("hotel-b"),
          "America/La_Paz", AuditTrail.created(AHORA, null));
  private static final Floor FLOOR_TENANT_B =
      Floor.register(FLOOR_B, TENANT_B, EST_B, "PB", 1, Slug.of("pb"), AHORA, null);
  private static final Sector SECTOR_TENANT_B =
      Sector.register(
          SectorId.of(SECTOR_B),
          TENANT_B,
          FLOOR_B,
          "Lobby",
          50,
          Slug.of("lobby"),
          AHORA,
          null);

  private InMemorySpaceElementRepository elements;
  private PantrySectorRepository sectors;
  private PantryFloorRepository floors;
  private PantryEstablishmentRepository establishments;
  private TenantContext tenantContext;

  private CreateSpaceElementUseCase create;
  private UpdateSpaceElementUseCase update;
  private SpaceElementQueryService query;

  @BeforeEach
  void setup() {
    elements = new InMemorySpaceElementRepository();
    sectors = new PantrySectorRepository(List.of(SECTOR_TENANT_A, SECTOR_TENANT_B));
    floors = new PantryFloorRepository(List.of(FLOOR_TENANT_A, FLOOR_TENANT_B));
    establishments = new PantryEstablishmentRepository(List.of(EST_TENANT_A, EST_TENANT_B_HOTEL));
    tenantContext = () -> Optional.of(TENANT_A);
    var support = new SpaceElementSupport(sectors, floors, establishments);
    var clock = java.time.Clock.fixed(AHORA, java.time.ZoneOffset.UTC);
    create = new CreateSpaceElementUseCase(elements, support, tenantContext, clock);
    update = new UpdateSpaceElementUseCase(elements, support, tenantContext, clock);
    query = new SpaceElementQueryService(elements, support, tenantContext);
  }

  // ===== Creación =====

  @Test
  void alta_valida_deja_el_elemento_con_tenant_del_contexto() {
    var r = create.create(new CreateSpaceElementCommand(SECTOR_A, "TABLE", 100.0, 50.0, null));
    assertThat(r.type()).isEqualTo("TABLE");
    assertThat(r.state()).isEqualTo("AVAILABLE");
    assertThat(r.sectorId()).isEqualTo(SECTOR_A);
    assertThat(elements.guardado()).isNotNull();
    assertThat(elements.guardado().tenantId()).isEqualTo(TENANT_A);
  }

  @Test
  void alta_en_sector_de_otro_tenant_responde_404() {
    assertThatThrownBy(
            () -> create.create(new CreateSpaceElementCommand(SECTOR_B, "TABLE", 10.0, 10.0, null)))
        .isInstanceOf(SectorNotFoundException.class);
  }

  @Test
  void alta_en_sector_inexistente_responde_404() {
    assertThatThrownBy(
            () ->
                create.create(
                    new CreateSpaceElementCommand(UUID.randomUUID(), "TABLE", 10.0, 10.0, null)))
        .isInstanceOf(SectorNotFoundException.class);
  }

  @Test
  void tipo_no_permitido_por_la_vertical_responde_400() {
    // ROOM solo en hotel (RN-4); el tenant A es un restaurante.
    assertThatThrownBy(
            () -> create.create(new CreateSpaceElementCommand(SECTOR_A, "ROOM", 10.0, 10.0, null)))
        .isInstanceOf(InvalidElementTypeForVerticalException.class)
        .hasMessageContaining("ROOM");
  }

  @Test
  void tipo_invalido_responde_400() {
    assertThatThrownBy(
            () ->
                create.create(new CreateSpaceElementCommand(SECTOR_A, "DRAGON", 10.0, 10.0, null)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("type inválido");
  }

  @Test
  void estado_inicial_invalido_responde_400() {
    assertThatThrownBy(
            () ->
                create.create(
                    new CreateSpaceElementCommand(SECTOR_A, "TABLE", 10.0, 10.0, "WIZARD")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("initialState inválido");
  }

  @Test
  void coordenada_negativa_responde_400() {
    assertThatThrownBy(
            () -> create.create(new CreateSpaceElementCommand(SECTOR_A, "TABLE", -1.0, 10.0, null)))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void coordenadas_nulas_responden_400_no_500() {
    // Antes la cadena llegaba a Objects.requireNonNull y terminaba en un 500 con stacktrace.
    assertThatThrownBy(
            () -> create.create(new CreateSpaceElementCommand(SECTOR_A, "TABLE", null, 10.0, null)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("obligatorias");
    assertThatThrownBy(
            () -> create.create(new CreateSpaceElementCommand(SECTOR_A, "TABLE", 10.0, null, null)))
        .isInstanceOf(IllegalArgumentException.class);
  }

  // ===== Consulta =====

  @Test
  void consulta_solo_ve_elementos_de_su_sector_y_tenant() {
    elements.store(
        SpaceElement.register(
            SpaceElementId.generate(), TENANT_A, SECTOR_A, SpaceElementType.TABLE, 1.0, 1.0, null,
            AHORA, null));
    elements.store(
        SpaceElement.register(
            SpaceElementId.generate(), TENANT_B, SECTOR_B, SpaceElementType.TABLE, 5.0, 5.0, null,
            AHORA, null));
    assertThat(query.bySector(SECTOR_A)).hasSize(1);
    assertThatThrownBy(() -> query.bySector(SECTOR_B))
        .isInstanceOf(SectorNotFoundException.class);
  }

  // ===== Actualización =====

  @Test
  void actualizar_conserva_estado_y_toca_updated_at() {
    SpaceElement existente =
        SpaceElement.register(
            SpaceElementId.generate(), TENANT_A, SECTOR_A, SpaceElementType.TABLE, 1.0, 1.0,
            SpaceElementState.OCCUPIED, AHORA, null);
    elements.store(existente);

    var r = update.update(new UpdateSpaceElementCommand(SECTOR_A, existente.id().value(), "BAR", 20.0, 30.0));
    assertThat(r.type()).isEqualTo("BAR");
    assertThat(r.state()).isEqualTo("OCCUPIED"); // no cambia, eso es HU-3.01
    var saved = elements.guardado();
    assertThat(saved.audit().updatedAt()).isAfterOrEqualTo(AHORA);
  }

  @Test
  void actualizar_con_tipo_incompatible_con_la_vertical_responde_400() {
    SpaceElement existente =
        SpaceElement.register(
            SpaceElementId.generate(), TENANT_A, SECTOR_A, SpaceElementType.TABLE, 1.0, 1.0,
            SpaceElementState.AVAILABLE, AHORA, null);
    elements.store(existente);

    assertThatThrownBy(
            () ->
                update.update(
                    new UpdateSpaceElementCommand(SECTOR_A, existente.id().value(), "ROOM", 5.0, 5.0)))
        .isInstanceOf(InvalidElementTypeForVerticalException.class);
  }

  @Test
  void actualizar_elemento_de_otro_tenant_responde_404() {
    SpaceElement ajeno =
        SpaceElement.register(
            SpaceElementId.generate(), TENANT_B, SECTOR_B, SpaceElementType.TABLE, 1.0, 1.0, null,
            AHORA, null);
    elements.store(ajeno);

    // El tenant A quiere tocar el elemento del tenant B: primero separa por sector; como el
    // sector B no es del tenant A, la propia verificación de sector corta antes de buscar el id.
    assertThatThrownBy(
            () ->
                update.update(
                    new UpdateSpaceElementCommand(SECTOR_A, ajeno.id().value(), "TABLE", 5.0, 5.0)))
        .isInstanceOf(SpaceElementNotFoundException.class);
  }

  @Test
  void actualizar_sector_ajeno_responde_404() {
    assertThatThrownBy(
            () ->
                update.update(
                    new UpdateSpaceElementCommand(SECTOR_B, UUID.randomUUID(), "TABLE", 5.0, 5.0)))
        .isInstanceOf(SectorNotFoundException.class);
  }

  // ===== Puertos en memoria =====

  private static final class InMemorySpaceElementRepository implements SpaceElementRepository {
    private final List<SpaceElement> data = new ArrayList<>();
    private SpaceElement guardado;

    void store(SpaceElement e) {
      data.add(e);
    }

    SpaceElement guardado() {
      return guardado;
    }

    @Override
    public List<SpaceElement> findAliveBySectorId(TenantId tenantId, UUID sectorId) {
      return data.stream()
          .filter(e -> e.tenantId().equals(tenantId) && e.sectorId().equals(sectorId) && !e.isDeleted())
          .toList();
    }

    @Override
    public Optional<SpaceElement> findAliveById(TenantId tenantId, UUID sectorId, SpaceElementId id) {
      return data.stream()
          .filter(
              e ->
                  e.tenantId().equals(tenantId)
                      && e.sectorId().equals(sectorId)
                      && e.id().equals(id)
                      && !e.isDeleted())
          .findFirst();
    }

    @Override
    public SpaceElement save(SpaceElement element) {
      guardado = element;
      data.add(element);
      return element;
    }
  }

  private record PantrySectorRepository(List<Sector> vivos) implements SectorRepository {
    @Override
    public List<Sector> findAliveByFloorId(TenantId tenantId, UUID floorId) {
      return vivos.stream()
          .filter(s -> s.tenantId().equals(tenantId) && s.floorId().equals(floorId))
          .toList();
    }
    @Override
    public Optional<Sector> findAliveById(TenantId tenantId, SectorId id) {
      return vivos.stream()
          .filter(s -> s.tenantId().equals(tenantId) && s.id().equals(id))
          .findFirst();
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
      return vivos.stream()
          .filter(f -> f.tenantId().equals(tenantId) && f.id().equals(id))
          .findFirst();
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
      return vivos.stream()
          .filter(e -> e.tenantId().equals(tenantId) && e.id().equals(id))
          .findFirst();
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
