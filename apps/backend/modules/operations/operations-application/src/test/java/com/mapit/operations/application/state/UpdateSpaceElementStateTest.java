package com.mapit.operations.application.state;

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

import com.mapit.operations.domain.state.InvalidSpaceElementStateTransitionException;
import com.mapit.operations.domain.state.OperationalSpaceElement;
import com.mapit.operations.domain.state.SpaceElementStateChange;
import com.mapit.operations.domain.state.SpaceElementStateChangeRepository;
import com.mapit.operations.domain.state.SpaceElementStateRepository;
import com.mapit.shared.realtime.SpaceElementState;
import com.mapit.shared.security.ActorContext;
import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;

class UpdateSpaceElementStateTest {

  private static final TenantId TENANT = TenantId.of("tenant-a");
  private static final UUID SECTOR = UUID.randomUUID();
  private static final UUID ELEMENT = UUID.randomUUID();
  private static final UUID ACTOR = UUID.randomUUID();
  private static final Instant BEFORE = Instant.parse("2026-09-26T12:00:00Z");
  private static final Instant NOW = Instant.parse("2026-09-26T12:05:00Z");

  private InMemoryRepository repository;
  private InMemoryChanges changes;
  private UpdateSpaceElementState useCase;

  @BeforeEach
  void setUp() {
    repository = new InMemoryRepository();
    changes = new InMemoryChanges();
    TenantContext tenants = () -> Optional.of(TENANT);
    ActorContext actors = () -> Optional.of(ACTOR);
    useCase =
        new UpdateSpaceElementState(
            repository, changes, tenants, actors, Clock.fixed(NOW, ZoneOffset.UTC));
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
    assertThat(changes.entries).singleElement().satisfies(change -> {
      assertThat(change.previousState()).isEqualTo(SpaceElementState.AVAILABLE);
      assertThat(change.newState()).isEqualTo(SpaceElementState.OCCUPIED);
      assertThat(change.changedBy()).isEqualTo(ACTOR);
      assertThat(change.changedAt()).isEqualTo(NOW);
    });
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
    assertThat(changes.entries).isEmpty();
  }

  @Test
  void consulta_el_historial_solo_despues_de_validar_el_elemento() {
    repository.element =
        new OperationalSpaceElement(
            ELEMENT, TENANT, SECTOR, SpaceElementState.OCCUPIED, NOW);
    changes.entries.add(
        new SpaceElementStateChange(
            UUID.randomUUID(),
            TENANT,
            SECTOR,
            ELEMENT,
            SpaceElementState.AVAILABLE,
            SpaceElementState.OCCUPIED,
            ACTOR,
            NOW));
    ListSpaceElementStateChanges history =
        new ListSpaceElementStateChanges(repository, changes, () -> Optional.of(TENANT));

    List<SpaceElementStateChangeResult> result = history.execute(SECTOR, ELEMENT);

    assertThat(result).singleElement().satisfies(change -> {
      assertThat(change.elementId()).isEqualTo(ELEMENT);
      assertThat(change.changedBy()).isEqualTo(ACTOR);
    });
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

  @Test
  void una_transicion_invalida_no_persiste_ni_registra_auditoria() {
    repository.element =
        new OperationalSpaceElement(
            ELEMENT, TENANT, SECTOR, SpaceElementState.OUT_OF_SERVICE, BEFORE);

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateSpaceElementStateCommand(
                        SECTOR, ELEMENT, SpaceElementState.RESERVED)))
        .isInstanceOf(InvalidSpaceElementStateTransitionException.class);

    assertThat(repository.element.state()).isEqualTo(SpaceElementState.OUT_OF_SERVICE);
    assertThat(repository.saves).isZero();
    assertThat(changes.entries).isEmpty();
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

  private static final class InMemoryChanges implements SpaceElementStateChangeRepository {
    private final List<SpaceElementStateChange> entries = new ArrayList<>();

    @Override
    public void append(SpaceElementStateChange change) {
      entries.add(change);
    }

    @Override
    public List<SpaceElementStateChange> findByElement(
        TenantId tenantId, UUID sectorId, UUID elementId) {
      return entries.stream()
          .filter(change -> change.tenantId().equals(tenantId))
          .filter(change -> change.sectorId().equals(sectorId))
          .filter(change -> change.elementId().equals(elementId))
          .toList();
    }
  }
}
