package com.mapit.payments.domain.receipt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Base64;
import java.util.HashSet;
import java.util.Set;

import org.junit.jupiter.api.Test;

class ReceiptTokenTest {

  @Test
  void genera_32_bytes_opacos_sin_padding_y_sin_repetir_credenciales() {
    Set<String> values = new HashSet<>();
    for (int index = 0; index < 100; index++) {
      ReceiptToken token = ReceiptToken.generate();
      assertThat(token.presentationValue()).matches("[A-Za-z0-9_-]{43}");
      assertThat(Base64.getUrlDecoder().decode(token.presentationValue())).hasSize(32);
      values.add(token.presentationValue());
    }
    assertThat(values).hasSize(100);
  }

  @Test
  void solo_el_hash_es_persistible_y_to_string_oculta_el_token() {
    ReceiptToken token = ReceiptToken.generate();
    assertThat(token.hash()).matches("[a-f0-9]{64}");
    assertThat(token.hash()).isEqualTo(ReceiptToken.hashOf(token.presentationValue()));
    assertThat(token.toString()).doesNotContain(token.presentationValue()).contains("REDACTED");
    assertThat(ReceiptToken.matches(token.presentationValue(), token.hash())).isTrue();
  }

  @Test
  void rechaza_token_manipulado_y_otra_credencial() {
    ReceiptToken token = ReceiptToken.generate();
    String original = token.presentationValue();
    String changed = (original.charAt(0) == 'A' ? "B" : "A") + original.substring(1);
    assertThat(ReceiptToken.matches(changed, token.hash())).isFalse();
    assertThat(ReceiptToken.matches(ReceiptToken.generate().presentationValue(), token.hash()))
        .isFalse();
  }

  @Test
  void rechaza_formato_invalido_sin_normalizar_ni_aceptar_padding() {
    ReceiptToken token = ReceiptToken.generate();
    for (String invalid : new String[] {"", "123", " " + token.presentationValue(),
        token.presentationValue() + "=", "!".repeat(43), "A".repeat(42) + "B"}) {
      assertThat(ReceiptToken.matches(invalid, token.hash())).isFalse();
      assertThatThrownBy(() -> ReceiptToken.hashOf(invalid))
          .isInstanceOf(IllegalArgumentException.class);
    }
  }

  @Test
  void rechaza_hash_corrupto_como_error_de_persistencia() {
    assertThatThrownBy(() -> ReceiptToken.matches(ReceiptToken.generate().presentationValue(), "bad"))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
