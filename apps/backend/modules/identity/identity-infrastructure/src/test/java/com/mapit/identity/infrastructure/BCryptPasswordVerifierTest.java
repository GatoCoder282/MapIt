package com.mapit.identity.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

class BCryptPasswordVerifierTest {
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private final BCryptPasswordVerifier verifier = new BCryptPasswordVerifier(encoder);

    @Test
    void verifica_hash_real_y_respeta_espacios() {
        var hash = Optional.of(encoder.encode(" secret "));
        assertThat(verifier.matches(" secret ", hash)).isTrue();
        assertThat(verifier.matches("secret", hash)).isFalse();
        assertThat(verifier.matches("incorrecta", hash)).isFalse();
    }

    @Test
    void hash_ausente_o_corrupto_se_rechaza() {
        assertThat(verifier.matches("secret", Optional.empty())).isFalse();
        assertThat(verifier.matches("secret", Optional.of("corrupto"))).isFalse();
        assertThat(verifier.matches("secret", Optional.of(""))).isFalse();
    }

    @Test
    void rechaza_truncamiento_bcrypt_tambien_con_caracteres_multibyte() {
        String boundary = "é".repeat(36);
        var hash = Optional.of(encoder.encode(boundary));
        assertThat(verifier.matches(boundary, hash)).isTrue();
        assertThat(verifier.matches(boundary + "x", hash)).isFalse();
        assertThat(verifier.matches("x".repeat(73), hash)).isFalse();
    }
}
