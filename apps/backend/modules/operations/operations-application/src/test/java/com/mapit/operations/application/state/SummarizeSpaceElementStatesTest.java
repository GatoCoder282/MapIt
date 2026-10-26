package com.mapit.operations.application.state;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.EnumMap;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.mapit.operations.domain.state.SpaceElementStateSummaryRepository;
import com.mapit.shared.realtime.SpaceElementState;
import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;

class SummarizeSpaceElementStatesTest {

  private static final TenantId TENANT = TenantId.of("tenant-a");

  private InMemoryRepository repository;
  private SummarizeSpaceElementStates useCase;

  @BeforeEach
  void setUp() {
    repository = new InMemoryRepository();
    TenantContext tenants = () -> Optional.of(TENANT);
    useCase = new SummarizeSpaceElementStates(repository, tenants);
  }

  @Test
  void resuelve_el_tenant_y_devuelve_los_recuentos_del_puerto() {
    repository.counts.put(SpaceElementState.AVAILABLE, 3L);

    SpaceElementStateSummaryResult result = useCase.execute();

    assertThat(repository.lastTenant).isEqualTo(TENANT);
    assertThat(result.total()).isEqualTo(3);
    assertThat(result.byState()).containsEntry(SpaceElementState.AVAILABLE, 3);
  }

  @Test
  void los_cinco_estados_estan_siempre_presentes_y_el_total_suma_todos() {
    repository.counts.put(SpaceElementState.OCCUPIED, 2L);
    repository.counts.put(SpaceElementState.RESERVED, 1L);

    SpaceElementStateSummaryResult result = useCase.execute();

    assertThat(result.byState()).containsKeys(SpaceElementState.values());
    assertThat(result.byState().get(SpaceElementState.CLEANING)).isZero();
    assertThat(result.byState().get(SpaceElementState.OUT_OF_SERVICE)).isZero();
    assertThat(result.total()).isEqualTo(3);
  }

  @Test
  void sin_tenant_en_la_sesion_falla_cerrado() {
    SummarizeSpaceElementStates anonymous =
        new SummarizeSpaceElementStates(repository, Optional::empty);

    assertThatThrownBy(anonymous::execute).isInstanceOf(IllegalStateException.class);
    assertThat(repository.lastTenant).isNull();
  }

  private static final class InMemoryRepository implements SpaceElementStateSummaryRepository {
    private final Map<SpaceElementState, Long> counts = new EnumMap<>(SpaceElementState.class);
    private TenantId lastTenant;

    @Override
    public Map<SpaceElementState, Long> countByState(TenantId tenantId) {
      lastTenant = tenantId;
      return counts;
    }
  }
}
