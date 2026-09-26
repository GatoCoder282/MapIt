package com.mapit.spaces.application.floor;

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

import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.Slug;
import com.mapit.spaces.domain.establishment.Establishment;
import com.mapit.spaces.domain.establishment.EstablishmentRepository;
import com.mapit.spaces.domain.establishment.EstablishmentType;
import com.mapit.spaces.domain.floor.Floor;
import com.mapit.spaces.domain.floor.FloorRepository;
import com.mapit.spaces.domain.sector.Sector;
import com.mapit.spaces.domain.sector.SectorId;
import com.mapit.spaces.domain.sector.SectorRepository;

/**
 * Reglas de {@link FloorService} con puertos en memoria (sin Spring).
 *
 * <p>Cubren los dos puntos débiles históricos del servicio: la generación de slug
 * (ahora delegada en {@link Slug#fromName}) y la prohibición de dar de baja un piso
 * con sectores vivos.
 */
class FloorServiceTest {

  private static final TenantId TENANT = TenantId.of("tenant-a");
  private static final Instant AHORA = Instant.parse("2026-09-24T12:00:00Z");
  private static final UUID EST_ID = UUID.randomUUID();

  private final List<Floor> pisos = new ArrayList<>();
  private final List<Sector> sectores = new ArrayList<>();
  private Establishment establecimiento;
  private FloorService service;

  @BeforeEach
  void setUp() {
    establecimiento =
        Establishment.register(
            EST_ID, TENANT, "Bar Central", EstablishmentType.RESTAURANT, Slug.of("bar-central"),
            null, "Europe/Madrid", AHORA, null);
    service =
        new FloorService(
            new FakeFloorRepository(), new FakeEstablishmentRepository(), new FakeSectorRepository(),
            () -> Optional.of(TENANT), Clock.fixed(AHORA, ZoneOffset.UTC));
  }

  @Test
  void create_deriva_el_slug_del_nombre_con_la_regla_canonica() {
    Floor creado = service.create(EST_ID, "Planta Baja", null, null);
    assertThat(creado.slug()).isEqualTo(Slug.of("planta-baja"));
  }

  @Test
  void create_normaliza_tildes_y_enie_con_slug_fromname() {
    Floor creado = service.create(EST_ID, "Salón Año Nuevo", null, null);
    assertThat(creado.slug()).isEqualTo(Slug.of("salon-ano-nuevo"));
  }

  @Test
  void create_resuelve_colisiones_de_slug_con_sufijo() {
    service.create(EST_ID, "Planta Baja", null, null);
    Floor segundo = service.create(EST_ID, "Planta Baja", null, null);
    assertThat(segundo.slug()).isEqualTo(Slug.of("planta-baja-1"));
  }

  @Test
  void create_rechaza_slug_duplicado_cuando_se_indica_explicito() {
    service.create(EST_ID, "Uno", null, "terraza");
    assertThatThrownBy(() -> service.create(EST_ID, "Dos", null, "terraza"))
        .isInstanceOf(FloorSlugAlreadyExistsException.class);
  }

  @Test
  void softDelete_marca_la_baja_cuando_no_hay_sectores_vivos() {
    Floor piso = service.create(EST_ID, "Planta Baja", null, null);
    service.softDelete(piso.id());
    assertThat(pisos).singleElement().satisfies(f -> assertThat(f.audit().deletedAt())
        .isNotNull());
  }

  @Test
  void softDelete_rechaza_cuando_el_piso_tiene_sectores_vivos() {
    Floor piso = service.create(EST_ID, "Planta Baja", null, null);
    sectores.add(
        Sector.register(
            SectorId.of(UUID.randomUUID()), TENANT, piso.id(), "Salón", 20,
            Slug.of("salon"), AHORA, null));

    assertThatThrownBy(() -> service.softDelete(piso.id()))
        .isInstanceOf(FloorHasActiveSectorsException.class);
    // Y no se toca la fila
    assertThat(pisos.get(0).audit().deletedAt()).isNull();
  }

