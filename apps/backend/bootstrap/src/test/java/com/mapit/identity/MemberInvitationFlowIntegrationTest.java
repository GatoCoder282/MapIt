package com.mapit.identity;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Pattern;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.mapit.identity.domain.AccessTokenIssuer;
import com.mapit.identity.domain.AuthenticatedUser;
import com.mapit.identity.domain.UserRole;
import com.mapit.operations.infrastructure.audit.JdbcAuditLogRepository;
import com.mapit.platform.application.RegisterTenantCommand;
import com.mapit.platform.application.TenantService;
import com.mapit.platform.domain.BusinessVertical;
import com.mapit.shared.audit.AuditEventRecorder;
import com.mapit.shared.audit.AuditEventType;
import com.mapit.shared.invitation.InvitationSecrets;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

/** Flujos CU-25 + MEMBER con PG17, mapit_app y transporte SMTP capturado sin secretos en BD. */
@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@Import(MemberInvitationFlowIntegrationTest.Fixture.class)
class MemberInvitationFlowIntegrationTest {
  private static final List<SimpleMailMessage> MAILS = new CopyOnWriteArrayList<>();
  private static final AtomicBoolean FAIL_MAIL = new AtomicBoolean();
  private static final AtomicBoolean UNKNOWN_MAIL = new AtomicBoolean();
  private static final AtomicBoolean FAIL_AUDIT = new AtomicBoolean();
  private static final Pattern TOKEN = Pattern.compile("[?&]token=([A-Za-z0-9_-]+)");
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
    registry.add("mapit.super-admin.password", () -> "");
    registry.add("mapit.unleash.enabled", () -> "false");
    registry.add("mapit.realtime.outbox.poll-interval-ms", () -> "3600000");
  }

  @TestConfiguration
  static class Fixture {
    @Bean @Primary JavaMailSender capturedMail() {
      JavaMailSender sender = Mockito.mock(JavaMailSender.class);
      Mockito.doAnswer(invocation -> {
        MAILS.add(invocation.getArgument(0));
        if (FAIL_MAIL.get()) throw new MailAuthenticationException("smtp test");
        if (UNKNOWN_MAIL.get()) throw new IllegalStateException("smtp ambiguous test");
        return null;
      }).when(sender).send(Mockito.any(SimpleMailMessage.class));
      return sender;
    }

    @Bean @Primary AuditEventRecorder guardedAudit(JdbcAuditLogRepository repository) {
      return event -> {
        if (FAIL_AUDIT.get() && event.eventType() == AuditEventType.USER_INVITATION_ISSUED) {
          throw new IllegalStateException("audit test");
        }
        repository.record(event);
      };
    }
  }

  @LocalServerPort private int port;
  @Autowired private JdbcTemplate jdbc;
  @Autowired private PlatformTransactionManager transactions;
  @Autowired private AccessTokenIssuer tokens;
  @Autowired private TenantService tenantService;
  @Autowired private InvitationSecrets secrets;

  @Test
  void onboarding_admin_se_conserva_y_member_se_activa_con_rol_de_bd_y_auditoria() {
    MAILS.clear();
    String slug = tenant();
    UUID admin = user(slug, UserRole.ADMIN, "admin@flow.test");
    String bearer = bearer(slug, admin, UserRole.ADMIN);

    var response = invite(bearer, " Manager@Flow.test ", "MANAGER");
    assertThat(response.email()).isEqualTo("manager@flow.test");
    assertThat(response.role()).isEqualTo("MANAGER");
    assertThat(response.status()).isEqualTo("PENDING");
    assertThat(response.dispatchStatus()).isEqualTo("SMTP_ACCEPTED");
    assertThat(Duration.between(Instant.now(), Instant.parse(response.expiresAt())).toHours()).isBetween(23L, 24L);
    assertThat(MAILS).hasSize(1);
    String raw = lastToken();
    assertThat(URI.create("http://localhost:4300/activar?tenant=" + slug + "&token=" + raw)).isNotNull();
    inTenant(slug, () -> {
      assertThat(jdbc.queryForObject("select current_user", String.class)).isEqualTo("mapit_app");
      assertThat(jdbc.queryForObject("select count(*) from app_user where email='manager@flow.test'", Long.class)).isZero();
      Map<String, Object> row = jdbc.queryForMap("select token_hash,purpose,target_role,invited_by,dispatch_status,dispatch_attempted_at from invitation_tokens where id=?", response.id());
      assertThat(row).containsEntry("purpose", "MEMBER").containsEntry("target_role", "MANAGER")
          .containsEntry("invited_by", admin).containsEntry("dispatch_status", "SMTP_ACCEPTED");
      assertThat(row.get("dispatch_attempted_at")).isNotNull();
      assertThat(row.get("token_hash")).isNotEqualTo(raw);
      assertThat(jdbc.queryForObject("select expires_at-created_at=interval '24 hours' from invitation_tokens where id=?", Boolean.class, response.id())).isTrue();
      assertThat(jdbc.queryForObject("select count(*) from audit_log where event_type='USER_INVITATION_ISSUED' and actor_id=? and resource_id=?", Long.class, admin, response.id())).isEqualTo(1);
      assertThat(jdbc.queryForObject("select details::text from audit_log where event_type='USER_INVITATION_ISSUED' and resource_id=?", String.class, response.id()))
          .doesNotContain(raw, "token", "password", "hash");
    });
    activate(slug, raw).expectStatus().isOk();
    activate(slug, raw).expectStatus().isBadRequest();
    inTenant(slug, () -> {
      var member = jdbc.queryForMap("select id,role,password_hash,active from app_user where email='manager@flow.test'");
      assertThat(member).containsEntry("role", "MANAGER").containsEntry("active", true);
      assertThat(member.get("password_hash").toString()).startsWith("$2").doesNotContain(PASSWORD);
      assertThat(jdbc.queryForObject("select count(*) from audit_log where event_type='USER_INVITATION_ACCEPTED' and actor_id=? and resource_id=?", Long.class, member.get("id"), member.get("id"))).isEqualTo(1);
      assertThat(jdbc.queryForObject("select count(*) from invitation_tokens where id=? and consumed_at is not null", Long.class, response.id())).isEqualTo(1);
    });
    resend(bearer, response.id()).expectStatus().isEqualTo(409);
  }

  @Test
  void smtp_fallido_conserva_pendiente_y_reenvio_revoca_token_anterior() {
    MAILS.clear();
    String slug = tenant();
    UUID admin = user(slug, UserRole.ADMIN, "admin@retry.test");
    String bearer = bearer(slug, admin, UserRole.ADMIN);
    FAIL_MAIL.set(true);
    InvitationView first;
    try {
      first = invite(bearer, "retry@flow.test", "STAFF");
    } finally {
      FAIL_MAIL.set(false);
    }
    assertThat(first.dispatchStatus()).isEqualTo("SMTP_FAILED");
    String old = lastToken();
    inTenant(slug, () -> assertThat(jdbc.queryForObject(
        "select dispatch_status from invitation_tokens where id=?", String.class, first.id())).isEqualTo("SMTP_FAILED"));

    InvitationView next = resendView(bearer, first.id());
    assertThat(next.id()).isNotEqualTo(first.id());
    assertThat(next.dispatchStatus()).isEqualTo("SMTP_ACCEPTED");
    assertThat(lastToken()).isNotEqualTo(old);
    activate(slug, old).expectStatus().isBadRequest();
    inTenant(slug, () -> {
      assertThat(jdbc.queryForObject("select count(*) from invitation_tokens where email='retry@flow.test' and revoked_at is null and consumed_at is null", Long.class)).isEqualTo(1);
      assertThat(jdbc.queryForObject("select count(*) from invitation_tokens where id=? and revoked_at is not null", Long.class, first.id())).isEqualTo(1);
      assertThat(jdbc.queryForObject("select count(*) from audit_log where event_type='USER_INVITATION_ISSUED' and actor_id=?", Long.class, admin)).isEqualTo(2);
    });
    resend(bearer, next.id()).expectStatus().isEqualTo(409);
    inTenant(slug, () -> jdbc.update(
        "update invitation_tokens set dispatch_attempted_at=now()-interval '31 seconds' where id=?", next.id()));
    resendView(bearer, next.id());
    activate(slug, lastToken()).expectStatus().isOk();
    inTenant(slug, () -> assertThat(jdbc.queryForObject(
        "select role from app_user where email='retry@flow.test'", String.class)).isEqualTo("STAFF"));
  }

  @Test
  void duplicados_tenant_ajeno_expiracion_y_rollback_de_auditoria() {
    MAILS.clear();
    String a = tenant();
    String b = tenant();
    UUID admin = user(a, UserRole.ADMIN, "admin@checks.test");
    UUID adminB = user(b, UserRole.ADMIN, "admin@bchecks.test");
    String bearer = bearer(a, admin, UserRole.ADMIN);
    String other = bearer(b, adminB, UserRole.ADMIN);
    InvitationView first = invite(bearer, "pending@checks.test", "STAFF");
    http().post().uri("/api/v1/users").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
        .body(Map.of("email", "pending@checks.test", "role", "MANAGER"))
        .exchange().expectStatus().isEqualTo(409);
    resend(other, first.id()).expectStatus().isNotFound();
    activate(b, lastToken()).expectStatus().isBadRequest();
    user(a, UserRole.STAFF, "inactive@checks.test");
    inTenant(a, () -> jdbc.update("update app_user set active=false where email='inactive@checks.test'"));
    http().post().uri("/api/v1/users").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
        .body(Map.of("email", "inactive@checks.test", "role", "STAFF"))
        .exchange().expectStatus().isEqualTo(409);

    int mailsBefore = MAILS.size();
    FAIL_AUDIT.set(true);
    try {
      http().post().uri("/api/v1/users").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
          .body(Map.of("email", "rollback@checks.test", "role", "STAFF"))
          .exchange().expectStatus().is5xxServerError();
    } finally {
      FAIL_AUDIT.set(false);
    }
    assertThat(MAILS).hasSize(mailsBefore);
    inTenant(a, () -> {
      assertThat(jdbc.queryForObject("select count(*) from invitation_tokens where email='rollback@checks.test'", Long.class)).isZero();
      assertThat(jdbc.queryForObject("select count(*) from audit_log where event_type='USER_INVITATION_ISSUED' and resource_id=?", Long.class, first.id())).isEqualTo(1);
    });
  }

  @Test
  void caducada_se_revoca_antes_de_nueva_emision_y_resultado_smtp_ambiguo_no_pierde_pendiente() {
    MAILS.clear();
    String tenant = tenant();
    UUID admin = user(tenant, UserRole.ADMIN, "admin@expired.test");
    String bearer = bearer(tenant, admin, UserRole.ADMIN);
    String raw = secrets.newToken();
    UUID expired = UUID.randomUUID();
    inTenant(tenant, () -> jdbc.update("""
        insert into invitation_tokens
          (id,tenant_id,email,purpose,target_role,invited_by,token_hash,
           created_at,expires_at,dispatch_status)
        values (?,?,?,'MEMBER','STAFF',?,?,now()-interval '25 hours',
                now()-interval '1 hour','UNKNOWN')
        """, expired, tenant, "expired@t06.test", admin, secrets.hash(raw)));
    activate(tenant, raw).expectStatus().isBadRequest();
    UNKNOWN_MAIL.set(true);
    InvitationView fresh;
    try {
      fresh = invite(bearer, "expired@t06.test", "MANAGER");
    } finally {
      UNKNOWN_MAIL.set(false);
    }
    assertThat(fresh.dispatchStatus()).isEqualTo("UNKNOWN");
    inTenant(tenant, () -> {
      assertThat(jdbc.queryForObject("select count(*) from invitation_tokens where id=? and revoked_at is not null", Long.class, expired)).isEqualTo(1);
      assertThat(jdbc.queryForObject("select dispatch_status from invitation_tokens where id=?", String.class, fresh.id())).isEqualTo("UNKNOWN");
      assertThat(jdbc.queryForObject("select count(*) from invitation_tokens where email='expired@t06.test' and consumed_at is null and revoked_at is null", Long.class)).isEqualTo(1);
    });
    activate(tenant, raw).expectStatus().isBadRequest();
    String unknownLink = lastToken();
    resend(bearer, fresh.id()).expectStatus().isEqualTo(409);
    inTenant(tenant, () -> jdbc.update(
        "update invitation_tokens set dispatch_attempted_at=now()-interval '31 seconds' where id=?", fresh.id()));
    InvitationView retried = resendView(bearer, fresh.id());
    assertThat(retried.dispatchStatus()).isEqualTo("SMTP_ACCEPTED");
    activate(tenant, unknownLink).expectStatus().isBadRequest();
    activate(tenant, lastToken()).expectStatus().isOk();
  }

  @Test
  void reenvio_y_aceptacion_compiten_por_el_mismo_bloqueo_y_no_crean_dos_credenciales() throws Exception {
    MAILS.clear();
    String tenant = tenant();
    UUID admin = user(tenant, UserRole.ADMIN, "admin@mix.test");
    String bearer = bearer(tenant, admin, UserRole.ADMIN);
    InvitationView original = invite(bearer, "mix@t06.test", "STAFF");
    String oldToken = lastToken();
    inTenant(tenant, () -> jdbc.update(
        "update invitation_tokens set dispatch_attempted_at=now()-interval '31 seconds' where id=?", original.id()));
    CountDownLatch start = new CountDownLatch(1);
    int resendStatus;
    int acceptStatus;
    try (var pool = Executors.newFixedThreadPool(2)) {
      var resend = pool.submit(() -> { start.await(); return resend(bearer, original.id())
          .returnResult(Void.class).getStatus().value(); });
      var accept = pool.submit(() -> { start.await(); return activateStatus(tenant, oldToken); });
      start.countDown();
      resendStatus = resend.get(30, TimeUnit.SECONDS);
      acceptStatus = accept.get(30, TimeUnit.SECONDS);
    }
    assertThat(List.of(resendStatus, acceptStatus))
        .satisfies(statuses -> assertThat(statuses).isIn(List.of(202, 400), List.of(409, 200)));
    inTenant(tenant, () -> {
      long pending = jdbc.queryForObject("select count(*) from invitation_tokens where email='mix@t06.test' and consumed_at is null and revoked_at is null", Long.class);
      long accounts = jdbc.queryForObject("select count(*) from app_user where email='mix@t06.test'", Long.class);
      assertThat(pending + accounts).isEqualTo(1);
    });
  }

  @Test
  void admin_desactivado_no_emite_nuevas_pero_invitacion_confirmada_sigue_valida() {
    MAILS.clear();
    String tenant = tenant();
    UUID admin = user(tenant, UserRole.ADMIN, "admin@disabled.test");
    String bearer = bearer(tenant, admin, UserRole.ADMIN);
    invite(bearer, "staff@disabled.test", "STAFF");
    String link = lastToken();
    inTenant(tenant, () -> jdbc.update("update app_user set active=false where id=?", admin));
    http().post().uri("/api/v1/users").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
        .body(Map.of("email", "new@disabled.test", "role", "STAFF"))
        .exchange().expectStatus().isUnauthorized();
    // La invitación fue autorizada y auditada al emitirse; desactivar al emisor
    // no la revoca implícitamente. La aceptación sigue exigiendo tenant ACTIVE.
    activate(tenant, link).expectStatus().isOk();
  }

  @Test
  void cuenta_concurrente_existente_no_consume_token_ni_audita_aceptacion() {
    MAILS.clear();
    String tenant = tenant();
    UUID admin = user(tenant, UserRole.ADMIN, "admin@duplicate.test");
    InvitationView pending = invite(bearer(tenant, admin, UserRole.ADMIN), "target@duplicate.test", "STAFF");
    String raw = lastToken();
    user(tenant, UserRole.STAFF, "target@duplicate.test");
    activate(tenant, raw).expectStatus().isEqualTo(409);
    inTenant(tenant, () -> {
      assertThat(jdbc.queryForObject("select count(*) from app_user where email='target@duplicate.test'", Long.class)).isEqualTo(1);
      assertThat(jdbc.queryForObject("select count(*) from invitation_tokens where id=? and consumed_at is null", Long.class, pending.id())).isEqualTo(1);
      assertThat(jdbc.queryForObject("select count(*) from audit_log where event_type='USER_INVITATION_ACCEPTED'", Long.class)).isZero();
    });
  }

  @Test
  void dos_reenvios_simultaneos_de_un_id_producen_un_solo_reemplazo() throws Exception {
    MAILS.clear();
    String tenant = tenant();
    UUID admin = user(tenant, UserRole.ADMIN, "admin@two-resends.test");
    String bearer = bearer(tenant, admin, UserRole.ADMIN);
    InvitationView old = invite(bearer, "target@two-resends.test", "STAFF");
    String originalToken = lastToken();
    inTenant(tenant, () -> jdbc.update(
        "update invitation_tokens set dispatch_attempted_at=now()-interval '31 seconds' where id=?", old.id()));
    CountDownLatch start = new CountDownLatch(1);
    try (var pool = Executors.newFixedThreadPool(2)) {
      var a = pool.submit(() -> { start.await(); return resend(bearer, old.id())
          .returnResult(Void.class).getStatus().value(); });
      var b = pool.submit(() -> { start.await(); return resend(bearer, old.id())
          .returnResult(Void.class).getStatus().value(); });
      start.countDown();
      assertThat(List.of(a.get(30, TimeUnit.SECONDS), b.get(30, TimeUnit.SECONDS)))
          .containsExactlyInAnyOrder(202, 409);
    }
    activate(tenant, originalToken).expectStatus().isBadRequest();
    inTenant(tenant, () -> assertThat(jdbc.queryForObject(
        "select count(*) from invitation_tokens where email='target@two-resends.test' and revoked_at is null and consumed_at is null", Long.class)).isEqualTo(1));
  }

  @Test
  void rol_inyectado_en_activacion_no_eleva_staff_a_admin_y_token_invalido_no_crea_cuenta() {
    MAILS.clear();
    String tenant = tenant();
    UUID admin = user(tenant, UserRole.ADMIN, "admin@role.test");
    invite(bearer(tenant, admin, UserRole.ADMIN), "staff@role.test", "STAFF");
    String raw = lastToken();
    activate(tenant, secrets.newToken()).expectStatus().isBadRequest();
    http().post().uri("/api/v1/auth/activate").contentType(MediaType.APPLICATION_JSON)
        .body(Map.of("tenantSlug", tenant, "token", raw, "password", PASSWORD,
            "passwordConfirm", PASSWORD, "role", "ADMIN"))
        .exchange().expectStatus().isOk();
    inTenant(tenant, () -> {
      assertThat(jdbc.queryForObject("select role from app_user where email='staff@role.test'", String.class)).isEqualTo("STAFF");
      assertThat(jdbc.queryForObject("select count(*) from audit_log where event_type='USER_INVITATION_ACCEPTED'", Long.class)).isEqualTo(1);
    });
  }

  @Test
  void concurrencia_emision_y_aceptacion_unicas_y_tenant_suspendido() throws Exception {
    MAILS.clear();
    String slug = tenant();
    UUID admin = user(slug, UserRole.ADMIN, "admin@race.test");
    String bearer = bearer(slug, admin, UserRole.ADMIN);
    CountDownLatch start = new CountDownLatch(1);
    try (var pool = Executors.newFixedThreadPool(2)) {
      var a = pool.submit(() -> { start.await(); return inviteStatus(bearer, "race@checks.test"); });
      var b = pool.submit(() -> { start.await(); return inviteStatus(bearer, "race@checks.test"); });
      start.countDown();
      assertThat(List.of(a.get(30, TimeUnit.SECONDS), b.get(30, TimeUnit.SECONDS)))
          .containsExactlyInAnyOrder(202, 409);
    }
    inTenant(slug, () -> assertThat(jdbc.queryForObject(
        "select count(*) from invitation_tokens where email='race@checks.test' and consumed_at is null and revoked_at is null", Long.class)).isEqualTo(1));
    String raw = lastToken();
    CountDownLatch accept = new CountDownLatch(1);
    try (var pool = Executors.newFixedThreadPool(2)) {
      var a = pool.submit(() -> { accept.await(); return activateStatus(slug, raw); });
      var b = pool.submit(() -> { accept.await(); return activateStatus(slug, raw); });
      accept.countDown();
      assertThat(List.of(a.get(30, TimeUnit.SECONDS), b.get(30, TimeUnit.SECONDS)))
          .containsExactlyInAnyOrder(200, 400);
    }
    inTenant(slug, () -> {
      assertThat(jdbc.queryForObject("select count(*) from app_user where email='race@checks.test'", Long.class)).isEqualTo(1);
      assertThat(jdbc.queryForObject("select count(*) from audit_log where event_type='USER_INVITATION_ACCEPTED'", Long.class)).isEqualTo(1);
    });
    InvitationView another = invite(bearer, "later@checks.test", "STAFF");
    String laterToken = lastToken();
    jdbc.update("update tenant set status='SUSPENDED' where id=?", slug);
    activate(slug, laterToken).expectStatus().isBadRequest();
    http().post().uri("/api/v1/users").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
        .body(Map.of("email", "newer@checks.test", "role", "STAFF"))
        .exchange().expectStatus().isUnauthorized();
    assertThat(another.id()).isNotNull();
  }

  @Test
  void primer_admin_cu25_se_activa_sin_post_usuarios() {
    MAILS.clear();
    String slug = "cu25-" + UUID.randomUUID().toString().substring(0, 8);
    var tenant = tenantService.register(new RegisterTenantCommand(
        "Organización CU25", slug, BusinessVertical.RESTAURANT, "first@cu25.test"));
    assertThat(tenant.slug()).isEqualTo(slug);
    activate(slug, lastToken()).expectStatus().isOk();
    inTenant(tenant.id().value(), () -> {
      assertThat(jdbc.queryForObject("select role from app_user where email='first@cu25.test'", String.class)).isEqualTo("ADMIN");
      assertThat(jdbc.queryForObject("select count(*) from audit_log where event_type='USER_INVITATION_ACCEPTED'", Long.class)).isEqualTo(1);
    });
  }

  @Test
  void plataforma_registra_tenant_por_http_y_solo_su_primer_admin_activado_invita_miembros() {
    MAILS.clear();
    String slug = "t09-" + UUID.randomUUID().toString().substring(0, 8);
    UUID operator = user("platform", UserRole.SUPER_ADMIN, "sa-" + UUID.randomUUID() + "@flow.test");
    String platformBearer = bearer("platform", operator, UserRole.SUPER_ADMIN);
    http().post().uri("/api/v1/tenants").header("Authorization", platformBearer)
        .contentType(MediaType.APPLICATION_JSON)
        .body(Map.of("name", "Empresa T09", "slug", slug, "vertical", "RESTAURANT",
            "administratorEmail", "first@t09.test"))
        .exchange().expectStatus().isCreated();
    String tenantId = jdbc.queryForObject("select id from tenant where slug=?", String.class, slug);
    String firstLink = lastToken();
    http().post().uri("/api/v1/users").header("Authorization", platformBearer)
        .contentType(MediaType.APPLICATION_JSON).body(Map.of("email", "other@t09.test", "role", "ADMIN"))
        .exchange().expectStatus().isForbidden();
    inTenant(tenantId, () -> {
      assertThat(jdbc.queryForObject("select count(*) from app_user where tenant_id=?", Long.class, tenantId)).isZero();
      assertThat(jdbc.queryForObject("select count(*) from invitation_tokens where purpose='ADMIN_ONBOARDING'", Long.class)).isEqualTo(1);
    });
    activate(slug, firstLink).expectStatus().isOk();
    UUID firstAdmin = new TransactionTemplate(transactions).execute(status -> {
      jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenantId);
      return jdbc.queryForObject("select id from app_user where tenant_id=? and email='first@t09.test' and role='ADMIN'", UUID.class, tenantId);
    });
    String adminBearer = bearer(tenantId, firstAdmin, UserRole.ADMIN);
    for (String role : List.of("MANAGER", "STAFF")) {
      String email = role.toLowerCase(java.util.Locale.ROOT) + "@t09.test";
      InvitationView receipt = invite(adminBearer, email, role);
      assertThat(receipt.status()).isEqualTo("PENDING");
      assertThat(receipt.role()).isEqualTo(role);
      assertThat(receipt).extracting(InvitationView::id).isNotNull();
      inTenant(tenantId, () -> assertThat(jdbc.queryForObject(
          "select count(*) from app_user where tenant_id=? and email=?", Long.class, tenantId, email)).isZero());
      activate(slug, lastToken()).expectStatus().isOk();
      inTenant(tenantId, () -> assertThat(jdbc.queryForObject(
          "select role from app_user where tenant_id=? and email=?", String.class, tenantId, email)).isEqualTo(role));
    }
    inTenant(tenantId, () -> assertThat(jdbc.queryForObject(
        "select count(*) from app_user where tenant_id=? and role='ADMIN'", Long.class, tenantId)).isEqualTo(1));
  }

  @Test
  void listado_member_recupera_ids_tras_otra_peticion_y_aisla_tenant_estado_y_rol() {
    MAILS.clear();
    String a = tenant();
    String b = tenant();
    UUID admin = user(a, UserRole.ADMIN, "admin@listing.test");
    UUID manager = user(a, UserRole.MANAGER, "manager@listing.test");
    UUID staff = user(a, UserRole.STAFF, "staff@listing.test");
    UUID adminB = user(b, UserRole.ADMIN, "admin@other-listing.test");
    String bearer = bearer(a, admin, UserRole.ADMIN);
    InvitationView first = invite(bearer, "pending@listing.test", "STAFF");
    String originalToken = lastToken();
    UUID expired = UUID.randomUUID();
    inTenant(a, () -> jdbc.update("""
        insert into invitation_tokens
          (id,tenant_id,email,purpose,target_role,invited_by,token_hash,
           created_at,expires_at,dispatch_status,dispatch_attempted_at)
        values (?,?,?,'MEMBER','MANAGER',?,?,now()-interval '25 hours',
                now()-interval '1 hour','SMTP_FAILED',now()-interval '1 hour')
        """, expired, a, "expired@listing.test", admin, secrets.hash(secrets.newToken())));
    invite(bearer(b, adminB, UserRole.ADMIN), "outside@listing.test", "STAFF");
    inTenant(a, () -> jdbc.update("""
        insert into invitation_tokens (tenant_id,email,token_hash,expires_at)
        values (?,?,?,now()+interval '24 hours')
        """, a, "first@listing.test", secrets.hash(secrets.newToken())));

    String page0 = http().get().uri("/api/v1/user-invitations?page=0&size=1")
        .header("Authorization", bearer).exchange().expectStatus().isOk()
        .expectHeader().valueEquals("Cache-Control", "no-store")
        .expectBody(String.class).returnResult().getResponseBody();
    String page1 = http().get().uri("/api/v1/user-invitations?page=1&size=1")
        .header("Authorization", bearer).exchange().expectStatus().isOk()
        .expectBody(String.class).returnResult().getResponseBody();
    assertThat(page0).contains("\"totalElements\":2", "\"totalPages\":2", "dispatchAttemptedAt");
    assertThat(page0 + page1).contains(first.id().toString(), expired.toString(),
        "\"status\":\"PENDING\"", "\"status\":\"EXPIRED\"", "SMTP_ACCEPTED")
        .doesNotContain("outside@listing.test", "first@listing.test", originalToken,
            "tokenHash", "token_hash", "password", "revokedAt", "consumedAt");
    http().get().uri("/api/v1/user-invitations?page=2&size=1")
        .header("Authorization", bearer).exchange().expectStatus().isOk()
        .expectBody(String.class).value(body -> assertThat(body).contains("\"content\":[]"));
    http().get().uri("/api/v1/user-invitations?page=-1").header("Authorization", bearer)
        .exchange().expectStatus().isBadRequest();
    http().get().uri("/api/v1/user-invitations?size=101").header("Authorization", bearer)
        .exchange().expectStatus().isBadRequest();
    for (UUID member : List.of(manager, staff)) {
      http().get().uri("/api/v1/user-invitations")
          .header("Authorization", bearer(a, member, member.equals(manager) ? UserRole.MANAGER : UserRole.STAFF))
          .exchange().expectStatus().isForbidden();
    }
    http().get().uri("/api/v1/user-invitations").header("Authorization", bearer(a, staff, UserRole.ADMIN))
        .exchange().expectStatus().isUnauthorized();
    http().get().uri("/api/v1/user-invitations").exchange().expectStatus().isUnauthorized();
    // Se recupera un ID real de la nueva solicitud: el reenvío de una caducada funciona.
    InvitationView replacement = resendView(bearer, expired);
    assertThat(replacement.id()).isNotEqualTo(expired);
    activate(a, originalToken).expectStatus().isOk();
    String afterAcceptance = http().get().uri("/api/v1/user-invitations")
        .header("Authorization", bearer).exchange().expectStatus().isOk()
        .expectBody(String.class).returnResult().getResponseBody();
    assertThat(afterAcceptance).doesNotContain(first.id().toString()).contains(replacement.id().toString());
    resend(bearer, first.id()).expectStatus().isEqualTo(409);
  }

  private InvitationView invite(String bearer, String email, String role) {
    return http().post().uri("/api/v1/users").header("Authorization", bearer)
        .contentType(MediaType.APPLICATION_JSON).body(Map.of("email", email, "role", role))
        .exchange().expectStatus().isAccepted().expectBody(InvitationView.class)
        .returnResult().getResponseBody();
  }

  private int inviteStatus(String bearer, String email) {
    return http().post().uri("/api/v1/users").header("Authorization", bearer)
        .contentType(MediaType.APPLICATION_JSON).body(Map.of("email", email, "role", "STAFF"))
        .exchange().returnResult(Void.class).getStatus().value();
  }

  private InvitationView resendView(String bearer, UUID id) {
    return resend(bearer, id).expectStatus().isAccepted().expectBody(InvitationView.class)
        .returnResult().getResponseBody();
  }

  private RestTestClient.ResponseSpec resend(String bearer, UUID id) {
    return http().post().uri("/api/v1/user-invitations/" + id + "/resend")
        .header("Authorization", bearer).exchange();
  }

  private RestTestClient.ResponseSpec activate(String slug, String raw) {
    return http().post().uri("/api/v1/auth/activate").contentType(MediaType.APPLICATION_JSON)
        .body(Map.of("tenantSlug", slug, "token", raw, "password", PASSWORD, "passwordConfirm", PASSWORD))
        .exchange();
  }

  private int activateStatus(String slug, String raw) {
    return activate(slug, raw).returnResult(Void.class).getStatus().value();
  }

  private String lastToken() {
    var matcher = TOKEN.matcher(MAILS.getLast().getText());
    assertThat(matcher.find()).isTrue();
    return matcher.group(1);
  }

  private RestTestClient http() {
    return RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
  }

  private String tenant() {
    String id = "t06-" + UUID.randomUUID().toString().substring(0, 8);
    jdbc.update("insert into tenant (id,name,slug,status,vertical) values (?,'T06',?,'ACTIVE','RESTAURANT')", id, id);
    return id;
  }

  private UUID user(String tenant, UserRole role, String email) {
    UUID id = UUID.randomUUID();
    inTenant(tenant, () -> jdbc.update("insert into app_user (id,tenant_id,email,password_hash,full_name,role) values (?,?,?,'fixture','Admin',?)", id, tenant, email, role.name()));
    return id;
  }

  private String bearer(String tenant, UUID id, UserRole role) {
    return "Bearer " + tokens.issue(new AuthenticatedUser(id, TenantId.of(tenant),
        "fixture@t06.test", "Test", role)).value();
  }

  private void inTenant(String tenant, Runnable body) {
    new TransactionTemplate(transactions).executeWithoutResult(status -> {
      jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenant);
      body.run();
    });
  }

  private record InvitationView(UUID id, String email, String role, String status,
      String dispatchStatus, String expiresAt) {}
}
