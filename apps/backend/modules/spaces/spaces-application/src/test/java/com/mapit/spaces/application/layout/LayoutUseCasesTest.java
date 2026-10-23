package com.mapit.spaces.application.layout;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.mapit.shared.realtime.SpaceElementState;
import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.application.floor.FloorNotFoundException;
import com.mapit.spaces.application.spaceelement.DeleteSpaceElementUseCase;
import com.mapit.spaces.application.spaceelement.SpaceElementHasActiveReservationsException;
import com.mapit.spaces.application.spaceelement.SpaceElementNotFoundException;
import com.mapit.spaces.domain.AuditTrail;
import com.mapit.spaces.domain.Slug;
import com.mapit.spaces.domain.establishment.Establishment;
import com.mapit.spaces.domain.establishment.EstablishmentRepository;
import com.mapit.spaces.domain.establishment.EstablishmentType;
import com.mapit.spaces.domain.floor.Floor;
import com.mapit.spaces.domain.floor.FloorRepository;
import com.mapit.spaces.domain.layout.FloorLayout;
import com.mapit.spaces.domain.layout.Geometry;
import com.mapit.spaces.domain.layout.LayoutQueryRepository;
import com.mapit.spaces.domain.layout.Placement;
import com.mapit.spaces.domain.layout.SectorLayout;
import com.mapit.spaces.domain.sector.Sector;
import com.mapit.spaces.domain.sector.SectorId;
import com.mapit.spaces.domain.sector.SectorRepository;
import com.mapit.spaces.domain.spaceelement.SpaceElement;
import com.mapit.spaces.domain.spaceelement.SpaceElementId;
import com.mapit.spaces.domain.spaceelement.SpaceElementRepository;
import com.mapit.spaces.domain.spaceelement.SpaceElementReservationLookup;
import com.mapit.spaces.domain.spaceelement.SpaceElementType;

/**
 * Reglas de los casos de uso de layout (HU-4.01) con puertos en memoria.
 * Sin contexto Spring: RN-2, RN-4, RN-5, RN-7, RN-9 y RN-10 se prueban aquí.
 */
class LayoutUseCasesTest {

  private static final TenantId TENANT_A = TenantId.of("tenant-a");
  private static final TenantId TENANT_B = TenantId.of("tenant-b");
  private static final Instant AHORA = Instant.parse("2026-10-11T12:00:00Z");
  private static final Clock CLOCK = Clock.fixed(AHORA, ZoneOffset.UTC);

  private static final UUID EST = UUID.randomUUID();
  private static final UUID FLOOR_ID = UUID.randomUUID();
  private static final UUID FLOOR_B_ID = UUID.randomUUID();
  private static final UUID SECTOR_1 = UUID.randomUUID();
  private static final UUID SECTOR_2 = UUID.randomUUID();

  private List<Sector> sectorStore;
  private List<SpaceElement> elementStore;
  private Floor floor;
  private Sector sector1;

  private GetFloorLayoutUseCase getLayout;
  private SaveFloorLayoutUseCase saveFloorLayout;
  private SaveSectorLayoutUseCase saveSectorLayout;
  private DuplicateSectorUseCase duplicateSector;
  private DeleteSpaceElementUseCase deleteElement;
  private TenantContext tenantContext;
  private SpaceElementReservationLookup noReservations;
  private EstablishmentRepository establishments;

