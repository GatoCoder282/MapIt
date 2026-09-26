package com.mapit.operations.domain.state;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.mapit.shared.realtime.SpaceElementState;
import com.mapit.shared.tenant.TenantId;

class OperationalSpaceElementTest {

  private static final Instant BEFORE = Instant.parse("2026-09-26T12:00:00Z");
  private static final Instant NOW = Instant.parse("2026-09-26T12:05:00Z");

  @Test
  void cambia_el_estado_y_el_instante_de_actualizacion() {
    OperationalSpaceElement element = element(SpaceElementState.AVAILABLE);

    OperationalSpaceElement changed = element.changeState(SpaceElementState.OCCUPIED, NOW);

    assertThat(changed.state()).isEqualTo(SpaceElementState.OCCUPIED);
    assertThat(changed.updatedAt()).isEqualTo(NOW);
  }

  @Test
  void repetir_el_estado_es_idempotente() {
    OperationalSpaceElement element = element(SpaceElementState.AVAILABLE);

    assertThat(element.changeState(SpaceElementState.AVAILABLE, NOW)).isSameAs(element);
  }

  private static OperationalSpaceElement element(SpaceElementState state) {
    return new OperationalSpaceElement(
        UUID.randomUUID(), TenantId.of("tenant-a"), UUID.randomUUID(), state, BEFORE);
  }
}
