package com.mapit.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.URI;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.converter.StringMessageConverter;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.mapit.identity.application.IssueAdminRecoveryToken;
import com.mapit.identity.application.LastAdminPolicy;
import com.mapit.identity.application.PrepareAdminRecoveryAuthorization;
import com.mapit.identity.application.RecoverInactiveAdmin;
import com.mapit.identity.domain.AccessTokenIssuer;
import com.mapit.identity.domain.AdminRecoveryAuthorization;
import com.mapit.identity.domain.AdminRecoveryMail;
import com.mapit.identity.domain.AuthenticatedPrincipal;
import com.mapit.identity.domain.AuthenticatedUser;
import com.mapit.identity.domain.UserRole;
import com.mapit.identity.infrastructure.JjwtTokenService;
import com.mapit.payments.domain.receipt.ReceiptToken;
import com.mapit.shared.audit.AuditEvent;
import com.mapit.shared.audit.AuditEventRecorder;
import com.mapit.shared.realtime.RealtimeEvent;
import com.mapit.shared.realtime.RealtimeEventPublisher;
import com.mapit.shared.realtime.SpaceElementState;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

/** T07: HTTP real, última cuenta ADMIN y RLS con mapit_app en PostgreSQL 17. */
@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class CurrentStaffSecurityIntegrationTest {
  private static final String SECRET = "t07_testing_secret_with_at_least_32_bytes_abcdefghij";
  private static final String PASSWORD = "S3cur3?P4ss!";

  @Container
  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:17-alpine")
          .withDatabaseName("mapit").withUsername("mapit").withPassword("test_password");

  @DynamicPropertySource
  static void properties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", () -> "mapit_app");
    registry.add("spring.datasource.password", () -> "test_app_password");
    registry.add("spring.flyway.url", POSTGRES::getJdbcUrl);
    registry.add("spring.flyway.user", POSTGRES::getUsername);
    registry.add("spring.flyway.password", POSTGRES::getPassword);
    registry.add("spring.flyway.placeholders.mapitAppDbPassword", () -> "test_app_password");
    registry.add("mapit.jwt.secret", () -> SECRET);
    registry.add("mapit.jwt.issuer", () -> "mapit");
    registry.add("mapit.super-admin.password", () -> PASSWORD);
    registry.add("mapit.unleash.enabled", () -> "false");
    registry.add("mapit.realtime.outbox.poll-interval-ms", () -> "3600000");
    registry.add("mapit.admin-recovery.operator-endpoint-enabled", () -> "true");
  }

  @LocalServerPort private int port;
  @Autowired private JdbcTemplate jdbc;
  @Autowired private PlatformTransactionManager transactions;
  @Autowired private PasswordEncoder encoder;
  @Autowired private AccessTokenIssuer tokens;
  @Autowired private LastAdminPolicy policy;
  @Autowired private PrepareAdminRecoveryAuthorization recoveryApprovals;
  @Autowired private IssueAdminRecoveryToken recoveryTokenIssuer;
  @Autowired private RecoverInactiveAdmin recovery;
  @MockitoBean private AdminRecoveryMail recoveryMail;
  @MockitoSpyBean private AuditEventRecorder recoveryAudit;
  @Autowired private RealtimeEventPublisher realtime;
  @Autowired private com.mapit.operations.infrastructure.realtime.RealtimeOutboxDispatcher dispatcher;
  private WebSocketStompClient stomp;

  @AfterEach
  void stopStomp() {
    if (stomp != null) stomp.stop();
  }

  @Test
  void socket_ya_suscrito_no_recibe_eventos_tras_perder_rol_o_baja() throws Exception {
    String tenant = tenant();
    UUID admin = user(tenant, "admin@socket.test", UserRole.ADMIN);
    UUID staff = user(tenant, "staff@socket.test", UserRole.STAFF);
    UUID establishment = UUID.randomUUID();
    inTenant(tenant, () -> {
      jdbc.update("insert into establishment(id,tenant_id,name,type,slug) values (?,?,'STOMP','RESTAURANT',?)",
          establishment, tenant, "stomp-" + establishment);
      jdbc.update("""
          insert into establishment_staff_access(tenant_id,establishment_id,user_id,can_check_in,updated_at,updated_by)
          values (?,?,?,true,now(),?)
          """, tenant, establishment, staff, admin);
    });
    stomp = new WebSocketStompClient(new StandardWebSocketClient());
    stomp.setMessageConverter(new StringMessageConverter());
    stomp.start();
    StompHeaders connect = new StompHeaders();
    connect.add("Authorization", signed(staff, tenant, UserRole.STAFF));
    var session = stomp.connectAsync(URI.create("ws://localhost:" + port + "/ws"),
        new org.springframework.web.socket.WebSocketHttpHeaders(), connect,
        new StompSessionHandlerAdapter() {}).get(10, TimeUnit.SECONDS);
    CountDownLatch before = new CountDownLatch(1);
    CountDownLatch after = new CountDownLatch(1);
    var frames = new java.util.concurrent.atomic.AtomicInteger();
    session.subscribe("/topic/establishments/" + establishment, new StompFrameHandler() {
      @Override public java.lang.reflect.Type getPayloadType(StompHeaders headers) { return String.class; }
      @Override public void handleFrame(StompHeaders headers, Object payload) {
        if (frames.incrementAndGet() == 1) before.countDown();
        else after.countDown();
      }
    });
    // El broker simple no confirma SUBSCRIBE; espera a que el frame atraviese el canal.
    TimeUnit.MILLISECONDS.sleep(300);
    publish(tenant, establishment, 1);
    assertThat(before.await(4, TimeUnit.SECONDS)).isTrue();
    inTenant(tenant, () -> jdbc.update("update app_user set role='MANAGER' where id=?", staff));
    publish(tenant, establishment, 2);
    assertThat(after.await(2, TimeUnit.SECONDS)).isFalse();
    inTenant(tenant, () -> jdbc.update("update app_user set role='STAFF',active=false where id=?", staff));
    publish(tenant, establishment, 3);
    assertThat(after.await(2, TimeUnit.SECONDS)).isFalse();
    assertThat(frames.get()).isEqualTo(1);
    // También se deniega una nueva SUBSCRIBE al releer el rol del CONNECT.
    assertThat(session.isConnected()).isTrue();
    session.disconnect();
  }

  private void publish(String tenant, UUID establishment, long version) {
    inTenant(tenant, () -> realtime.publish(RealtimeEvent.spaceElementStateChanged(
        UUID.randomUUID(), Instant.now(), TenantId.of(tenant), establishment, Optional.empty(),
        UUID.randomUUID(), Optional.of(SpaceElementState.AVAILABLE),
        SpaceElementState.OCCUPIED, version)));
    dispatcher.dispatchPending();
  }

  @Test
  void llegada_http_exige_concesion_del_local_y_tenant_vigente_sin_efectos_en_rechazo() {
    String a = tenant();
    String b = tenant();
    UUID admin = user(a, "admin@arrival.test", UserRole.ADMIN);
    UUID granted = user(a, "granted@arrival.test", UserRole.STAFF);
    UUID ungranted = user(a, "ungranted@arrival.test", UserRole.STAFF);
    UUID foreign = user(b, "foreign@arrival.test", UserRole.STAFF);
    UUID a1 = UUID.randomUUID();
    UUID a2 = UUID.randomUUID();
    UUID b1 = UUID.randomUUID();
    UUID person = UUID.randomUUID();
    UUID floor = UUID.randomUUID();
    UUID sector = UUID.randomUUID();
    UUID element = UUID.randomUUID();
    UUID reservation = UUID.randomUUID();
    UUID method = UUID.randomUUID();
    UUID payment = UUID.randomUUID();
    ReceiptToken receipt = ReceiptToken.generate();
    Instant now = Instant.now();

    inTenant(a, () -> {
      jdbc.update("insert into establishment(id,tenant_id,name,type,slug,timezone) values (?,?,'A1','RESTAURANT','a1','UTC')", a1, a);
      jdbc.update("insert into establishment(id,tenant_id,name,type,slug,timezone) values (?,?,'A2','RESTAURANT','a2','UTC')", a2, a);
      jdbc.update("insert into establishment_staff_access(tenant_id,establishment_id,user_id,can_check_in,updated_at,updated_by) values (?,?,?,true,now(),?)", a, a1, granted, admin);
      jdbc.update("insert into floor(id,tenant_id,establishment_id,name,level) values (?,?,?,'Piso',0)", floor, a, a1);
      jdbc.update("insert into sector(id,tenant_id,floor_id,name,max_capacity) values (?,?,?,'Sector',10)", sector, a, floor);
      jdbc.update("insert into space_element(id,tenant_id,sector_id,type,state,x,y) values (?,?,?,'TABLE','AVAILABLE',0,0)", element, a, sector);
      jdbc.update("insert into person(id,tenant_id,full_name) values (?,?,'Cliente de prueba')", person, a);
      jdbc.update("insert into reservation(id,tenant_id,establishment_id,person_id,starts_at,ends_at,status,created_by) values (?,?,?,?,?,?,'CONFIRMED',?)",
          reservation, a, a1, person, Timestamp.from(now.minusSeconds(60)), Timestamp.from(now.plusSeconds(3600)), admin);
      jdbc.update("insert into reservation_space_element(tenant_id,reservation_id,space_element_id) values (?,?,?)", a, reservation, element);
      jdbc.update("""
          insert into merchant_payment_method(id,tenant_id,establishment_id,display_name,country,currency,provider,
            bank_name,account_reference,enabled,created_at,updated_at,created_by,updated_by)
          values (?,?,?,'QR de prueba','BO','BOB','MOCK_GATEWAY','Banco prueba','cuenta-prueba',true,now(),now(),?,?)
          """, method, a, a1, admin, admin);
      jdbc.update("""
          insert into payment(id,tenant_id,establishment_id,reservation_id,method_id,provider,merchant_reference,
            external_reference,amount,currency,status,created_at,expires_at,verified_at,verification_source)
          values (?,?,?,?,?,'MOCK_GATEWAY',?, ?,10,'BOB','CONFIRMED',?,?,?,'MOCK')
          """, payment, a, a1, reservation, method, "merchant-" + payment, "external-" + payment,
          Timestamp.from(now.minusSeconds(90)), Timestamp.from(now.plusSeconds(3600)), Timestamp.from(now.minusSeconds(30)));
      jdbc.update("update reservation set confirmed_payment_id=? where tenant_id=? and id=?", payment, a, reservation);
      jdbc.update("""
          insert into payment_receipt(id,tenant_id,establishment_id,reservation_id,payment_id,token_hash,created_at,expires_at)
          values (?,?,?,?,?,?,?,?)
          """, UUID.randomUUID(), a, a1, reservation, payment, receipt.hash(),
          Timestamp.from(now.minusSeconds(30)), Timestamp.from(now.plusSeconds(3600)));
    });
    inTenant(b, () -> jdbc.update("insert into establishment(id,tenant_id,name,type,slug) values (?,?,'B1','RESTAURANT','b1')", b1, b));
    assertThat(jdbc.queryForObject("select current_user", String.class)).isEqualTo("mapit_app");
    assertThat(jdbc.queryForObject("select count(*) from payment_receipt", Long.class)).isZero();

    String token = receipt.presentationValue();
    assertThat(arrivalStatus(a, ungranted, a1, token, true)).isEqualTo(403);
    assertThat(arrivalStatus(a, ungranted, a1, token, false)).isEqualTo(403);
    assertThat(arrivalStatus(a, ungranted, a2, token, false)).isEqualTo(403);
    assertThat(arrivalStatus(a, granted, a2, token, false)).isEqualTo(403);
    assertThat(arrivalStatus(b, foreign, a1, token, false)).isEqualTo(403);
    inTenant(a, () -> {
      assertThat(jdbc.queryForObject("select status from reservation where id=?", String.class, reservation)).isEqualTo("CONFIRMED");
      assertThat(jdbc.queryForObject("select count(*) from reservation_event where reservation_id=? and event_type='CHECKED_IN'", Long.class, reservation)).isZero();
      assertThat(jdbc.queryForObject("select count(*) from audit_log where resource_id=? and event_type='SPACE_ELEMENT_STATE_CHANGED'", Long.class, element)).isZero();
    });

    assertThat(arrivalStatus(a, granted, a1, token, true)).isEqualTo(200);
    assertThat(arrivalStatus(a, granted, a1, token, false)).isEqualTo(200);
    inTenant(a, () -> {
      assertThat(jdbc.queryForObject("select status from reservation where id=?", String.class, reservation)).isEqualTo("ACTIVE");
      assertThat(jdbc.queryForObject("select count(*) from reservation_event where reservation_id=? and event_type='CHECKED_IN'", Long.class, reservation)).isEqualTo(1);
      assertThat(jdbc.queryForObject("select checked_in_by from reservation where id=?", UUID.class, reservation)).isEqualTo(granted);
    });
    http().get().uri("/api/v1/reservations").header("Authorization", signed(granted, a, UserRole.STAFF))
        .exchange().expectStatus().isForbidden();
    inTenant(a, () -> jdbc.update("update establishment_staff_access set can_check_in=false where tenant_id=? and establishment_id=? and user_id=?", a, a1, granted));
    assertThat(arrivalStatus(a, granted, a1, token, true)).isEqualTo(403);
    assertThat(arrivalStatus(a, granted, a1, token, false)).isEqualTo(403);
    inTenant(a, () -> assertThat(jdbc.queryForObject(
        "select count(*) from reservation_event where reservation_id=? and event_type='CHECKED_IN'", Long.class, reservation)).isEqualTo(1));
  }

  private int arrivalStatus(String tenant, UUID operator, UUID establishment, String token, boolean lookup) {
    return http().post().uri("/api/v1/establishments/" + establishment + "/check-ins" + (lookup ? "/lookup" : ""))
        .header("Authorization", signed(operator, tenant, UserRole.STAFF))
        .contentType(MediaType.APPLICATION_JSON).body(Map.of("token", token))
        .exchange().returnResult(Void.class).getStatus().value();
  }

  @Test
  void login_rol_antiguo_baja_y_tenant_suspendido_invalidan_siguiente_peticion() {
    String tenant = tenant();
    UUID admin = user(tenant, "admin@jwt.test", UserRole.ADMIN);
    user(tenant, "manager@jwt.test", UserRole.MANAGER);
    user(tenant, "staff@jwt.test", UserRole.STAFF);
    String administrator = login(tenant, "admin@jwt.test");
    String manager = login(tenant, "manager@jwt.test");
    String staff = login(tenant, "staff@jwt.test");

    http().get().uri("/api/v1/users").header("Authorization", administrator)
        .exchange().expectStatus().isOk();
    http().get().uri("/api/v1/users").header("Authorization", manager)
        .exchange().expectStatus().isForbidden();
    http().get().uri("/api/v1/reservations").header("Authorization", staff)
        .exchange().expectStatus().isForbidden();
    http().get().uri("/api/v1/reservations").header("Authorization", administrator)
        .exchange().expectStatus().isOk();
    http().get().uri("/api/v1/reservations").header("Authorization", manager)
        .exchange().expectStatus().isOk();

    UUID managerId = id(tenant, "manager@jwt.test");
    http().patch().uri("/api/v1/users/" + managerId + "/role")
        .header("Authorization", administrator).contentType(MediaType.APPLICATION_JSON)
        .body(Map.of("expectedRole", "MANAGER", "role", "STAFF"))
        .exchange().expectStatus().isOk();
    http().get().uri("/api/v1/establishments/accessible").header("Authorization", manager)
        .exchange().expectStatus().isUnauthorized();
    String refreshed = login(tenant, "manager@jwt.test");
    http().get().uri("/api/v1/establishments/accessible").header("Authorization", refreshed)
        .exchange().expectStatus().isOk();
    http().get().uri("/api/v1/users").header("Authorization", refreshed)
        .exchange().expectStatus().isForbidden();

    http().patch().uri("/api/v1/users/" + id(tenant, "staff@jwt.test") + "/access")
        .header("Authorization", administrator).contentType(MediaType.APPLICATION_JSON)
        .body(Map.of("active", false)).exchange().expectStatus().isOk();
    http().get().uri("/api/v1/establishments/accessible").header("Authorization", staff)
        .exchange().expectStatus().isUnauthorized();
    http().post().uri("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
        .body(Map.of("tenantSlug", tenant, "email", "staff@jwt.test", "password", PASSWORD))
        .exchange().expectStatus().isUnauthorized();

    jdbc.update("update tenant set status='SUSPENDED' where id=?", tenant);
    http().get().uri("/api/v1/users").header("Authorization", administrator)
        .exchange().expectStatus().isUnauthorized();
    assertThat(admin).isNotNull();
  }

  @Test
  void firma_valida_no_sustituye_cuenta_tenant_rol_ni_expiracion() {
    String a = tenant();
    String b = tenant();
    UUID admin = user(a, "admin@scope.test", UserRole.ADMIN);
    UUID other = user(b, "staff@scope.test", UserRole.STAFF);
    String valid = signed(admin, a, UserRole.ADMIN);
    http().get().uri("/api/v1/users/" + other).header("Authorization", valid)
        .exchange().expectStatus().isNotFound();
    http().patch().uri("/api/v1/users/" + other + "/access")
        .header("Authorization", valid).contentType(MediaType.APPLICATION_JSON)
        .body(Map.of("active", false)).exchange().expectStatus().isNotFound();
    http().get().uri("/api/v1/users").header("Authorization", signed(admin, b, UserRole.ADMIN))
        .exchange().expectStatus().isUnauthorized();
    http().get().uri("/api/v1/users").header("Authorization", signed(UUID.randomUUID(), a, UserRole.ADMIN))
        .exchange().expectStatus().isUnauthorized();
    http().get().uri("/api/v1/users").header("Authorization", signed(admin, a, UserRole.STAFF))
        .exchange().expectStatus().isUnauthorized();
    http().get().uri("/api/v1/users").exchange().expectStatus().isUnauthorized();
    var expired = new JjwtTokenService(SECRET, "mapit", 1,
        Clock.fixed(Instant.now().minusSeconds(120), ZoneOffset.UTC));
    String token = "Bearer " + expired.issue(new AuthenticatedUser(admin, TenantId.of(a),
        "admin@scope.test", "Admin", UserRole.ADMIN)).value();
    http().get().uri("/api/v1/users").header("Authorization", token)
        .exchange().expectStatus().isUnauthorized();
    assertThat(jdbc.queryForObject("select current_user", String.class)).isEqualTo("mapit_app");
    assertThat(jdbc.queryForObject("select count(*) from app_user", Long.class)).isZero();
    inTenant(b, () -> assertThat(jdbc.queryForObject(
        "select active from app_user where id=?", Boolean.class, other)).isTrue());
    inTenant(a, () -> assertThat(jdbc.queryForObject(
        "select count(*) from app_user where tenant_id=?", Long.class, b)).isZero());
  }

  @Test
  void plataforma_no_usa_endpoints_de_usuarios_de_otro_tenant() {
    UUID operator = platformOperator();
    String token = signed(operator, "platform", UserRole.SUPER_ADMIN);
    http().get().uri("/api/v1/tenants").header("Authorization", token)
        .exchange().expectStatus().isOk();
    http().get().uri("/api/v1/users").header("Authorization", token)
        .exchange().expectStatus().isForbidden();
    http().get().uri("/api/v1/tenants").header("Authorization", signed(operator, "demo", UserRole.SUPER_ADMIN))
        .exchange().expectStatus().isUnauthorized();
  }

  @Test
  void politica_interna_no_deja_sin_admin_y_serializa_dos_bajas() throws Exception {
    UUID operator = platformOperator();
    var principal = new AuthenticatedPrincipal(operator, TenantId.of("platform"),
        "superadmin@mapit.local", UserRole.SUPER_ADMIN);
    String a = tenant();
    UUID first = user(a, "first@last.test", UserRole.ADMIN);
    assertThatThrownBy(() -> policy.deactivate(principal, TenantId.of(a), first))
        .isInstanceOf(IllegalStateException.class);
    assertThatThrownBy(() -> policy.degrade(principal, TenantId.of(a), first, UserRole.STAFF))
        .isInstanceOf(IllegalStateException.class);
    UUID second = user(a, "second@last.test", UserRole.ADMIN);
    CountDownLatch start = new CountDownLatch(1);
    try (var pool = Executors.newFixedThreadPool(2)) {
      var one = pool.submit(() -> { start.await(); return attempt(() -> policy.deactivate(principal, TenantId.of(a), first)); });
      var two = pool.submit(() -> { start.await(); return attempt(() -> policy.degrade(principal, TenantId.of(a), second, UserRole.MANAGER)); });
      start.countDown();
      assertThat(one.get(20, TimeUnit.SECONDS) + two.get(20, TimeUnit.SECONDS)).isEqualTo(1);
    }
    inTenant(a, () -> assertThat(jdbc.queryForObject(
        "select count(*) from app_user where role='ADMIN' and active", Long.class)).isEqualTo(1));
    inTenant("platform", () -> assertThat(jdbc.queryForObject(
        "select count(*) from audit_log where tenant_id='platform' and actor_id=? and resource_id in (?,?) and event_type in ('USER_DEACTIVATED','USER_ROLE_CHANGED')",
        Long.class, operator, first, second)).isEqualTo(1));
  }

  @Test
  void jwt_anterior_no_revive_tras_corte_de_sesion_y_otro_usuario_sigue_vigente() {
    String a = tenant();
    UUID recovered = user(a, "recovered@jwt.test", UserRole.ADMIN);
    UUID other = user(a, "other@jwt.test", UserRole.ADMIN);
    String oldToken = signed(recovered, a, UserRole.ADMIN);
    String otherToken = signed(other, a, UserRole.ADMIN);
    http().get().uri("/api/v1/users").header("Authorization", oldToken)
        .exchange().expectStatus().isOk();
    inTenant(a, () -> jdbc.update("""
        update app_user set active=false, staff_tokens_valid_after=now()
        where tenant_id=? and id=?
        """, a, recovered));
    http().get().uri("/api/v1/users").header("Authorization", oldToken)
        .exchange().expectStatus().isUnauthorized();
    // Simula solo la reactivación para probar la barrera JWT; no es un rescate.
    inTenant(a, () -> jdbc.update("update app_user set active=true where tenant_id=? and id=?",
        a, recovered));
    http().get().uri("/api/v1/users").header("Authorization", oldToken)
        .exchange().expectStatus().isUnauthorized();
    http().get().uri("/api/v1/users").header("Authorization", otherToken)
        .exchange().expectStatus().isOk();
  }

  @Test
  void inicio_manual_http_exige_fuente_independiente_y_recupera_solo_destinatario() throws Exception {
    UUID operator = platformOperator();
    String operatorJwt = signed(operator, "platform", UserRole.SUPER_ADMIN);
    String a = tenant();
    String b = tenant();
    UUID target = user(a, "admin@manual.test", UserRole.ADMIN);
    UUID foreignAdmin = user(b, "admin@foreign-manual.test", UserRole.ADMIN);
    UUID manager = user(b, "manager@manual.test", UserRole.MANAGER);
    UUID staff = user(b, "staff@manual.test", UserRole.STAFF);
    UUID revokedOperator = user("platform", "revoked-operator@manual.test", UserRole.SUPER_ADMIN);
    String revokedOperatorJwt = signed(revokedOperator, "platform", UserRole.SUPER_ADMIN);
    inTenant("platform", () -> jdbc.update(
        "update app_user set active=false where tenant_id='platform' and id=?", revokedOperator));
    String oldJwt = signed(target, a, UserRole.ADMIN);
    inTenant(a, () -> jdbc.update("update app_user set active=false where tenant_id=? and id=?", a, target));
    var body = Map.of("tenantId", a, "tenantSlug", a, "targetUserId", target,
        "ticket", "MAP-238", "reason", "Sin ADMIN activo",
        "approvalReference", "MAP-238#acta-operativa");
    startRecovery(body, null, 401);
    startRecovery(body, signed(foreignAdmin, b, UserRole.ADMIN), 403);
    startRecovery(body, signed(manager, b, UserRole.MANAGER), 403);
    startRecovery(body, signed(staff, b, UserRole.STAFF), 403);
    startRecovery(body, revokedOperatorJwt, 401);
    startRecovery(body, operatorJwt, 403); // La fuente no devuelve el acta.
    org.mockito.Mockito.verifyNoInteractions(recoveryMail);

    provisionRecoveryApprover();
    Instant now = Instant.now();
    insertRecoveryEvidence("MAP-238#acta-vencida", a, target,
        now.minusSeconds(600), now.minusSeconds(300));
    startRecovery(withReference(body, "MAP-238#acta-vencida"), operatorJwt, 403);
    insertRecoveryEvidence("MAP-238#acta-revocada", a, target,
        now.minusSeconds(5), now.plusSeconds(300));
    revokeRecoveryEvidence("MAP-238#acta-revocada");
    startRecovery(withReference(body, "MAP-238#acta-revocada"), operatorJwt, 403);
    insertRecoveryEvidence("MAP-238#acta-operativa", a, target,
        now.minusSeconds(5), now.plusSeconds(300));
    inTenant("platform", () -> assertThat(jdbc.queryForObject("""
        select approver_login from admin_recovery_approval_evidence
        where tenant_id='platform' and reference='MAP-238#acta-operativa'
        """, String.class)).isEqualTo("ca05_approver_test"));
    inTenant(b, () -> assertThat(jdbc.queryForObject("""
        select count(*) from admin_recovery_approval_evidence
        where tenant_id='platform' and reference='MAP-238#acta-operativa'
        """, Long.class)).isZero());
    assertThatThrownBy(() -> inTenant("platform", () -> jdbc.update("""
        update admin_recovery_approval_evidence set revoked_at=now()
        where tenant_id='platform' and reference='MAP-238#acta-operativa'
        """))).isInstanceOf(org.springframework.dao.DataAccessException.class);
    assertThatThrownBy(() -> inTenant("platform", () -> jdbc.update("""
        insert into admin_recovery_approval_evidence
          (reference,target_tenant_id,target_slug,target_user_id,ticket,reason,valid_from,expires_at)
        values ('MAP-238#falsa',?,?,?,'MAP-238','Sin ADMIN activo',now(),now()+interval '5 minutes')
        """, a, a, target))).isInstanceOf(org.springframework.dao.DataAccessException.class);
    var foreignBody = Map.of("tenantId", b, "tenantSlug", b, "targetUserId", foreignAdmin,
        "ticket", "MAP-238", "reason", "Sin ADMIN activo",
        "approvalReference", "MAP-238#acta-operativa");
    startRecovery(foreignBody, operatorJwt, 403);
    org.mockito.Mockito.verifyNoInteractions(recoveryMail);
    startRecovery(body, operatorJwt, 202);
    startRecovery(body, operatorJwt, 403); // La referencia ya se utilizó.

    var captured = org.mockito.ArgumentCaptor.forClass(String.class);
    org.mockito.Mockito.verify(recoveryMail).send(
        org.mockito.ArgumentMatchers.eq("admin@manual.test"),
        org.mockito.ArgumentMatchers.eq(a), captured.capture());
    String token = captured.getValue();
    recoveryActivation(a, token, "N3w-Password!42", 200);
    inTenant(b, () -> assertThat(jdbc.queryForObject("""
        select active from app_user where tenant_id=? and id=?
        """, Boolean.class, b, foreignAdmin)).isTrue());
    inTenant("platform", () -> assertThat(jdbc.queryForObject("""
        select count(*) from audit_log where tenant_id='platform' and actor_id=?
          and resource_id=? and event_type='USER_RECOVERED' and details->>'targetTenantId'=?
        """, Long.class, operator, target, a)).isEqualTo(1));
    http().get().uri("/api/v1/users").header("Authorization", oldJwt)
        .exchange().expectStatus().isUnauthorized();
    http().post().uri("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
        .body(Map.of("tenantSlug", a, "email", "admin@manual.test", "password", PASSWORD))
        .exchange().expectStatus().isUnauthorized();
    Thread.sleep(1100);
    http().post().uri("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
        .body(Map.of("tenantSlug", a, "email", "admin@manual.test",
            "password", "N3w-Password!42"))
        .exchange().expectStatus().isOk();
  }

  @Test
  void revocacion_documental_tras_emision_impide_consumir_enlace() throws Exception {
    provisionRecoveryApprover();
    UUID operator = platformOperator();
    String operatorJwt = signed(operator, "platform", UserRole.SUPER_ADMIN);
    String tenant = tenant();
    UUID target = user(tenant, "admin@revoked-evidence.test", UserRole.ADMIN);
    inTenant(tenant, () -> jdbc.update(
        "update app_user set active=false where tenant_id=? and id=?", tenant, target));
    String reference = "MAP-238#" + UUID.randomUUID();
    insertRecoveryEvidence(reference, tenant, target,
        Instant.now().minusSeconds(5), Instant.now().plusSeconds(300));
    startRecovery(Map.of("tenantId", tenant, "tenantSlug", tenant, "targetUserId", target,
        "ticket", "MAP-238", "reason", "Sin ADMIN activo",
        "approvalReference", reference), operatorJwt, 202);
    var captured = org.mockito.ArgumentCaptor.forClass(String.class);
    org.mockito.Mockito.verify(recoveryMail).send(
        org.mockito.ArgumentMatchers.eq("admin@revoked-evidence.test"),
        org.mockito.ArgumentMatchers.eq(tenant), captured.capture());
    revokeRecoveryEvidence(reference);
    recoveryActivation(tenant, captured.getValue(), "N3w-Password!42", 400);
    inTenant(tenant, () -> assertThat(jdbc.queryForObject("""
        select active from app_user where tenant_id=? and id=?
        """, Boolean.class, tenant, target)).isFalse());
    inTenant("platform", () -> assertThat(jdbc.queryForObject("""
        select count(*) from audit_log where tenant_id='platform' and resource_id=?
          and event_type='USER_RECOVERED'
        """, Long.class, target)).isZero());
  }

  private void startRecovery(Map<String, ?> body, String jwt, int expected) {
    var request = http().post().uri("/api/v1/platform/admin-recoveries")
        .contentType(MediaType.APPLICATION_JSON);
    if (jwt != null) request = request.header("Authorization", jwt);
    request.body(body).exchange().expectStatus().isEqualTo(expected);
  }

  private Map<String, Object> withReference(Map<String, ?> original, String reference) {
    var body = new java.util.HashMap<String, Object>(original);
    body.put("approvalReference", reference);
    return body;
  }

  private void provisionRecoveryApprover() throws Exception {
    try (var owner = java.sql.DriverManager.getConnection(POSTGRES.getJdbcUrl(),
        POSTGRES.getUsername(), POSTGRES.getPassword());
        var statement = owner.createStatement()) {
      statement.execute("""
          do $$ begin
            if not exists (select 1 from pg_roles where rolname='ca05_approver_test') then
              create role ca05_approver_test login password 'ca05_test_only_password'
                nosuperuser nobypassrls nocreatedb nocreaterole;
            end if;
          end $$
          """);
      statement.execute("grant mapit_recovery_approver to ca05_approver_test");
    }
  }

  private void insertRecoveryEvidence(String reference, String tenant, UUID target,
      Instant validFrom, Instant expiresAt) throws Exception {
    try (var approver = java.sql.DriverManager.getConnection(POSTGRES.getJdbcUrl(),
        "ca05_approver_test", "ca05_test_only_password")) {
      approver.setAutoCommit(false);
      try (var scope = approver.createStatement()) {
        scope.execute("set local app.tenant_id = 'platform'");
      }
      try (var insert = approver.prepareStatement("""
          insert into admin_recovery_approval_evidence
            (reference,target_tenant_id,target_slug,target_user_id,ticket,reason,valid_from,expires_at)
          values (?,?,?,?,'MAP-238','Sin ADMIN activo',?,?)
          """)) {
        insert.setString(1, reference);
        insert.setString(2, tenant);
        insert.setString(3, tenant);
        insert.setObject(4, target);
        insert.setTimestamp(5, Timestamp.from(validFrom));
        insert.setTimestamp(6, Timestamp.from(expiresAt));
        assertThat(insert.executeUpdate()).isEqualTo(1);
      }
      approver.commit();
    }
  }

  private void revokeRecoveryEvidence(String reference) throws Exception {
    try (var approver = java.sql.DriverManager.getConnection(POSTGRES.getJdbcUrl(),
        "ca05_approver_test", "ca05_test_only_password")) {
      approver.setAutoCommit(false);
      try (var scope = approver.createStatement()) {
        scope.execute("set local app.tenant_id = 'platform'");
      }
      try (var revoke = approver.prepareStatement("""
          update admin_recovery_approval_evidence set revoked_at=now()
          where tenant_id='platform' and reference=?
          """)) {
        revoke.setString(1, reference);
        assertThat(revoke.executeUpdate()).isEqualTo(1);
      }
      approver.commit();
    }
  }

  @Test
  void token_de_recuperacion_llega_solo_al_admin_y_se_consume_por_http() throws Exception {
    UUID operator = platformOperator();
    String operatorToken = signed(operator, "platform", UserRole.SUPER_ADMIN).substring(7);
    String a = tenant();
    String b = tenant();
    UUID target = user(a, "admin@recovery-token.test", UserRole.ADMIN);
    UUID foreign = user(b, "foreign@recovery-token.test", UserRole.ADMIN);
    String oldJwt = signed(target, a, UserRole.ADMIN);
    inTenant(a, () -> jdbc.update("update app_user set active=false where tenant_id=? and id=?", a, target));
    inTenant(b, () -> jdbc.update("update app_user set active=false where tenant_id=? and id=?", b, foreign));
    UUID requestId = UUID.randomUUID();
    Instant now = Instant.now();
    recoveryApprovals.createPending(operatorToken, new AdminRecoveryAuthorization(requestId,
        TenantId.of(a), a, target, operator, "MAP-238", "Sin ADMIN activo",
        now.minusSeconds(5), now.plusSeconds(300)));
    assertThat(recoveryApprovals.recordDocumentApproval(operatorToken, requestId,
        "MAP-238#acta-token", "responsable-funcional")).isTrue();
    assertThatThrownBy(() -> recoveryTokenIssuer.execute(
        signed(foreign, b, UserRole.ADMIN).substring(7), requestId))
        .isInstanceOf(SecurityException.class);
    recoveryTokenIssuer.execute(operatorToken, requestId);
    var captured = org.mockito.ArgumentCaptor.forClass(String.class);
    org.mockito.Mockito.verify(recoveryMail).send(
        org.mockito.ArgumentMatchers.eq("admin@recovery-token.test"),
        org.mockito.ArgumentMatchers.eq(a), captured.capture());
    String raw = captured.getValue();
    assertThat(raw).startsWith("recover.");
    inTenant("platform", () -> assertThat(jdbc.queryForObject("""
        select count(*) from admin_recovery_token where tenant_id='platform'
          and authorization_id=? and token_hash<>? and consumed_at is null
        """, Long.class, requestId, raw)).isEqualTo(1));
    recoveryActivation(b, raw, "N3w-Password!42", 400);
    recoveryActivation(a, "recover." + "x".repeat(43), "N3w-Password!42", 400);
    recoveryActivation(a, raw, "N3w-Password!42", 200);
    recoveryActivation(a, raw, "N3w-Password!42", 400);
    inTenant(b, () -> assertThat(jdbc.queryForObject("""
        select active from app_user where tenant_id=? and id=?
        """, Boolean.class, b, foreign)).isFalse());
    inTenant("platform", () -> assertThat(jdbc.queryForObject("""
        select count(*) from audit_log where tenant_id='platform' and actor_id=?
          and resource_id=? and event_type='USER_RECOVERED'
        """, Long.class, operator, target)).isEqualTo(1));
    http().get().uri("/api/v1/users").header("Authorization", oldJwt)
        .exchange().expectStatus().isUnauthorized();
    http().post().uri("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
        .body(Map.of("tenantSlug", a, "email", "admin@recovery-token.test", "password", PASSWORD))
        .exchange().expectStatus().isUnauthorized();
    Thread.sleep(1100);
    http().post().uri("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
        .body(Map.of("tenantSlug", a, "email", "admin@recovery-token.test",
            "password", "N3w-Password!42"))
        .exchange().expectStatus().isOk();
  }

  private void recoveryActivation(String slug, String token, String password, int expected) {
    http().post().uri("/api/v1/auth/activate").contentType(MediaType.APPLICATION_JSON)
        .body(Map.of("tenantSlug", slug, "token", token,
            "password", password, "passwordConfirm", password))
        .exchange().expectStatus().isEqualTo(expected);
  }

  @Test
  void token_expirado_y_error_de_auditoria_no_activan_admin() {
    UUID operator = platformOperator();
    String operatorToken = signed(operator, "platform", UserRole.SUPER_ADMIN).substring(7);
    String a = tenant();
    UUID target = user(a, "admin@recovery-rollback.test", UserRole.ADMIN);
    inTenant(a, () -> jdbc.update("update app_user set active=false where tenant_id=? and id=?", a, target));
    UUID requestId = UUID.randomUUID();
    Instant now = Instant.now();
    recoveryApprovals.createPending(operatorToken, new AdminRecoveryAuthorization(requestId,
        TenantId.of(a), a, target, operator, "MAP-238", "Sin ADMIN activo",
        now.minusSeconds(5), now.plusSeconds(300)));
    assertThat(recoveryApprovals.recordDocumentApproval(operatorToken, requestId,
        "MAP-238#acta-rollback", "responsable-funcional")).isTrue();
    recoveryTokenIssuer.execute(operatorToken, requestId);
    var captured = org.mockito.ArgumentCaptor.forClass(String.class);
    org.mockito.Mockito.verify(recoveryMail).send(org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.eq(a), captured.capture());
    String raw = captured.getValue();
    org.mockito.Mockito.doThrow(new IllegalStateException("Fallo de auditoría simulado"))
        .when(recoveryAudit).record(org.mockito.ArgumentMatchers.any(AuditEvent.class));
    assertThatThrownBy(() -> recovery.executeByToken(a, raw, "N3w-Password!42",
        "N3w-Password!42")).hasRootCauseInstanceOf(IllegalStateException.class);
    inTenant(a, () -> {
      var unchanged = jdbc.queryForMap("""
          select active,staff_tokens_valid_after,password_hash from app_user
          where tenant_id=? and id=?
          """, a, target);
      assertThat(unchanged).containsEntry("active", false)
          .containsEntry("staff_tokens_valid_after", null);
      assertThat(encoder.matches(PASSWORD, (String) unchanged.get("password_hash"))).isTrue();
    });
    inTenant("platform", () -> {
      assertThat(jdbc.queryForObject("""
          select status from admin_recovery_authorization where tenant_id='platform' and id=?
          """, String.class, requestId)).isEqualTo("APPROVED");
      assertThat(jdbc.queryForObject("""
          select consumed_at from admin_recovery_token where tenant_id='platform'
            and authorization_id=?
          """, Timestamp.class, requestId)).isNull();
      assertThat(jdbc.queryForObject("""
          select count(*) from audit_log where tenant_id='platform'
            and resource_id=? and event_type='USER_RECOVERED'
          """, Long.class, target)).isZero();
      jdbc.update("""
          update admin_recovery_token
          set created_at=now()-interval '1 hour', expires_at=now()-interval '1 second'
          where tenant_id='platform' and authorization_id=?
          """, requestId);
    });
    recoveryActivation(a, raw, "N3w-Password!42", 400);
  }

  @Test
  void recuperacion_documental_usa_un_super_admin_y_rechaza_referencia_ajena() {
    UUID operator = platformOperator();
    String operatorToken = signed(operator, "platform", UserRole.SUPER_ADMIN).substring(7);
    String a = tenant();
    String b = tenant();
    UUID target = user(a, "documented@recover.test", UserRole.ADMIN);
    UUID foreign = user(b, "foreign@recover.test", UserRole.ADMIN);
    inTenant(a, () -> jdbc.update("update app_user set active=false where tenant_id=? and id=?", a, target));
    inTenant(b, () -> jdbc.update("update app_user set active=false where tenant_id=? and id=?", b, foreign));
    UUID requestId = UUID.randomUUID();
    Instant now = Instant.now();
    recoveryApprovals.createPending(operatorToken, new AdminRecoveryAuthorization(requestId,
        TenantId.of(a), a, target, operator, "MAP-238", "Sin ADMIN activo",
        now.minusSeconds(5), now.plusSeconds(300)));
    assertThatThrownBy(() -> recovery.executeDocumented(operatorToken, requestId,
        "MAP-238#aprobacion", "N3w-Password!42")).isInstanceOf(SecurityException.class);
    // Referencia de prueba: acredita política y persistencia, no autenticidad del acta real.
    assertThat(recoveryApprovals.recordDocumentApproval(operatorToken, requestId,
        "MAP-238#aprobacion", "responsable-funcional")).isTrue();
    assertThatThrownBy(() -> recovery.executeDocumented(operatorToken, requestId,
        "MAP-238#otro", "N3w-Password!42")).isInstanceOf(SecurityException.class);
    assertThatThrownBy(() -> recovery.executeDocumented(signed(foreign, b, UserRole.ADMIN).substring(7),
        requestId, "MAP-238#aprobacion", "N3w-Password!42"))
        .isInstanceOf(SecurityException.class);
    recovery.executeDocumented(operatorToken, requestId, "MAP-238#aprobacion", "N3w-Password!42");
    inTenant(a, () -> assertThat(jdbc.queryForObject("""
        select active from app_user where tenant_id=? and id=?
        """, Boolean.class, a, target)).isTrue());
    inTenant(b, () -> assertThat(jdbc.queryForObject("""
        select active from app_user where tenant_id=? and id=?
        """, Boolean.class, b, foreign)).isFalse());
    inTenant("platform", () -> assertThat(jdbc.queryForObject("""
        select count(*) from audit_log where tenant_id='platform' and actor_id=?
          and resource_id=? and event_type='USER_RECOVERED'
        """, Long.class, operator, target)).isEqualTo(1));
    assertThatThrownBy(() -> recovery.executeDocumented(operatorToken, requestId,
        "MAP-238#aprobacion", "N3w-Password!42")).isInstanceOf(SecurityException.class);
  }

  @Test
  void recuperacion_interna_restaura_solo_admin_aprobado_y_rota_acceso() throws Exception {
    UUID operator = platformOperator();
    UUID approver = UUID.randomUUID();
    inTenant("platform", () -> jdbc.update("""
        insert into app_user(id,tenant_id,email,password_hash,full_name,role)
        values (?,'platform',?,?,'Segundo responsable','SUPER_ADMIN')
        """, approver, approver + "@platform.test", encoder.encode(PASSWORD)));
    String operatorToken = signed(operator, "platform", UserRole.SUPER_ADMIN).substring(7);
    String approverToken = signed(approver, "platform", UserRole.SUPER_ADMIN).substring(7);
    String a = tenant();
    UUID target = user(a, "admin@recover.test", UserRole.ADMIN);
    String oldToken = signed(target, a, UserRole.ADMIN);
    inTenant(a, () -> jdbc.update("update app_user set active=false where tenant_id=? and id=?", a, target));
    UUID requestId = UUID.randomUUID();
    Instant now = Instant.now();
    recoveryApprovals.createPending(operatorToken, new AdminRecoveryAuthorization(requestId,
        TenantId.of(a), a, target, operator, "MAP-238", "Sin ADMIN activo",
        now.minusSeconds(5), now.plusSeconds(300)));
    assertThat(recoveryApprovals.approve(operatorToken, approverToken, requestId)).isTrue();
    recovery.execute(operatorToken, approverToken, requestId, "N3w-Password!42");

    inTenant(a, () -> {
      var restored = jdbc.queryForMap("""
          select role,active,staff_tokens_valid_after from app_user where tenant_id=? and id=?
          """, a, target);
      assertThat(restored).containsEntry("role", "ADMIN").containsEntry("active", true);
      assertThat(restored.get("staff_tokens_valid_after")).isNotNull();
    });
    inTenant("platform", () -> assertThat(jdbc.queryForObject("""
        select count(*) from audit_log where tenant_id='platform' and actor_id=?
          and resource_id=? and event_type='USER_RECOVERED' and details->>'targetTenantId'=?
        """, Long.class, operator, target, a)).isEqualTo(1));
    http().get().uri("/api/v1/users").header("Authorization", oldToken)
        .exchange().expectStatus().isUnauthorized();
    http().post().uri("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
        .body(Map.of("tenantSlug", a, "email", "admin@recover.test", "password", PASSWORD))
        .exchange().expectStatus().isUnauthorized();
    Thread.sleep(1100); // iat tiene precisión de segundos y el corte debe quedar atrás.
    String body = http().post().uri("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
        .body(Map.of("tenantSlug", a, "email", "admin@recover.test", "password", "N3w-Password!42"))
        .exchange().expectStatus().isOk().expectBody(String.class).returnResult().getResponseBody();
    String newToken = "Bearer " + body.split("\\\"accessToken\\\":\\\"")[1].split("\\\"")[0];
    http().get().uri("/api/v1/users").header("Authorization", newToken)
        .exchange().expectStatus().isOk();
    assertThatThrownBy(() -> recovery.execute(operatorToken, approverToken, requestId,
        "An0ther-Password!42")).isInstanceOf(SecurityException.class);
  }

  @Test
  void recuperacion_rechaza_operador_objetivo_y_tenant_incorrectos() {
    UUID operator = platformOperator();
    UUID approver = UUID.randomUUID();
    inTenant("platform", () -> jdbc.update("""
        insert into app_user(id,tenant_id,email,password_hash,full_name,role)
        values (?,'platform',?,?,'Revisor','SUPER_ADMIN')
        """, approver, approver + "@platform.test", encoder.encode(PASSWORD)));
    String operatorToken = signed(operator, "platform", UserRole.SUPER_ADMIN).substring(7);
    String approverToken = signed(approver, "platform", UserRole.SUPER_ADMIN).substring(7);
    String a = tenant();
    String b = tenant();
    UUID target = user(a, "admin@negative.test", UserRole.ADMIN);
    UUID other = user(a, "other@negative.test", UserRole.ADMIN);
    UUID manager = user(a, "manager@negative.test", UserRole.MANAGER);
    UUID foreign = user(b, "foreign@negative.test", UserRole.ADMIN);
    inTenant(a, () -> jdbc.update("update app_user set active=false where tenant_id=? and id in (?,?)",
        a, target, manager));
    inTenant(b, () -> jdbc.update("update app_user set active=false where tenant_id=? and id=?", b, foreign));
    Instant now = Instant.now();
    UUID requestId = UUID.randomUUID();
    recoveryApprovals.createPending(operatorToken, new AdminRecoveryAuthorization(requestId,
        TenantId.of(a), a, target, operator, "MAP-238", "Sin ADMIN activo",
        now.minusSeconds(5), now.plusSeconds(300)));
    assertThat(recoveryApprovals.approve(operatorToken, approverToken, requestId)).isTrue();
    assertThatThrownBy(() -> recovery.execute(signed(other, a, UserRole.ADMIN).substring(7),
        approverToken, requestId, "N3w-Password!42")).isInstanceOf(SecurityException.class);
    assertThatThrownBy(() -> recovery.execute(operatorToken, approverToken, requestId,
        "N3w-Password!42")).isInstanceOf(IllegalStateException.class);
    inTenant(a, () -> jdbc.update("update app_user set active=false where tenant_id=? and id=?", a, other));
    assertThatThrownBy(() -> recovery.execute(operatorToken, approverToken, requestId,
        PASSWORD)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> recovery.execute(operatorToken, approverToken, requestId,
        "débil")).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> recoveryApprovals.createPending(operatorToken,
        new AdminRecoveryAuthorization(UUID.randomUUID(), TenantId.of(a), a, manager,
            operator, "MAP-238", "MANAGER no elegible", now, now.plusSeconds(300))))
        .isInstanceOf(RuntimeException.class);
    assertThatThrownBy(() -> recoveryApprovals.createPending(operatorToken,
        new AdminRecoveryAuthorization(UUID.randomUUID(), TenantId.of(a), a, foreign,
            operator, "MAP-238", "Tenant ajeno", now, now.plusSeconds(300))))
        .isInstanceOf(RuntimeException.class);
    inTenant(a, () -> assertThat(jdbc.queryForObject(
        "select active from app_user where tenant_id=? and id=?", Boolean.class, a, target)).isFalse());
    inTenant("platform", () -> assertThat(jdbc.queryForObject("""
        select count(*) from audit_log where tenant_id='platform' and event_type='USER_RECOVERED'
          and resource_id=?
        """, Long.class, target)).isZero());
  }

  @Test
  void dos_rescates_concurrentes_consumen_una_sola_aprobacion() throws Exception {
    UUID operator = platformOperator();
    UUID approver = UUID.randomUUID();
    inTenant("platform", () -> jdbc.update("""
        insert into app_user(id,tenant_id,email,password_hash,full_name,role)
        values (?,'platform',?,?,'Revisor','SUPER_ADMIN')
        """, approver, approver + "@platform.test", encoder.encode(PASSWORD)));
    String operatorToken = signed(operator, "platform", UserRole.SUPER_ADMIN).substring(7);
    String approverToken = signed(approver, "platform", UserRole.SUPER_ADMIN).substring(7);
    String a = tenant();
    UUID target = user(a, "admin@race.test", UserRole.ADMIN);
    inTenant(a, () -> jdbc.update("update app_user set active=false where tenant_id=? and id=?", a, target));
    UUID requestId = UUID.randomUUID();
    Instant now = Instant.now();
    recoveryApprovals.createPending(operatorToken, new AdminRecoveryAuthorization(requestId,
        TenantId.of(a), a, target, operator, "MAP-238", "Sin ADMIN activo",
        now.minusSeconds(5), now.plusSeconds(300)));
    assertThat(recoveryApprovals.approve(operatorToken, approverToken, requestId)).isTrue();
    CountDownLatch start = new CountDownLatch(1);
    try (var pool = Executors.newFixedThreadPool(2)) {
      var first = pool.submit(() -> { start.await(); return attemptRecovery(operatorToken,
          approverToken, requestId); });
      var second = pool.submit(() -> { start.await(); return attemptRecovery(operatorToken,
          approverToken, requestId); });
      start.countDown();
      assertThat(first.get(20, TimeUnit.SECONDS) + second.get(20, TimeUnit.SECONDS)).isEqualTo(1);
    }
    inTenant("platform", () -> assertThat(jdbc.queryForObject("""
        select count(*) from audit_log where tenant_id='platform' and event_type='USER_RECOVERED'
          and resource_id=?
        """, Long.class, target)).isEqualTo(1));
  }

  @Test
  void fallo_de_auditoria_revierte_cuenta_corte_y_consumo() {
    UUID operator = platformOperator();
    UUID approver = UUID.randomUUID();
    inTenant("platform", () -> jdbc.update("""
        insert into app_user(id,tenant_id,email,password_hash,full_name,role)
        values (?,'platform',?,?,'Revisor','SUPER_ADMIN')
        """, approver, approver + "@platform.test", encoder.encode(PASSWORD)));
    String operatorToken = signed(operator, "platform", UserRole.SUPER_ADMIN).substring(7);
    String approverToken = signed(approver, "platform", UserRole.SUPER_ADMIN).substring(7);
    String a = tenant();
    UUID target = user(a, "admin@rollback.test", UserRole.ADMIN);
    inTenant(a, () -> jdbc.update("update app_user set active=false where tenant_id=? and id=?", a, target));
    UUID requestId = UUID.randomUUID();
    Instant now = Instant.now();
    recoveryApprovals.createPending(operatorToken, new AdminRecoveryAuthorization(requestId,
        TenantId.of(a), a, target, operator, "MAP-238", "Sin ADMIN activo",
        now.minusSeconds(5), now.plusSeconds(300)));
    assertThat(recoveryApprovals.approve(operatorToken, approverToken, requestId)).isTrue();
    org.mockito.Mockito.doThrow(new IllegalStateException("Fallo de auditoría simulado"))
        .when(recoveryAudit).record(org.mockito.ArgumentMatchers.any(AuditEvent.class));
    assertThatThrownBy(() -> recovery.execute(operatorToken, approverToken, requestId,
        "N3w-Password!42")).hasRootCauseInstanceOf(IllegalStateException.class);
    inTenant(a, () -> {
      var unchanged = jdbc.queryForMap("""
          select active,staff_tokens_valid_after,password_hash from app_user where tenant_id=? and id=?
          """, a, target);
      assertThat(unchanged).containsEntry("active", false)
          .containsEntry("staff_tokens_valid_after", null);
      assertThat(encoder.matches(PASSWORD, (String) unchanged.get("password_hash"))).isTrue();
    });
    inTenant("platform", () -> {
      assertThat(jdbc.queryForObject("""
          select status from admin_recovery_authorization where tenant_id='platform' and id=?
          """, String.class, requestId)).isEqualTo("APPROVED");
      assertThat(jdbc.queryForObject("""
          select count(*) from audit_log where tenant_id='platform' and event_type='USER_RECOVERED'
            and resource_id=?
          """, Long.class, target)).isZero();
    });
  }

  private int attemptRecovery(String operatorToken, String approverToken, UUID requestId) {
    try {
      recovery.execute(operatorToken, approverToken, requestId, "N3w-Password!42");
      return 1;
    } catch (SecurityException | IllegalStateException rejected) {
      return 0;
    }
  }

  private int attempt(Runnable action) {
    try { action.run(); return 1; }
    catch (IllegalStateException exception) { return 0; }
  }

  private UUID platformOperator() {
    return new TransactionTemplate(transactions).execute(status -> {
      jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, "platform");
      return jdbc.queryForObject("""
          select id from app_user where tenant_id='platform' and role='SUPER_ADMIN'
            and email='superadmin@mapit.local'
          """, UUID.class);
    });
  }

  private String tenant() {
    String id = "t07-" + UUID.randomUUID().toString().substring(0, 8);
    jdbc.update("insert into tenant(id,name,slug,vertical) values (?,'T07',?,'RESTAURANT')", id, id);
    return id;
  }

  private UUID user(String tenant, String email, UserRole role) {
    UUID id = UUID.randomUUID();
    inTenant(tenant, () -> jdbc.update("""
        insert into app_user(id,tenant_id,email,password_hash,full_name,role)
        values(?,?,?,?,'T07',?)
        """, id, tenant, email, encoder.encode(PASSWORD), role.name()));
    return id;
  }

  private UUID id(String tenant, String email) {
    return new TransactionTemplate(transactions).execute(status -> {
      jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenant);
      return jdbc.queryForObject("select id from app_user where tenant_id=? and email=?", UUID.class, tenant, email);
    });
  }

  private String login(String tenant, String email) {
    String body = http().post().uri("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
        .body(Map.of("tenantSlug", tenant, "email", email, "password", PASSWORD))
        .exchange().expectStatus().isOk().expectBody(String.class).returnResult().getResponseBody();
    return "Bearer " + body.split("\\\"accessToken\\\":\\\"")[1].split("\\\"")[0];
  }

  private String signed(UUID id, String tenant, UserRole role) {
    return "Bearer " + tokens.issue(new AuthenticatedUser(id, TenantId.of(tenant),
        "t07@example.test", "T07", role)).value();
  }

  private RestTestClient http() {
    return RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
  }

  private void inTenant(String tenant, Runnable body) {
    new TransactionTemplate(transactions).executeWithoutResult(status -> {
      jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenant);
      body.run();
    });
  }
}