  @BeforeEach
  void setup() {
    floor =
        new Floor(FLOOR_ID, TENANT_A, EST, "PB", 0, Slug.of("pb"), 1200, 800,
            AuditTrail.created(AHORA, null));
    sector1 =
        new Sector(SectorId.of(SECTOR_1), TENANT_A, FLOOR_ID, "Salón", 50, Slug.of("salon"),
            Geometry.of(400, 300), Placement.of(10, 10, 0), AuditTrail.created(AHORA, null));
    Sector sector2 =
        new Sector(SectorId.of(SECTOR_2), TENANT_A, FLOOR_ID, "Terraza", 30, Slug.of("terraza"),
            Geometry.of(300, 200), Placement.of(500, 10, 0), AuditTrail.created(AHORA, null));
    sectorStore = new ArrayList<>(List.of(sector1, sector2));

    elementStore = new ArrayList<>(List.of(
        new SpaceElement(SpaceElementId.generate(), TENANT_A, SECTOR_1, SpaceElementType.TABLE,
            20, 20, 80, 80, 0, SpaceElementState.OCCUPIED, AuditTrail.created(AHORA, null)),
        new SpaceElement(SpaceElementId.generate(), TENANT_A, SECTOR_1, SpaceElementType.TABLE,
            150, 20, 80, 80, 0, SpaceElementState.AVAILABLE, AuditTrail.created(AHORA, null))));

    tenantContext = () -> Optional.of(TENANT_A);
    noReservations = (tenant, element) -> false;
    establishments = pantryEstablishments();

    FloorRepository floors = pantryFloors(List.of(floor));
    SectorRepository sectors = pantrySectors(sectorStore);
    SpaceElementRepository elements = pantryElements(elementStore);
    LayoutQueryRepository layouts =
        (tenant, floorId) -> {
          if (!floor.tenantId().equals(tenant) || !floor.id().equals(floorId)) {
            return Optional.empty();
          }
          var secs = sectorStore.stream()
              .filter(s -> !s.isDeleted())
              .map(s -> new SectorLayout(s, elementStore.stream()
                  .filter(e -> !e.isDeleted() && e.sectorId().equals(s.id().value()))
                  .toList()))
              .toList();
          return Optional.of(new FloorLayout(floor, secs));
        };

    getLayout = new GetFloorLayoutUseCase(layouts, tenantContext);
    saveFloorLayout = new SaveFloorLayoutUseCase(floors, sectors, tenantContext, CLOCK);
    saveSectorLayout = new SaveSectorLayoutUseCase(sectors, elements, tenantContext, CLOCK);
    duplicateSector = new DuplicateSectorUseCase(
        sectors, elements, floors, establishments, tenantContext, CLOCK);
    deleteElement = new DeleteSpaceElementUseCase(elements, noReservations, tenantContext, CLOCK);
  }

  // ===== Lectura agregada =====

  @Test
  void el_layout_agregado_trae_piso_sectores_y_elementos_en_una_sola_lectura() {
    FloorLayout layout = getLayout.get(FLOOR_ID);
    assertThat(layout.floor().canvasWidth()).isEqualTo(1200);
    assertThat(layout.sectors()).hasSize(2);
    SectorLayout salon = layout.sectors().stream()
        .filter(s -> s.sector().id().value().equals(SECTOR_1)).findFirst().orElseThrow();
    assertThat(salon.elements()).hasSize(2);
    assertThat(salon.sector().placement()).isEqualTo(Placement.of(10, 10, 0));
  }

  @Test
  void el_layout_de_otro_tenant_es_inexistente() {
    FloorLayout layout = getLayout.get(FLOOR_ID); // dentro del tenant, no falla
    assertThat(layout.sectors()).hasSize(2);
    var otherTenant = new GetFloorLayoutUseCase(
        (tenant, id) -> Optional.empty(), () -> Optional.of(TENANT_B));
    assertThatThrownBy(() -> otherTenant.get(FLOOR_ID))
        .isInstanceOf(FloorNotFoundException.class);
  }

  // ===== Guardado de planta =====

  @Test
  void guardar_layout_de_planta_mueve_sector_sin_tocar_sus_elementos() {
    var update = new SaveFloorLayoutCommand.SectorPlacement(
        SECTOR_1, 250, 200, 45, sector1.audit().updatedAt());
    saveFloorLayout.save(FLOOR_ID,
        new SaveFloorLayoutCommand(2000, 1500, floor.audit().updatedAt(), List.of(update)));

    Sector moved = sectorStore.stream()
        .filter(s -> s.id().value().equals(SECTOR_1)).findFirst().orElseThrow();
    assertThat(moved.placement()).isEqualTo(Placement.of(250, 200, 45));
    assertThat(floorUpdated().canvasWidth()).isEqualTo(2000);
    // RN-2: los elementos del sector no cambian al mover el sector
    assertThat(elementStore).allSatisfy(e -> {
      assertThat(e.x()).isIn(20.0, 150.0);
      assertThat(e.audit().updatedAt()).isEqualTo(AHORA);
    });
  }

