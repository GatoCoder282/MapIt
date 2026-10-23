package com.mapit.platform.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;

import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import com.mapit.platform.domain.BusinessVertical;
import com.mapit.platform.domain.Tenant;
import com.mapit.shared.tenant.TenantId;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;

class MailLoggingTest {
  @Test
  void failureAndRecoveryAreControlledWithoutCredentialsOrRepeatedWarnings() {
    var sender = mock(JavaMailSender.class);
    var adapter = new AdminInvitationEmailAdapter(sender, "private-canary@example.test");
    var tenant = Tenant.register(TenantId.of("demo"), "Demo", "demo", BusinessVertical.RESTAURANT, Instant.now());
    var logger = (Logger) LoggerFactory.getLogger(AdminInvitationEmailAdapter.class);
    var previous = logger.getLevel();
    var logs = new ListAppender<ILoggingEvent>();
    logs.start();
    logger.setLevel(ch.qos.logback.classic.Level.INFO);
    logger.addAppender(logs);
    try {
      doThrow(new IllegalStateException("private-canary")).when(sender).send(any(SimpleMailMessage.class));
      for (int i = 0; i < 2; i++) {
        assertThatThrownBy(() -> adapter.send(tenant, "private-canary@example.test", "https://example.test/?token=private-canary"))
            .isInstanceOf(IllegalStateException.class);
      }
      doNothing().when(sender).send(any(SimpleMailMessage.class));
      adapter.send(tenant, "private-canary@example.test", "https://example.test/?token=private-canary");
      assertThat(logs.list).hasSize(2);
      assertThat(logs.list.getFirst().getLevel()).isEqualTo(ch.qos.logback.classic.Level.WARN);
      assertThat(logs.list.getLast().getLevel()).isEqualTo(ch.qos.logback.classic.Level.INFO);
      for (var event : logs.list) {
        assertThat(event.getFormattedMessage() + event.getKeyValuePairs()).doesNotContain("private-canary");
        assertThat(event.getThrowableProxy()).isNull();
      }
    } finally { logger.detachAppender(logs); logger.setLevel(previous); }
  }
}
