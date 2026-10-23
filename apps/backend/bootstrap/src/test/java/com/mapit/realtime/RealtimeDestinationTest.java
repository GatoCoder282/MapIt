package com.mapit.realtime;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.mapit.shared.realtime.RealtimeDestination;

class RealtimeDestinationTest {

  private static final UUID ESTABLISHMENT =
      UUID.fromString("00000000-0000-0000-0000-000000000001");
  private static final UUID SECTOR = UUID.fromString("00000000-0000-0000-0000-000000000002");

  @Test
  void acepta_las_dos_salas_versionadas() {
    assertThat(RealtimeDestination.parse("/topic/establishments/" + ESTABLISHMENT))
        .contains(new RealtimeDestination(ESTABLISHMENT, Optional.empty()));
    assertThat(
            RealtimeDestination.parse(
                "/topic/establishments/" + ESTABLISHMENT + "/sectors/" + SECTOR))
        .contains(new RealtimeDestination(ESTABLISHMENT, Optional.of(SECTOR)));
  }

  @Test
  void rechaza_destinos_que_no_son_salas() {
    assertThat(RealtimeDestination.parse("/topic/establishments/not-a-uuid")).isEmpty();
    assertThat(RealtimeDestination.parse("/app/events")).isEmpty();
    assertThat(RealtimeDestination.parse("/topic/establishments/" + ESTABLISHMENT + "/bad/" + SECTOR))
        .isEmpty();
  }
}
