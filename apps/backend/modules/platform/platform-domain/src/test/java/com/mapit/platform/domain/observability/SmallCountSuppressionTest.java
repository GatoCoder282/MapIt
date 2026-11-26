package com.mapit.platform.domain.observability;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.LinkedHashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;

/** HU-7.08 · CA-7: los conteos pequeños no se publican ni se deducen restando. */
class SmallCountSuppressionTest {

  private static Map<String, Long> counts(long a, long b, long c) {
    Map<String, Long> counts = new LinkedHashMap<>();
    counts.put("a", a);
    counts.put("b", b);
    counts.put("c", c);
    return counts;
  }

  @Test
  void oculta_de_uno_a_cuatro_y_muestra_cero_y_cinco() {
    assertThat(SmallCountSuppression.guard(0).value()).isZero();
    assertThat(SmallCountSuppression.guard(1).suppressed()).isTrue();
    assertThat(SmallCountSuppression.guard(4).value()).isNull();
    assertThat(SmallCountSuppression.guard(5).value()).isEqualTo(5);
  }

  @Test
  void si_solo_una_parte_es_pequena_oculta_tambien_la_siguiente_mas_pequena() {
    var breakdown = SmallCountSuppression.guard(counts(2, 9, 20));

    assertThat(breakdown.parts().get("a").suppressed()).isTrue();
    assertThat(breakdown.parts().get("b").suppressed()).isTrue();
    assertThat(breakdown.parts().get("c").value()).isEqualTo(20);
    assertThat(breakdown.total().value()).isEqualTo(31);
  }

  @Test
  void sin_otra_parte_que_ocultar_esconde_el_total() {
    var breakdown = SmallCountSuppression.guard(counts(0, 0, 3));

    assertThat(breakdown.parts().get("c").suppressed()).isTrue();
    assertThat(breakdown.total().suppressed()).isTrue();
  }

  @Test
  void dos_partes_pequenas_ya_no_se_deducen() {
    var breakdown = SmallCountSuppression.guard(counts(2, 3, 20));

    assertThat(breakdown.parts().get("c").value()).isEqualTo(20);
    assertThat(breakdown.total().value()).isEqualTo(25);
  }
}
