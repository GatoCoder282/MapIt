package com.mapit.spaces.application.sector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.Slug;
import com.mapit.spaces.domain.sector.Sector;
import com.mapit.spaces.domain.sector.SectorId;
import com.mapit.spaces.domain.sector.SectorRepository;

/**
 * Reglas de {@link UpdateSectorUseCase} con el puerto en memoria (sin Spring).
 *
 * <p>Cubren el bug del 500 al editar el nombre (el slug llegaba {@code null} y
 * {@code Slug.of} explotaba) y el falso 409 al guardar sin cambiar el nombre.
 */
class UpdateSectorUseCaseTest {

  private static final TenantId TENANT = TenantId.of("tenant-a");
  private static final Instant AHORA = Instant.parse("2026-09-24T12:00:00Z");
  private static final UUID FLOOR_ID = UUID.randomUUID();

  private final List<Sector> sectores = new ArrayList<>();
  private UpdateSectorUseCase useCase;

  @BeforeEach
  void setUp() {
    sectores.clear();
    useCase = new UpdateSectorUseCase(new InMemorySectorRepository(), () -> Optional.of(TENANT));
  }

  private Sector alta(String nombre, String slug) {
    Sector sector =
        Sector.register(
            SectorId.of(UUID.randomUUID()), TENANT, FLOOR_ID, nombre, 40,
            Slug.of(slug), AHORA, null);
    sectores.add(sector);
    return sector;
  }

  @Test
  void update_con_slug_vacio_lo_deriva_del_nuevo_nombre() {
    Sector sector = alta("Entregas", "entregas");

    SectorResponse respuesta =
        useCase.update(new UpdateSectorCommand(sector.id().value(), "Envío por delivery", "", null));

    assertThat(respuesta.name()).isEqualTo("Envío por delivery");
    assertThat(respuesta.slug()).isEqualTo("envio-por-delivery");
  }

  @Test
  void update_sin_slug_vuelve_nulo_tambien_se_deriva_del_nombre() {
    Sector sector = alta("Entregas", "entregas");

    SectorResponse respuesta =
        useCase.update(new UpdateSectorCommand(sector.id().value(), "Entregas 3", null, null));

    assertThat(respuesta.slug()).isEqualTo("entregas-3");
  }

  @Test
  void update_sin_cambiar_el_nombre_no_conflicta_consigo_mismo() {
    Sector sector = alta("Entregas", "entregas");

    SectorResponse respuesta =
        useCase.update(new UpdateSectorCommand(sector.id().value(), "Entregas", null, null));

    assertThat(respuesta.slug()).isEqualTo("entregas");
  }

  @Test
  void update_rechaza_slug_que_ya_usa_otro_sector_del_mismo_piso() {
    alta("Salón", "salon");
    Sector otro = alta("Entregas", "entregas");

    assertThatThrownBy(
            () -> useCase.update(new UpdateSectorCommand(otro.id().value(), "Salón", null, null)))
        .isInstanceOf(SectorSlugAlreadyExistsException.class);
  }

  @Test
  void update_de_sector_inexistente_lanza_not_found() {
    assertThatThrownBy(
            () -> useCase.update(new UpdateSectorCommand(UUID.randomUUID(), "X", null, null)))
        .isInstanceOf(SectorNotFoundException.class);
  }

  /** Puerto en memoria: solo operaciones vivas, como exige el contrato del dominio. */
  private final class InMemorySectorRepository implements SectorRepository {

    @Override
    public List<Sector> findAliveByFloorId(TenantId tenantId, UUID floorId) {
      return sectores.stream()
          .filter(s -> s.tenantId().equals(tenantId) && s.floorId().equals(floorId))
          .toList();
    }

    @Override
    public Optional<Sector> findAliveById(TenantId tenantId, SectorId id) {
      return sectores.stream()
          .filter(s -> s.tenantId().equals(tenantId) && s.id().equals(id))
          .findFirst();
    }

    @Override
    public Optional<Sector> findAliveBySlug(TenantId tenantId, UUID floorId, Slug slug) {
      return sectores.stream()
          .filter(
              s ->
                  s.tenantId().equals(tenantId)
                      && s.floorId().equals(floorId)
                      && s.slug().equals(slug))
          .findFirst();
    }

    @Override
    public Sector save(Sector sector) {
      sectores.removeIf(s -> s.id().equals(sector.id()));
      sectores.add(sector);
      return sector;
    }
  }
}