  @Test
  void guardar_layout_rechaza_versiones_obsoletas() {
    var stale = new SaveFloorLayoutCommand.SectorPlacement(
        SECTOR_1, 100, 200, 0, AHORA.minusSeconds(3600));
    assertThatThrownBy(() -> saveFloorLayout.save(FLOOR_ID,
        new SaveFloorLayoutCommand(1200, 800, floor.audit().updatedAt(), List.of(stale))))
        .isInstanceOf(LayoutConflictException.class)
        .satisfies(e -> assertThat(((LayoutConflictException) e).conflictingIds())
            .contains(SECTOR_1));
  }

  @Test
  void guardar_layout_rechaza_un_sector_que_no_cabe_en_el_lienzo() {
    var out = new SaveFloorLayoutCommand.SectorPlacement(
        SECTOR_1, 1000, 700, 0, sector1.audit().updatedAt()); // 1000+400 > 1200
    assertThatThrownBy(() -> saveFloorLayout.save(FLOOR_ID,
        new SaveFloorLayoutCommand(1200, 800, floor.audit().updatedAt(), List.of(out))))
        .isInstanceOf(LayoutOutOfBoundsException.class);
  }

  // ===== Guardado de sector =====

  @Test
  void guardar_layout_de_sector_actualiza_geometria_sin_tocar_el_estado() {
    var el = elementStore.get(0);
    var geom = new SaveSectorLayoutCommand.ElementGeometry(
        el.id().value(), 300, 200, 100, 60, 90, el.audit().updatedAt());
    saveSectorLayout.save(SECTOR_1,
        new SaveSectorLayoutCommand(400, 300, sector1.audit().updatedAt(), List.of(geom)));

    SpaceElement saved = elementStore.stream()
        .filter(e -> e.id().equals(el.id())).findFirst().orElseThrow();
    assertThat(saved.x()).isEqualTo(300);
    assertThat(saved.rotation()).isEqualTo(90);
    assertThat(saved.state()).isEqualTo(SpaceElementState.OCCUPIED); // RN-9
  }

  @Test
  void guardar_layout_de_sector_rechaza_elemento_fuera_de_las_nuevas_dimensiones() {
    var el = elementStore.get(0);
    var geom = new SaveSectorLayoutCommand.ElementGeometry(
        el.id().value(), 900, 20, 80, 80, 0, el.audit().updatedAt());
    assertThatThrownBy(() -> saveSectorLayout.save(SECTOR_1,
        new SaveSectorLayoutCommand(400, 300, sector1.audit().updatedAt(), List.of(geom))))
        .isInstanceOf(LayoutOutOfBoundsException.class);
  }

  @Test
  void encoger_el_sector_revalida_tambien_los_elementos_omitidos_del_lote() {
    // El sector tiene un elemento en (150, 20) 80x80. Encogerlo a 100x100 con un
    // lote VACÍO debe rechazarse: el elemento omitido quedaría fuera (CA-7).
    assertThatThrownBy(() -> saveSectorLayout.save(SECTOR_1,
        new SaveSectorLayoutCommand(100, 100, sector1.audit().updatedAt(), List.of())))
        .isInstanceOf(LayoutOutOfBoundsException.class)
        .hasMessageContaining("elemento");
  }

  @Test
  void encoger_el_lienzo_revalida_tambien_los_sectores_omitidos_del_lote() {
    // El segundo sector está colocado en (500, 10) con 300x200: encoger el
    // lienzo a 600x800 sin incluirlo en el lote deja de caber (600+... 500+300 > 600).
    assertThatThrownBy(() -> saveFloorLayout.save(FLOOR_ID,
        new SaveFloorLayoutCommand(600, 800, floor.audit().updatedAt(), List.of())))
        .isInstanceOf(LayoutOutOfBoundsException.class);
  }

  // ===== Duplicado de sector (RN-5) =====

