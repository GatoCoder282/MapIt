package com.mapit.identity.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

import com.mapit.identity.application.OwnPasswordChangeFailure.Reason;

class OwnPasswordChangeValidatorTest {
  private static final String CURRENT = "Anterior1!";
  private static final String NEXT = "Siguiente2!";
  private final AtomicInteger comparisons = new AtomicInteger();
  private final OwnPasswordChangeValidator validator = new OwnPasswordChangeValidator((raw, hash) -> {
    comparisons.incrementAndGet();
    return hash.isPresent() && CURRENT.equals(raw);
  });

  @Test
  void validatesWithoutReturningHashOrMutatingCredentials() {
    validator.validate(new OwnPasswordChange(CURRENT, NEXT, NEXT), Optional.of("trusted-hash"));
    assertThat(comparisons.get()).isEqualTo(2);
  }

  @Test
  void rejectsWrongCurrentAbsentHashReuseAndConfirmation() {
    failure(new OwnPasswordChange("Incorrecta1!", NEXT, NEXT), Reason.INVALID_CURRENT_PASSWORD);
    assertThatThrownBy(() -> validator.validate(new OwnPasswordChange(CURRENT, NEXT, NEXT), Optional.empty()))
        .isInstanceOf(OwnPasswordChangeFailure.class);
    failure(new OwnPasswordChange(CURRENT, CURRENT, CURRENT), Reason.PASSWORD_REUSED);
    failure(new OwnPasswordChange(CURRENT, NEXT, "Diferente3!"), Reason.CONFIRMATION_MISMATCH);
  }

  @ParameterizedTest
  @MethodSource("invalidPasswords")
  void respectsExistingCompositionPolicy(String value) {
    failure(new OwnPasswordChange(CURRENT, value, value), Reason.INVALID_NEW_PASSWORD);
  }

  static Stream<String> invalidPasswords() {
    return Stream.of("Aa1!abc", "sinmayuscula1!", "SINMINUSCULA1!", "SinNumero!", "SinSimbolo1");
  }

  @Test
  void boundsBytesAndMalformedInputsBeforeAnyExpensiveComparison() {
    for (var command : new OwnPasswordChange[] {
        new OwnPasswordChange(null, NEXT, NEXT), new OwnPasswordChange(CURRENT, null, NEXT),
        new OwnPasswordChange(CURRENT, NEXT, null), new OwnPasswordChange("", NEXT, NEXT),
        new OwnPasswordChange("x".repeat(73), NEXT, NEXT),
        new OwnPasswordChange(CURRENT, "Aa1!" + "é".repeat(35), NEXT),
        new OwnPasswordChange(CURRENT, NEXT, "x".repeat(73)),
        new OwnPasswordChange(CURRENT, "Aa1!bad\uD800", "Aa1!bad\uD800")}) {
      failure(command, Reason.INVALID_REQUEST);
    }
    assertThat(comparisons.get()).isZero();
  }

  @Test
  void acceptsExactlySeventyTwoUtf8BytesAndPreservesWhitespace() {
    for (String next : new String[] {"Aa1!" + "x".repeat(68), "Aa1!" + "é".repeat(34),
        "Aa1!" + "😀".repeat(17), " Siguiente2! "}) {
      validator.validate(new OwnPasswordChange(CURRENT, next, next), Optional.of("trusted-hash"));
    }
  }

  @Test
  void commandAndFailuresNeverIncludeSecretsOrHash() {
    var command = new OwnPasswordChange("private-current", "private-next", "private-confirm");
    assertThat(command.toString()).isEqualTo("OwnPasswordChange[REDACTED]");
    for (Reason reason : Reason.values()) {
      var failure = new OwnPasswordChangeFailure(reason);
      assertThat(failure.toString()).doesNotContain("private-current", "private-next", "private-confirm", "trusted-hash");
      assertThat(failure.getCause()).isNull();
    }
  }

  private void failure(OwnPasswordChange command, Reason reason) {
    assertThatThrownBy(() -> validator.validate(command, Optional.of("trusted-hash")))
        .isInstanceOfSatisfying(OwnPasswordChangeFailure.class, error -> assertThat(error.reason()).isEqualTo(reason));
  }
}
