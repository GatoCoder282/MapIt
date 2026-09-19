package com.mapit.realtime;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.converter.StringMessageConverter;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.mapit.identity.domain.AccessTokenIssuer;
import com.mapit.identity.domain.AuthenticatedUser;
import com.mapit.identity.domain.UserRole;
import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagPort;
import com.mapit.shared.realtime.RealtimeEvent;
import com.mapit.shared.realtime.RealtimeEventPublisher;
import com.mapit.shared.realtime.RealtimeRoomAccessPort;
import com.mapit.shared.realtime.SpaceElementState;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

/** Smoke E2E del handshake, sala, publicación del outbox y cierre del socket. */
@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@Import(RealtimeWebSocketIntegrationTest.TestFlags.class)
class RealtimeWebSocketIntegrationTest {

  private static final UUID USER = UUID.fromString("00000000-0000-0000-0000-000000000011");
  private static final UUID ESTABLISHMENT =
      UUID.fromString("00000000-0000-0000-0000-000000000012");

  @Container
  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16-alpine")
          .withDatabaseName("mapit")
          .withUsername("mapit")
          .withPassword("test_password");

  @LocalServerPort private int port;
  @Autowired private JdbcTemplate jdbc;
  @Autowired private TransactionTemplate transactions;
  @Autowired private AccessTokenIssuer tokenIssuer;
  @Autowired private RealtimeEventPublisher publisher;
  @Autowired private RealtimeRoomAccessPort roomAccess;
  @Autowired private com.mapit.operations.infrastructure.realtime.RealtimeOutboxDispatcher dispatcher;

  private WebSocketStompClient client;

  @DynamicPropertySource
  static void databaseProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.flyway.url", POSTGRES::getJdbcUrl);
    registry.add("spring.flyway.user", POSTGRES::getUsername);
    registry.add("spring.flyway.password", POSTGRES::getPassword);
    registry.add("spring.flyway.placeholders.mapitAppDbPassword", () -> "test_app_password");
    registry.add("mapit.unleash.enabled", () -> "false");
    registry.add("mapit.realtime.outbox.poll-interval-ms", () -> "3600000");
    registry.add("mapit.realtime.outbox.cleanup-interval-ms", () -> "3600000");
  }

  @BeforeEach
  void prepareStaffAndEstablishment() {
    jdbc.update("delete from realtime_event_outbox");
    jdbc.update("delete from app_user where id = ?", USER);
    jdbc.update("delete from establishment where id = ?", ESTABLISHMENT);
    jdbc.update(
        "insert into app_user (id, tenant_id, email, password_hash, full_name, role, active) values (?, 'demo', ?, 'unused', 'Realtime Staff', 'STAFF', true)",
        USER,
        "realtime-" + USER + "@example.test");
    jdbc.update(
        "insert into establishment (id, tenant_id, name, type, slug) values (?, 'demo', 'Realtime', 'RESTAURANT', ?)",
        ESTABLISHMENT,
        "realtime-" + ESTABLISHMENT);
    client = new WebSocketStompClient(new StandardWebSocketClient());
    client.setMessageConverter(new StringMessageConverter());
    client.start();
  }

  @AfterEach
  void stopClient() {
    client.stop();
  }

  @Test
  void conecta_desconecta_y_recibe_evento_del_outbox_en_menos_de_dos_segundos() throws Exception {
    String token =
        tokenIssuer
            .issue(
                new AuthenticatedUser(
                    USER,
                    TenantId.of("demo"),
                    "realtime-" + USER + "@example.test",
                    "Realtime Staff",
                    UserRole.STAFF))
            .value();
    StompHeaders connectHeaders = new StompHeaders();
    connectHeaders.add("Authorization", "Bearer " + token);
    StompSession session =
        client
            .connectAsync(
                    URI.create("ws://localhost:" + port + "/ws"),
                    new org.springframework.web.socket.WebSocketHttpHeaders(),
                    connectHeaders,
                    new StompSessionHandlerAdapter() {})
            .get(10, TimeUnit.SECONDS);
    assertThat(session.isConnected()).isTrue();
    assertThat(roomAccess.canSubscribe(TenantId.of("demo"), USER, "STAFF", ESTABLISHMENT, Optional.empty()))
        .isTrue();

    CountDownLatch received = new CountDownLatch(1);
    AtomicReference<String> receivedPayload = new AtomicReference<>();
    session.subscribe(
        "/topic/establishments/" + ESTABLISHMENT,
        new StompFrameHandler() {
          @Override
          public java.lang.reflect.Type getPayloadType(StompHeaders headers) {
            return String.class;
          }

          @Override
          public void handleFrame(StompHeaders headers, Object payload) {
            String body = String.valueOf(payload);
            receivedPayload.set(body);
            received.countDown();
          }
        });
    // El simple broker no emite RECEIPT para SUBSCRIBE; dejamos que el frame cruce el canal
    // antes de publicar el evento del outbox.
    TimeUnit.SECONDS.sleep(2);
    assertThat(session.isConnected()).isTrue();

    UUID element = UUID.randomUUID();
    transactions.executeWithoutResult(
        status -> {
          jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, "demo");
          publisher.publish(
              RealtimeEvent.spaceElementStateChanged(
                  UUID.randomUUID(),
                  Instant.now(),
                  TenantId.of("demo"),
                  ESTABLISHMENT,
                  Optional.empty(),
                  element,
                  Optional.of(SpaceElementState.AVAILABLE),
                  SpaceElementState.OCCUPIED,
                  1));
        });
    dispatcher.dispatchPending();

    boolean delivered = received.await(2, TimeUnit.SECONDS);
    String outboxState =
        jdbc.queryForObject(
            "select concat('attempts=', attempts, ', published=', coalesce(published_at::text, 'null'), ', error=', coalesce(last_error, 'null')) from realtime_event_outbox order by created_at desc limit 1",
            String.class);
    assertThat(delivered).as("%s payload=%s", outboxState, receivedPayload.get()).isTrue();
    assertThat(receivedPayload.get()).contains("space-element.state.changed.v1");
    session.disconnect();
    assertThat(session.isConnected()).isFalse();
  }

  @TestConfiguration
  static class TestFlags {

    @Bean
    @Primary
    FeatureFlagPort featureFlags() {
      return new FeatureFlagPort() {
        @Override
        public boolean isEnabled(FeatureFlag flag) {
          return true;
        }

        @Override
        public boolean isEnabled(FeatureFlag flag, boolean valorPorDefecto) {
          return true;
        }
      };
    }
  }
}