  @Test
  void duplicar_crea_sector_y_elementos_con_ids_nuevos_y_estado_inicial() {
    SectorLayout copy = duplicateSector.duplicate(FLOOR_ID,
        new DuplicateSectorCommand(SECTOR_1, null, null));

    assertThat(copy.sector().id()).isNotEqualTo(sector1.id());
    assertThat(copy.sector().floorId()).isEqualTo(FLOOR_ID);
    assertThat(copy.sector().geometry()).isEqualTo(sector1.geometry());
    assertThat(copy.sector().name()).isEqualTo("Salón (copia)");
    assertThat(copy.elements()).hasSize(2);
    assertThat(copy.elements()).allSatisfy(e -> {
      assertThat(e.id()).isNotIn(elementStore.get(0).id(), elementStore.get(1).id());
      assertThat(e.state()).isEqualTo(SpaceElementState.AVAILABLE); // recurso nuevo, sin reservas
      assertThat(e.sectorId()).isEqualTo(copy.sector().id().value());
    });
  }

  @Test
  void duplicar_un_sector_ajeno_o_de_otro_piso_de_otro_tenant_falla_cerrado() {
    var otherTenantUseCase = new DuplicateSectorUseCase(
        pantrySectors(sectorStore), pantryElements(elementStore),
        pantryFloors(List.of(floor)), establishments, () -> Optional.of(TENANT_B), CLOCK);
    assertThatThrownBy(() -> otherTenantUseCase.duplicate(FLOOR_ID,
        new DuplicateSectorCommand(SECTOR_1, null, null)))
        .isInstanceOf(FloorNotFoundException.class);
  }

