package com.mapit.spaces.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** Formato del slug público del establecimiento (CU-15). */
class SlugTest {

  @ParameterizedTest
  @ValueSource(strings = {"bar-central", "a1", "mi-local-2026", "hotel1"})
  void acepta_minusculas_digitos_y_guiones(String valido) {
    assertThat(Slug.of(valido).value()).isEqualTo(valido);
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "Bar-Central", // mayúsculas
        "-empieza-con-guion", // no puede empezar por guion
        "a", // demasiado corto
        "con espacios",
        "con_guion_bajo",
        "acentós"
      })
  void rechaza_formatos_invalidos(String invalido) {
    assertThatThrownBy(() -> Slug.of(invalido))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Slug inválido");
  }

  @Test
  void recorta_los_espacios_de_los_extremos() {
    assertThat(Slug.of("  bar-central  ").value()).isEqualTo("bar-central");
  }

  @Test
  void rechaza_null() {
    assertThatThrownBy(() -> Slug.of(null)).isInstanceOf(NullPointerException.class);
  }

  @Test
  void dos_slugs_con_el_mismo_texto_son_iguales() {
    assertThat(Slug.of("bar-central")).isEqualTo(Slug.of("bar-central"));
  }
}
