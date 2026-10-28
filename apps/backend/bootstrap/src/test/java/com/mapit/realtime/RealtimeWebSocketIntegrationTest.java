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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.converter.StringMessageConverter;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.client.RestTestClient;
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
  private static final UUID ACCESS_ADMIN = UUID.fromString("00000000-0000-0000-0000-000000000015");
  private static final UUID SUPER =
      UUID.fromString("00000000-0000-0000-0000-000000000013");
  private static final UUID OTRO_SUPER =
      UUID.fromString("00000000-0000-0000-0000-000000000014");
  private static final UUID ESTABLISHMENT =
      UUID.fromString("00000000-0000-0000-0000-000000000012");
  private static final UUID FLOOR = UUID.fromString("00000000-0000-0000-0000-000000000021");
  private static final UUID SECTOR = UUID.fromString("00000000-0000-0000-0000-000000000031");
  private static final UUID ELEMENT = UUID.fromString("00000000-0000-0000-0000-000000000041");

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
    jdbc.update("delete from establishment_staff_access where establishment_id = ?", ESTABLISHMENT);
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
    jdbc.update("insert into app_user(id,tenant_id,email,password_hash,full_name,role) values(?,'demo','realtime-grants@example.test','unused','Administrador de concesiones','ADMIN') on conflict(id) do nothing",ACCESS_ADMIN);
    jdbc.update("insert into establishment_staff_access(tenant_id,establishment_id,user_id,can_check_in,updated_at,updated_by) values('demo',?,?,true,now(),?)",ESTABLISHMENT,USER,ACCESS_ADMIN);
    client = new WebSocketStompClient(new StandardWebSocketClient());
    client.setMessageConverter(new StringMessageConverter());
    client.start();
  }

  @AfterEach
  void stopClient() {
    client.stop();
  }

  /** Limpia el mapa de la prueba E2E en orden inverso de FKs (todas RESTRICT). */
  @AfterEach
  void removeMapFixtures() {
    jdbc.update(
        "delete from space_element_state_change where tenant_id = 'demo' and changed_by = ?",
        USER);
    jdbc.update("delete from space_element where id = ?", ELEMENT);
    jdbc.update("delete from sector where id = ?", SECTOR);
    jdbc.update("delete from floor where id = ?", FLOOR);
  }

  @Test
  void revocar_concesion_impide_nuevas_suscripciones_staff() {
    assertThat(roomAccess.canSubscribe(TenantId.of("demo"),USER,"STAFF",ESTABLISHMENT,Optional.empty())).isTrue();
    jdbc.update("update establishment_staff_access set can_check_in=false where tenant_id='demo' and establishment_id=? and user_id=?",ESTABLISHMENT,USER);
    assertThat(roomAccess.canSubscribe(TenantId.of("demo"),USER,"STAFF",ESTABLISHMENT,Optional.empty())).isFalse();
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

  @Test
  void super_admin_suscribe_a_su_tenant_y_el_aislamiento_se_mantiene() {
    jdbc.update("delete from app_user where id = ?", SUPER);
    jdbc.update("delete from app_user where id = ?", OTRO_SUPER);
    jdbc.update("delete from tenant where id = 'otro'");
    jdbc.update(
        "insert into tenant (id, name, slug, vertical, status) values ('otro', 'Otro', 'otro', 'RESTAURANT', 'ACTIVE') on conflict (id) do nothing");
    jdbc.update(
        "insert into app_user (id, tenant_id, email, password_hash, full_name, role, active) values (?, 'demo', ?, 'unused', 'Realtime Super', 'SUPER_ADMIN', true)",
        SUPER,
        "realtime-" + SUPER + "@example.test");
    jdbc.update(
        "insert into app_user (id, tenant_id, email, password_hash, full_name, role, active) values (?, 'otro', ?, 'unused', 'Otro Super', 'SUPER_ADMIN', true)",
        OTRO_SUPER,
        "realtime-" + OTRO_SUPER + "@example.test");

    // SUPER_ADMIN de su propio tenant: permitido, ya lee estos mismos datos por HTTP.
    assertThat(roomAccess.canSubscribe(TenantId.of("demo"), SUPER, "SUPER_ADMIN", ESTABLISHMENT, Optional.empty()))
        .isTrue();
    // Los roles operativos siguen permitidos.
    assertThat(roomAccess.canSubscribe(TenantId.of("demo"), USER, "ADMIN", ESTABLISHMENT, Optional.empty()))
        .isTrue();
    assertThat(roomAccess.canSubscribe(TenantId.of("demo"), USER, "MANAGER", ESTABLISHMENT, Optional.empty()))
        .isTrue();
    // SUPER_ADMIN de otro tenant: denegado; el check de tenant se mantiene para cualquier rol.
    assertThat(roomAccess.canSubscribe(TenantId.of("otro"), OTRO_SUPER, "SUPER_ADMIN", ESTABLISHMENT, Optional.empty()))
        .isFalse();
    // Usuario inactivo: denegado.
    jdbc.update("update app_user set active = false where id = ?", SUPER);
    assertThat(roomAccess.canSubscribe(TenantId.of("demo"), SUPER, "SUPER_ADMIN", ESTABLISHMENT, Optional.empty()))
        .isFalse();
    jdbc.update("update app_user set active = true where id = ?", SUPER);
    // Rol ajeno al catálogo (llegaría falsificado en el JWT): denegado.
    assertThat(roomAccess.canSubscribe(TenantId.of("demo"), SUPER, "DESARROLLADOR", ESTABLISHMENT, Optional.empty()))
        .isFalse();
  }

  @Test
  void el_cambio_de_estado_del_caso_de_uso_llega_por_stomp_con_el_envelope_correcto()
      throws Exception {
    jdbc.update(
        "insert into floor (id, tenant_id, establishment_id, name, level, slug) values (?, 'demo', ?, 'Piso RT', 1, ?)",
        FLOOR,
        ESTABLISHMENT,
        "rt-floor-" + FLOOR);
    jdbc.update(
        "insert into sector (id, tenant_id, floor_id, name, slug, max_capacity) values (?, 'demo', ?, 'Sector RT', ?, 10)",
        SECTOR,
        FLOOR,
        "rt-sector-" + SECTOR);
    jdbc.update(
        "insert into space_element (id, tenant_id, sector_id, type, state, x, y) values (?, 'demo', ?, 'TABLE', 'AVAILABLE', 1, 1)",
        ELEMENT,
        SECTOR);

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
    // antes del PATCH que dispara el caso de uso real.
    TimeUnit.SECONDS.sleep(2);

    RestTestClient http = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
    http.patch()
        .uri("/api/v1/sectors/{sectorId}/elements/{elementId}/state", SECTOR, ELEMENT)
        .contentType(MediaType.APPLICATION_JSON)
        .header("Authorization", "Bearer " + token)
        .body("{\"state\":\"OCCUPIED\"}")
        .exchange()
        .expectStatus()
        .isOk();

    dispatcher.dispatchPending();

    boolean delivered = received.await(2, TimeUnit.SECONDS);
    String outboxState =
        jdbc.queryForObject(
            "select concat('attempts=', attempts, ', published=', coalesce(published_at::text, 'null'), ', error=', coalesce(last_error, 'null')) from realtime_event_outbox order by created_at desc limit 1",
            String.class);
    assertThat(delivered).as("%s payload=%s", outboxState, receivedPayload.get()).isTrue();
    // El dispatcher envía el texto jsonb, que inserta espacios; comparamos sin ellos.
    String envelope = receivedPayload.get().replace(" ", "");
    assertThat(envelope)
        .contains("space-element.state.changed.v1")
        .contains(ESTABLISHMENT.toString())
        .contains(SECTOR.toString())
        .contains(ELEMENT.toString())
        .contains("\"previousState\":\"AVAILABLE\"")
        .contains("\"state\":\"OCCUPIED\"")
        .contains("\"aggregateVersion\":1");
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