  @Test
  void softDelete_de_sector_ajeno_no_cuenta_para_la_regla() {
    Floor piso = service.create(EST_ID, "Planta Baja", null, null);
    sectores.add(
        Sector.register(
            SectorId.of(UUID.randomUUID()), TenantId.of("otro-tenant"), piso.id(), "Ajeno", 20,
            Slug.of("ajeno"), AHORA, null));

    service.softDelete(piso.id());
    assertThat(pisos.get(0).audit().deletedAt()).isNotNull();
  }

  // ── Puertos en memoria ───────────────────────────────────────────────────

  private final class FakeFloorRepository implements FloorRepository {
    @Override
    public List<Floor> findAliveByEstablishmentId(TenantId tenantId, UUID establishmentId) {
      return pisos.stream()
          .filter(f -> f.tenantId().equals(tenantId))
          .filter(f -> f.establishmentId().equals(establishmentId))
          .filter(f -> !f.isDeleted())
          .toList();
    }

    @Override
    public Optional<Floor> findAliveById(TenantId tenantId, UUID id) {
      return pisos.stream()
          .filter(f -> f.tenantId().equals(tenantId))
          .filter(f -> f.id().equals(id))
          .filter(f -> !f.isDeleted())
          .findFirst();
    }

    @Override
    public Optional<Floor> findAliveBySlug(TenantId tenantId, UUID establishmentId, Slug slug) {
      return pisos.stream()
          .filter(f -> f.tenantId().equals(tenantId))
          .filter(f -> f.establishmentId().equals(establishmentId))
          .filter(f -> !f.isDeleted())
          .filter(f -> f.slug() != null && f.slug().equals(slug))
          .findFirst();
    }

    @Override
    public boolean existsAliveByLevel(TenantId tenantId, UUID establishmentId, int level) {
      return pisos.stream()
          .anyMatch(
              f ->
                  f.tenantId().equals(tenantId)
                      && f.establishmentId().equals(establishmentId)
                      && !f.isDeleted()
                      && f.level() == level);
    }

    @Override
    public Optional<Integer> findMaxLevel(TenantId tenantId, UUID establishmentId) {
      return pisos.stream()
          .filter(f -> f.tenantId().equals(tenantId))
          .filter(f -> f.establishmentId().equals(establishmentId))
          .filter(f -> !f.isDeleted())
          .map(Floor::level)
          .max(Integer::compareTo);
    }

    @Override
    public Floor save(Floor floor) {
      pisos.removeIf(f -> f.id().equals(floor.id()));
      pisos.add(floor);
      return floor;
    }
  }

  private final class FakeEstablishmentRepository implements EstablishmentRepository {
    @Override
    public List<Establishment> findAllAlive(TenantId tenantId) {
      return List.of(establecimiento);
    }

    @Override
    public Optional<Establishment> findAliveById(TenantId tenantId, UUID id) {
      return Optional.of(establecimiento);
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

  private final class FakeSectorRepository implements SectorRepository {
    @Override
    public List<Sector> findAliveByFloorId(TenantId tenantId, UUID floorId) {
      return sectores.stream()
          .filter(s -> s.tenantId().equals(tenantId))
          .filter(s -> s.floorId().equals(floorId))
          .filter(s -> !s.isDeleted())
          .toList();
    }

    @Override
    public Optional<Sector> findAliveById(TenantId tenantId, SectorId id) {
      return sectores.stream()
          .filter(s -> s.tenantId().equals(tenantId))
          .filter(s -> s.id().equals(id))
          .filter(s -> !s.isDeleted())
          .findFirst();
    }

    @Override
    public Optional<Sector> findAliveBySlug(TenantId tenantId, UUID floorId, Slug slug) {
      return sectores.stream()
          .filter(s -> s.tenantId().equals(tenantId))
          .filter(s -> s.floorId().equals(floorId))
          .filter(s -> !s.isDeleted())
          .filter(s -> s.slug().equals(slug))
          .findFirst();
    }

    @Override
    public Sector save(Sector sector) {
      sectores.add(sector);
      return sector;
    }
  }
}
