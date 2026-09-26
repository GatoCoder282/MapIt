package com.mapit.operations.domain.state;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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

  @Test
  void permite_todas_las_transiciones_definidas_por_la_maquina_de_estados() {
    assertAllowed(
        SpaceElementState.AVAILABLE,
        SpaceElementState.OCCUPIED,
        SpaceElementState.RESERVED,
        SpaceElementState.OUT_OF_SERVICE);
    assertAllowed(
        SpaceElementState.RESERVED,
        SpaceElementState.AVAILABLE,
        SpaceElementState.OCCUPIED,
        SpaceElementState.OUT_OF_SERVICE);
    assertAllowed(
        SpaceElementState.OCCUPIED,
        SpaceElementState.AVAILABLE,
        SpaceElementState.CLEANING,
        SpaceElementState.OUT_OF_SERVICE);
    assertAllowed(
        SpaceElementState.CLEANING,
        SpaceElementState.AVAILABLE,
        SpaceElementState.OUT_OF_SERVICE);
    assertAllowed(SpaceElementState.OUT_OF_SERVICE, SpaceElementState.AVAILABLE);
  }

  @Test
  void rechaza_transiciones_que_saltan_el_ciclo_operativo() {
    assertRejected(SpaceElementState.OUT_OF_SERVICE, SpaceElementState.RESERVED);
    assertRejected(SpaceElementState.OUT_OF_SERVICE, SpaceElementState.OCCUPIED);
    assertRejected(SpaceElementState.AVAILABLE, SpaceElementState.CLEANING);
    assertRejected(SpaceElementState.CLEANING, SpaceElementState.RESERVED);
    assertRejected(SpaceElementState.RESERVED, SpaceElementState.CLEANING);
  }

  private static void assertAllowed(
      SpaceElementState current, SpaceElementState... destinations) {
    OperationalSpaceElement element = element(current);
    for (SpaceElementState destination : destinations) {
      assertThat(element.changeState(destination, NOW).state()).isEqualTo(destination);
    }
  }

  private static void assertRejected(
      SpaceElementState current, SpaceElementState requested) {
    assertThatThrownBy(() -> element(current).changeState(requested, NOW))
        .isInstanceOf(InvalidSpaceElementStateTransitionException.class)
        .hasMessageContaining(current.name())
        .hasMessageContaining(requested.name());
  }

  private static OperationalSpaceElement element(SpaceElementState state) {
    return new OperationalSpaceElement(
        UUID.randomUUID(), TenantId.of("tenant-a"), UUID.randomUUID(), state, BEFORE);
  }
}
