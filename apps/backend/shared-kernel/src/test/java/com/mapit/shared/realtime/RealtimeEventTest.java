package com.mapit.shared.realtime;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.mapit.shared.tenant.TenantId;

class RealtimeEventTest {

  @Test
  void exige_tipo_version_y_version_de_agregado_validos() {
    UUID id = UUID.randomUUID();
    assertThatThrownBy(
            () ->
                new RealtimeEvent(
                    id,
                    "other.event.v1",
                    1,
                    Instant.now(),
                    TenantId.of("demo"),
                    id,
                    Optional.empty(),
                    id,
                    Optional.empty(),
                    SpaceElementState.AVAILABLE,
                    1))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(
            () ->
                RealtimeEvent.spaceElementStateChanged(
                    id,
                    Instant.now(),
                    TenantId.of("demo"),
                    id,
                    Optional.empty(),
                    id,
                    Optional.empty(),
                    SpaceElementState.AVAILABLE,
                    0))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
