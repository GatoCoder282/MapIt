package com.mapit.operations.application.state;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.mapit.operations.domain.state.OperationalSpaceElement;
import com.mapit.operations.domain.state.SpaceElementStateRepository;
import com.mapit.shared.realtime.SpaceElementState;
import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;

class UpdateSpaceElementStateTest {

  private static final TenantId TENANT = TenantId.of("tenant-a");
  private static final UUID SECTOR = UUID.randomUUID();
  private static final UUID ELEMENT = UUID.randomUUID();
  private static final Instant BEFORE = Instant.parse("2026-09-26T12:00:00Z");
  private static final Instant NOW = Instant.parse("2026-09-26T12:05:00Z");

  private InMemoryRepository repository;
  private UpdateSpaceElementState useCase;

  @BeforeEach
  void setUp() {
    repository = new InMemoryRepository();
    TenantContext tenants = () -> Optional.of(TENANT);
    useCase =
        new UpdateSpaceElementState(
            repository, tenants, Clock.fixed(NOW, ZoneOffset.UTC));
  }

  @Test
  void actualiza_un_elemento_del_tenant_y_sector_actuales() {
    repository.element =
        new OperationalSpaceElement(
            ELEMENT, TENANT, SECTOR, SpaceElementState.AVAILABLE, BEFORE);

    SpaceElementStateResult result =
        useCase.execute(
            new UpdateSpaceElementStateCommand(
                SECTOR, ELEMENT, SpaceElementState.OCCUPIED));

    assertThat(result.state()).isEqualTo(SpaceElementState.OCCUPIED);
    assertThat(result.updatedAt()).isEqualTo(NOW);
    assertThat(repository.saves).isEqualTo(1);
    assertThat(repository.lastTenant).isEqualTo(TENANT);
  }

  @Test
  void repetir_el_estado_no_escribe_de_nuevo() {
    repository.element =
        new OperationalSpaceElement(
            ELEMENT, TENANT, SECTOR, SpaceElementState.AVAILABLE, BEFORE);

    SpaceElementStateResult result =
        useCase.execute(
            new UpdateSpaceElementStateCommand(
                SECTOR, ELEMENT, SpaceElementState.AVAILABLE));

    assertThat(result.updatedAt()).isEqualTo(BEFORE);
    assertThat(repository.saves).isZero();
  }

  @Test
  void oculta_elementos_inexistentes_o_fuera_del_alcance() {
    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateSpaceElementStateCommand(
                        SECTOR, ELEMENT, SpaceElementState.CLEANING)))
        .isInstanceOf(OperationalSpaceElementNotFoundException.class);
  }

  private static final class InMemoryRepository implements SpaceElementStateRepository {
    private OperationalSpaceElement element;
    private TenantId lastTenant;
    private int saves;

    @Override
    public Optional<OperationalSpaceElement> findAliveById(
        TenantId tenantId, UUID sectorId, UUID elementId) {
      lastTenant = tenantId;
      if (element == null
          || !element.tenantId().equals(tenantId)
          || !element.sectorId().equals(sectorId)
          || !element.id().equals(elementId)) {
        return Optional.empty();
      }
      return Optional.of(element);
    }

    @Override
    public OperationalSpaceElement save(OperationalSpaceElement changed) {
      element = changed;
      saves++;
      return element;
    }
  }
}
