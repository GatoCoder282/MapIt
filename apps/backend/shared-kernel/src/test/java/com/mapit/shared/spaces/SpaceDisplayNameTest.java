package com.mapit.shared.spaces;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class SpaceDisplayNameTest {
  @Test void nombre_canonico_no_inventa_identidad_ni_aforo() {
    assertThat(SpaceDisplayName.format("TABLE", "  Jardín  ")).isEqualTo("Jardín");
    assertThat(SpaceDisplayName.format("TABLE", null)).isEqualTo("Mesa sin nombre");
    for (String type : new String[]{"BAR", "SECTOR_ZONE", "STAGE", "SEAT", "ROOM", "DECOR"}) {
      assertThat(SpaceDisplayName.format(type, " ")).endsWith(" sin nombre").doesNotContain(type);
    }
  }
}
