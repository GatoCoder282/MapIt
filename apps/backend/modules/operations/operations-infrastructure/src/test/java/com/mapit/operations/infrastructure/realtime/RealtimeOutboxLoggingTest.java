package com.mapit.operations.infrastructure.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagPort;
import com.mapit.shared.realtime.RealtimeEvent;
import com.mapit.shared.realtime.SpaceElementState;
import com.mapit.shared.tenant.TenantId;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import tools.jackson.databind.json.JsonMapper;

class RealtimeOutboxLoggingTest {
  private static final Instant NOW = Instant.parse("2026-10-04T12:00:00Z");
  private static final UUID EVENT = UUID.randomUUID();
  private static final UUID ESTABLISHMENT = UUID.randomUUID();
  private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
  private final TransactionTemplate transactions = mock(TransactionTemplate.class);
  private final SimpMessagingTemplate broker = mock(SimpMessagingTemplate.class);
  private final FeatureFlagPort flags = mock(FeatureFlagPort.class);
  private final ListAppender<ILoggingEvent> logs = new ListAppender<>() {
    @Override public void append(ILoggingEvent event) {
      event.prepareForDeferredProcessing();
      super.append(event);
    }
  };
  private final Logger logger = (Logger) LoggerFactory.getLogger("com.mapit.operations.infrastructure.realtime");

  @BeforeEach
  void setUp() {
    logs.start();
    logger.addAppender(logs);
    when(flags.isEnabled(FeatureFlag.REALTIME_WEBSOCKET, true)).thenReturn(true);
    when(jdbc.queryForList(anyString(), eq(String.class))).thenReturn(List.of("tenant-a", "tenant-b"));
    doAnswer(call -> {
      java.util.function.Consumer<org.springframework.transaction.TransactionStatus> callback = call.getArgument(0);
      callback.accept(mock(org.springframework.transaction.TransactionStatus.class));
      return null;
    }).when(transactions).executeWithoutResult(any());
  }

  @AfterEach
  void tearDown() {
    logger.detachAppender(logs);
    MDC.clear();
    if (TransactionSynchronizationManager.isSynchronizationActive()) TransactionSynchronizationManager.clearSynchronization();
    TransactionSynchronizationManager.setActualTransactionActive(false);
  }

  @SuppressWarnings("unchecked")
  private void pending(int attempts) throws Exception {
    ResultSet rs = mock(ResultSet.class);
    when(rs.getObject("event_id", UUID.class)).thenReturn(EVENT);
    when(rs.getObject("establishment_id", UUID.class)).thenReturn(ESTABLISHMENT);
    when(rs.getString("payload")).thenReturn("secret-payload");
    when(rs.getInt("attempts")).thenReturn(attempts);
    when(jdbc.query(anyString(), any(RowMapper.class), anyString(), anyInt()))
        .thenAnswer(call -> List.of(((RowMapper<?>) call.getArgument(1)).mapRow(rs, 0)));
  }

  private void dispatch() {
    new RealtimeOutboxDispatcher(jdbc, transactions, broker, flags,
        Clock.fixed(NOW, ZoneOffset.UTC), 50, 7).dispatchPending();
  }

  @Test
  void publicationsKeepTenantAndEventWithoutLeakingCallerContext() throws Exception {
    pending(0);
    MDC.setContextMap(Map.of("request_id", "old-request", "tenant_id", "old-tenant"));
    dispatch();
    assertThat(logs.list).hasSize(2);
    assertThat(logs.list.get(0).getMDCPropertyMap()).containsEntry("tenant_id", "tenant-a")
        .containsEntry("event_id", EVENT.toString()).doesNotContainKey("request_id");
    assertThat(logs.list.get(1).getMDCPropertyMap()).containsEntry("tenant_id", "tenant-b");
    assertThat(MDC.getCopyOfContextMap()).containsEntry("request_id", "old-request")
        .containsEntry("tenant_id", "old-tenant").doesNotContainKey("event_id");
  }

  @Test
  void retriesPersistOnlyExceptionTypeAndRecordSafeContext() throws Exception {
    pending(0);
    doThrow(new IllegalStateException("password=secret-token")).when(broker).convertAndSend(anyString(), any(Object.class));
    dispatch();
    verify(jdbc).update(contains("last_error = ?"), eq(Timestamp.from(NOW.plusMillis(250))),
        eq("java.lang.IllegalStateException"), eq(EVENT), eq("tenant-a"));
    assertThat(logs.list).hasSize(2);
    for (ILoggingEvent event : logs.list) {
      assertThat(event.getLevel()).isEqualTo(ch.qos.logback.classic.Level.WARN);
      assertThat(event.getThrowableProxy()).isNull();
      assertThat(event.getFormattedMessage() + event.getKeyValuePairs()).doesNotContain("secret", "password");
      assertThat(event.getMDCPropertyMap()).doesNotContainKey("request_id");
    }
    assertThat(MDC.getCopyOfContextMap()).isNullOrEmpty();
  }

  @Test
  void enqueuedEventIsLoggedOnlyAfterCommitWithOriginRequest() {
    TransactionSynchronizationManager.setActualTransactionActive(true);
    TransactionSynchronizationManager.initSynchronization();
    MDC.put("request_id", "origin-request");
    RealtimeEvent event = RealtimeEvent.spaceElementStateChanged(EVENT, NOW, TenantId.of("tenant-a"),
        ESTABLISHMENT, Optional.empty(), UUID.randomUUID(), Optional.empty(), SpaceElementState.AVAILABLE, 1);
    new JdbcRealtimeEventPublisher(jdbc, JsonMapper.builder().build()).publish(event);
    assertThat(logs.list).isEmpty();
    MDC.setContextMap(Map.of("request_id", "other-request"));
    TransactionSynchronizationManager.getSynchronizations().forEach(sync -> sync.afterCommit());
    assertThat(logs.list).hasSize(1);
    assertThat(logs.list.getFirst().getMDCPropertyMap()).containsEntry("request_id", "origin-request")
        .containsEntry("event_id", EVENT.toString()).containsEntry("tenant_id", "tenant-a");
    assertThat(MDC.getCopyOfContextMap()).isEqualTo(Map.of("request_id", "other-request"));
  }

  @Test
  void scheduledTransactionFailureRetainsTenantUntilLoggedAndRestoresCaller() {
    MDC.put("request_id", "caller");
    doThrow(new IllegalStateException("private-canary")).when(transactions).executeWithoutResult(any());
    dispatch();
    assertThat(logs.list).hasSize(1);
    assertThat(logs.list.getFirst().getMDCPropertyMap()).containsEntry("tenant_id", "tenant-a")
        .doesNotContainKey("request_id");
    assertThat(logs.list.getFirst().getLevel()).isEqualTo(ch.qos.logback.classic.Level.ERROR);
    assertThat(MDC.getCopyOfContextMap()).isEqualTo(Map.of("request_id", "caller"));
  }
}