  @Test
  void duplicar_solo_cruce_slugs_libre_y_mismo_establecimiento() {
    // M-8: la biblioteca es del establecimiento; duplicar a una planta de OTRO
    // establecimiento del mismo tenant se rechaza (400 de negocio).
    UUID otroPiso = UUID.randomUUID();
    Sector source = sectorStore.get(0);
    Floor otherFloor = new Floor(otroPiso, TENANT_A, UUID.randomUUID(), "Piso B", 1,
        Slug.of("piso-b"), 1200, 800, AuditTrail.created(AHORA, null));
    var useCase = new DuplicateSectorUseCase(
        pantrySectors(sectorStore), pantryElements(elementStore),
        pantryFloors(List.of(floor, otherFloor)), establishments, tenantContext, CLOCK);
    assertThatThrownBy(() -> useCase.duplicate(otroPiso,
        new DuplicateSectorCommand(source.id().value(), null, null)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("establecimiento");
  }

  // ===== Borrado de elemento (RN-1) =====

  @Test
  void borrar_elemento_sin_reservas_es_baja_logica() {
    var el = elementStore.get(0);
    deleteElement.delete(SECTOR_1, el.id().value());
    SpaceElement deleted = elementStore.stream()
        .filter(e -> e.id().equals(el.id())).findFirst().orElseThrow();
    assertThat(deleted.isDeleted()).isTrue();
  }

  @Test
  void borrar_elemento_con_reservas_activas_es_conflicto() {
    SpaceElementReservationLookup withReservations = (tenant, element) -> true;
    var guarded = new DeleteSpaceElementUseCase(
        pantryElements(elementStore), withReservations, tenantContext, CLOCK);
    var el = elementStore.get(0);
    assertThatThrownBy(() -> guarded.delete(SECTOR_1, el.id().value()))
        .isInstanceOf(SpaceElementHasActiveReservationsException.class);
    SpaceElement alive = elementStore.stream()
        .filter(e -> e.id().equals(el.id())).findFirst().orElseThrow();
    assertThat(alive.isDeleted()).isFalse();
  }

  @Test
  void borrar_elemento_de_otro_sector_es_404() {
    var el = elementStore.get(0);
    assertThatThrownBy(() -> deleteElement.delete(SECTOR_2, el.id().value()))
        .isInstanceOf(SpaceElementNotFoundException.class);
  }

  // ===== Fakes =====

  private Floor floorUpdated() {
    return floorStoreRef.get(0);
  }

  private List<Floor> floorStoreRef;

  private EstablishmentRepository pantryEstablishments() {
    Establishment est = new Establishment(
        EST, TENANT_A, "Est", EstablishmentType.RESTAURANT, Slug.of("est"),
        null, "America/La_Paz", AuditTrail.created(AHORA, null));
    return new EstablishmentRepository() {
      public List<Establishment> findAllAlive(TenantId t) {
        return List.of(est);
      }

      public Optional<Establishment> findAliveById(TenantId t, UUID id) {
        return est.id().equals(id) && est.tenantId().equals(t)
            ? Optional.of(est) : Optional.empty();
      }

      public Optional<Establishment> findAliveBySlug(TenantId t, Slug slug) {
        return Optional.empty();
      }

      public Establishment save(Establishment e) {
        return e;
      }
    };
  }

  private FloorRepository pantryFloors(List<Floor> data) {
    floorStoreRef = data;
    List<Floor> store = new ArrayList<>(data);
    floorStoreRef = store;
    return new FloorRepository() {
      public List<Floor> findAliveByEstablishmentId(TenantId t, UUID id) {
        return store.stream().filter(f -> !f.isDeleted()).toList();
      }

      public Optional<Floor> findAliveById(TenantId t, UUID id) {
        return store.stream()
            .filter(f -> f.id().equals(id) && f.tenantId().equals(t) && !f.isDeleted())
            .findFirst();
      }

      public Optional<Floor> findAliveBySlug(TenantId t, UUID e, Slug s) {
        return Optional.empty();
      }

      public boolean existsAliveByLevel(TenantId t, UUID e, int level) {
        return false;
      }

      public Optional<Integer> findMaxLevel(TenantId t, UUID e) {
        return Optional.empty();
      }

      public Floor save(Floor f) {
        store.removeIf(x -> x.id().equals(f.id()));
        store.add(f);
        return f;
      }
    };
  }

  private SectorRepository pantrySectors(List<Sector> data) {
    List<Sector> store = data;
    return new SectorRepository() {
      public List<Sector> findAliveByFloorId(TenantId t, UUID floorId) {
        return store.stream()
            .filter(s -> s.floorId().equals(floorId) && s.tenantId().equals(t) && !s.isDeleted())
            .toList();
      }

      public Optional<Sector> findAliveById(TenantId t, SectorId id) {
        return store.stream()
            .filter(s -> s.id().equals(id) && s.tenantId().equals(t) && !s.isDeleted())
            .findFirst();
      }

      public Optional<Sector> findAliveBySlug(TenantId t, UUID floorId, Slug slug) {
        return store.stream()
            .filter(s -> s.floorId().equals(floorId) && s.tenantId().equals(t)
                && s.slug().equals(slug) && !s.isDeleted())
            .findFirst();
      }

      public Sector save(Sector s) {
        store.removeIf(x -> x.id().equals(s.id()));
        store.add(s);
        return s;
      }

      @Override
      public List<Sector> saveAll(List<Sector> sectors) {
        return sectors.stream().map(this::save).toList();
      }
    };
  }

  private SpaceElementRepository pantryElements(List<SpaceElement> data) {
    List<SpaceElement> store = data;
    return new SpaceElementRepository() {
      public List<SpaceElement> findAliveBySectorId(TenantId t, UUID sectorId) {
        return store.stream()
            .filter(e -> e.sectorId().equals(sectorId) && e.tenantId().equals(t) && !e.isDeleted())
            .toList();
      }

      public Optional<SpaceElement> findAliveById(TenantId t, UUID sectorId, SpaceElementId id) {
        return store.stream()
            .filter(e -> e.id().equals(id) && e.sectorId().equals(sectorId)
                && e.tenantId().equals(t) && !e.isDeleted())
            .findFirst();
      }

      public SpaceElement save(SpaceElement e) {
        store.removeIf(x -> x.id().equals(e.id()));
        store.add(e);
        return e;
      }

      @Override
      public List<SpaceElement> saveAll(List<SpaceElement> elements) {
        return elements.stream().map(this::save).toList();
      }
    };
  }
}
