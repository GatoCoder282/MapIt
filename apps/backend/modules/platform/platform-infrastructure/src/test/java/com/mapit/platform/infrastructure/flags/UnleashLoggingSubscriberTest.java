package com.mapit.platform.infrastructure.flags;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Arrays;

import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import io.getunleash.UnleashException;
import io.getunleash.event.ClientFeaturesResponse;

class UnleashLoggingSubscriberTest {
  @Test
  void logsStateChangesRatherThanEveryPollingFailure() {
    var subscriber = new UnleashLoggingSubscriber();
    var logger = (Logger) LoggerFactory.getLogger(UnleashLoggingSubscriber.class);
    var logs = new ListAppender<ILoggingEvent>();
    logs.start();
    logger.addAppender(logs);
    try {
      var exception = mock(UnleashException.class);
      when(exception.getMessage()).thenReturn("private-canary");
      subscriber.onError(exception);
      subscriber.onError(exception);
      var unavailable = mock(ClientFeaturesResponse.class);
      when(unavailable.getStatus()).thenReturn(ClientFeaturesResponse.Status.UNAVAILABLE);
      subscriber.togglesFetched(unavailable);
      var recovered = mock(ClientFeaturesResponse.class);
      when(recovered.getStatus()).thenReturn(Arrays.stream(ClientFeaturesResponse.Status.values())
          .filter(status -> status != ClientFeaturesResponse.Status.UNAVAILABLE).findFirst().orElseThrow());
      subscriber.togglesFetched(recovered);
      subscriber.togglesFetched(recovered);
      assertThat(logs.list).hasSize(2);
      for (var event : logs.list) assertThat(event.getFormattedMessage() + event.getKeyValuePairs()).doesNotContain("private-canary");
    } finally { logger.detachAppender(logs); }
  }
}
