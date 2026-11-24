package com.mapit.identity.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import com.mapit.identity.application.OwnPasswordChange;
import com.mapit.identity.application.OwnPasswordChangeFailure;
import com.mapit.identity.application.OwnPasswordChangeFailure.Reason;
import com.mapit.identity.application.OwnPasswordChangeValidator;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;

class OwnPasswordChangePreparationTest {
  private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
  private final BCryptPasswordHasher hasher = new BCryptPasswordHasher(encoder);
  private final OwnPasswordChangeValidator validator = new OwnPasswordChangeValidator(new BCryptPasswordVerifier(encoder));

  @Test
  void verifiesRealBcryptHashAndDetectsReuseWithoutProducingANewHash() {
    String current = "Espacios1! ";
    var stored = Optional.of(hasher.hash(current));
    validator.validate(new OwnPasswordChange(current, "NuevaValida2!", "NuevaValida2!"), stored);
    assertReason(new OwnPasswordChange(current.strip(), "NuevaValida2!", "NuevaValida2!"), stored, Reason.INVALID_CURRENT_PASSWORD);
    assertReason(new OwnPasswordChange(current, current, current), stored, Reason.PASSWORD_REUSED);
    assertReason(new OwnPasswordChange(current, "NuevaValida2!", "NuevaValida2!"), Optional.of("corrupt"), Reason.INVALID_CURRENT_PASSWORD);
    assertThat(encoder.matches(current, stored.orElseThrow())).isTrue();
  }

  @Test
  void acceptsCurrentSeventyTwoBytesButNeverAcceptsATruncatedSuffix() {
    String current = "Aa1!" + "é".repeat(34);
    var hash = Optional.of(hasher.hash(current));
    validator.validate(new OwnPasswordChange(current, "NuevaValida2!", "NuevaValida2!"), hash);
    assertReason(new OwnPasswordChange(current + "x", "NuevaValida2!", "NuevaValida2!"), hash, Reason.INVALID_REQUEST);
  }

  @Test
  void payloadIsClosedAndTypedWithNoIdentityOrPrivileges() {
    Map<String, Object> body = Map.of("currentPassword", "Anterior1!", "newPassword", "NuevaValida2!", "newPasswordConfirm", "NuevaValida2!");
    var command = OwnPasswordChangePayload.read(body);
    assertThat(command.currentPassword()).isEqualTo("Anterior1!");
    for (String field : new String[] {"userId", "tenantId", "email", "role", "roles", "memberships", "privileges", "active", "status", "unknown"}) {
      var extra = new HashMap<>(body);
      extra.put(field, "private-canary");
      assertThatThrownBy(() -> OwnPasswordChangePayload.read(extra)).isInstanceOf(OwnPasswordChangeFailure.class)
          .hasMessage("Solicitud de cambio de contraseña no válida.");
    }
    for (String field : body.keySet()) {
      var missing = new HashMap<>(body);
      missing.remove(field);
      assertThatThrownBy(() -> OwnPasswordChangePayload.read(missing)).isInstanceOf(OwnPasswordChangeFailure.class);
      var wrongType = new HashMap<>(body);
      wrongType.put(field, 123);
      assertThatThrownBy(() -> OwnPasswordChangePayload.read(wrongType)).isInstanceOf(OwnPasswordChangeFailure.class);
      wrongType.put(field, null);
      assertThatThrownBy(() -> OwnPasswordChangePayload.read(wrongType)).isInstanceOf(OwnPasswordChangeFailure.class);
    }
    assertThat(command.toString()).doesNotContain("Anterior1!", "NuevaValida2!");
  }

  @Test
  void validationDoesNotLogCredentialsOrHashes() {
    var logger = (Logger) LoggerFactory.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME);
    var logs = new ListAppender<ILoggingEvent>();
    logs.start();
    logger.addAppender(logs);
    try {
      var hash = Optional.of(hasher.hash("PrivateCurrent1!"));
      validator.validate(new OwnPasswordChange("PrivateCurrent1!", "PrivateNext2!", "PrivateNext2!"), hash);
      assertReason(new OwnPasswordChange("PrivateWrong3!", "PrivateNext2!", "PrivateNext2!"), hash, Reason.INVALID_CURRENT_PASSWORD);
      for (var event : logs.list) {
        assertThat(event.getFormattedMessage()).doesNotContain("PrivateCurrent1!", "PrivateNext2!", "PrivateWrong3!", hash.orElseThrow());
      }
    } finally {
      logger.detachAppender(logs);
      logs.stop();
    }
  }

  private void assertReason(OwnPasswordChange command, Optional<String> hash, Reason reason) {
    assertThatThrownBy(() -> validator.validate(command, hash)).isInstanceOfSatisfying(OwnPasswordChangeFailure.class,
        error -> assertThat(error.reason()).isEqualTo(reason));
  }
}
