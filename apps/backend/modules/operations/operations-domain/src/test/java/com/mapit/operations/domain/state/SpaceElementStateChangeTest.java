package com.mapit.operations.domain.state;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.mapit.shared.realtime.SpaceElementState;
import com.mapit.shared.tenant.TenantId;

class SpaceElementStateChangeTest {

  @Test
  void rechaza_una_auditoria_sin_cambio_real() {
    assertThatThrownBy(
            () ->
                new SpaceElementStateChange(
                    UUID.randomUUID(),
                    TenantId.of("tenant-a"),
                    UUID.randomUUID(),
                    UUID.randomUUID(),
                    SpaceElementState.AVAILABLE,
                    SpaceElementState.AVAILABLE,
                    UUID.randomUUID(),
                    Instant.now()))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("cambio de estado real");
  }
}
