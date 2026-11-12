package com.mapit.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.mapit.shared.tenant.TenantScope;

/** Verifica el esquema T04 con PostgreSQL 17 y el rol runtime, sin endpoints futuros. */
@Tag("integration")
@SpringBootTest
@Testcontainers
class MemberInvitationPersistenceIntegrationTest {

  private static final String A = "hu104-a";
  private static final String B = "hu104-b";
  private static final UUID ADMIN_A = UUID.fromString("10400000-0000-0000-0000-000000000001");
  private static final UUID ADMIN_B = UUID.fromString("10400000-0000-0000-0000-000000000002");

  @Container
  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:17-alpine")
          .withDatabaseName("mapit")
          .withUsername("mapit")
          .withPassword("test_password");

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

  @Autowired private JdbcTemplate jdbc;
  @Autowired private PlatformTransactionManager transactions;

  @Test
  void migracion_desde_cero_y_compatibilidad_con_onboarding() {
    setup();
    assertThat(jdbc.queryForObject("select current_user", String.class)).isEqualTo("mapit_app");
    inTenant(A, () -> {
      jdbc.update("insert into invitation_tokens (tenant_id,email,token_hash,expires_at) values (?, ?, ?, now() + interval '24 hours')", A, "first@a.test", hash());
      assertThat(jdbc.queryForMap("select purpose,target_role,invited_by,dispatch_status from invitation_tokens where email='first@a.test'"))
          .containsEntry("purpose", "ADMIN_ONBOARDING")
          .containsEntry("target_role", null)
          .containsEntry("invited_by", null)
          .containsEntry("dispatch_status", null);
      assertThat(jdbc.update("update invitation_tokens set consumed_at=now(),user_id=? where email='first@a.test' and consumed_at is null", ADMIN_A)).isEqualTo(1);
    });
  }

  @Test
  void tenant_global_permite_bloqueo_transaccional_al_rol_runtime() {
    setup();
    inTenant(A, () -> {
      assertThat(jdbc.queryForObject("select id from tenant where id=? for update", String.class, A))
          .isEqualTo(A);
      assertThat(jdbc.queryForObject(
          "select count(*) from app_user where tenant_id=? and role='ADMIN' and active", Long.class, A))
          .isEqualTo(1);
    });
  }

  @Test
  void restricciones_rol_ttl_tenant_y_correo_existente() {
    setup();
    for (String role : new String[] {"ADMIN", "SUPER_ADMIN", null}) {
      assertThatThrownBy(() -> inTenant(A, () -> member(A, "bad@a.test", role, ADMIN_A)))
          .isInstanceOf(DataAccessException.class);
    }
    assertThatThrownBy(() -> inTenant(A, () -> member(A, "bad@a.test", "STAFF", ADMIN_B)))
        .isInstanceOf(DataAccessException.class);
    assertThatThrownBy(() -> inTenant(A, () -> jdbc.update(
        "insert into invitation_tokens (tenant_id,email,token_hash,expires_at,purpose,target_role,invited_by,dispatch_status) values (?,?,?,now() + interval '25 hours','MEMBER','STAFF',?,'SEND_REQUESTED')",
        A,"bad@a.test",hash(),ADMIN_A))).isInstanceOf(DataAccessException.class);
    assertThatThrownBy(() -> inTenant(A, () -> member(B, "bad@b.test", "STAFF", ADMIN_B)))
        .isInstanceOf(DataAccessException.class);
    // La cuenta ya registrada, incluso inactiva, no admite duplicado al aceptarse.
    inTenant(A, () -> jdbc.update("insert into app_user (tenant_id,email,password_hash,full_name,role,active) values (?,'inactive@a.test','x','Baja','STAFF',false)", A));
    assertThatThrownBy(() -> inTenant(A, () -> jdbc.update(
        "insert into app_user (tenant_id,email,password_hash,full_name,role) values (?,'inactive@a.test','x','Otro','STAFF')", A)))
        .isInstanceOf(DataAccessException.class);
  }

  @Test
  void revocacion_consumo_unicidad_y_rls() {
    setup();
    UUID[] first = new UUID[1];
    inTenant(A, () -> first[0] = member(A, "new@a.test", "MANAGER", ADMIN_A));
    assertThatThrownBy(() -> inTenant(A, () -> member(A, "new@a.test", "STAFF", ADMIN_A)))
        .isInstanceOf(DataAccessException.class);
    UUID old = first[0];
    inTenant(A, () -> {
      jdbc.update("update invitation_tokens set revoked_at=now(),dispatch_status='SMTP_FAILED' where id=?", old);
      member(A, "new@a.test", "STAFF", ADMIN_A);
      assertThat(jdbc.queryForObject("select count(*) from invitation_tokens where email='new@a.test' and revoked_at is null and consumed_at is null", Long.class)).isEqualTo(1);
    });
    assertThatThrownBy(() -> inTenant(A, () -> jdbc.update("update invitation_tokens set revoked_at=null where id=?", old)))
        .isInstanceOf(DataAccessException.class);
    inTenant(A, () -> {
      UUID current = jdbc.queryForObject("select id from invitation_tokens where email='new@a.test' and revoked_at is null", UUID.class);
      jdbc.update("insert into app_user (tenant_id,email,password_hash,full_name,role) values (?,'new@a.test','x','Miembro','STAFF')", A);
      UUID user = jdbc.queryForObject("select id from app_user where email='new@a.test'", UUID.class);
      assertThat(jdbc.update("update invitation_tokens set consumed_at=now(),user_id=? where id=? and consumed_at is null and revoked_at is null and expires_at > now()", user, current)).isEqualTo(1);
      assertThat(jdbc.update("update invitation_tokens set consumed_at=now(),user_id=? where id=? and consumed_at is null and revoked_at is null and expires_at > now()", user, current)).isZero();
    });
    inTenant(null, () -> {
      assertThat(jdbc.queryForObject("select count(*) from invitation_tokens where email='new@a.test'", Long.class)).isZero();
      assertThat(jdbc.queryForObject("select count(*) from audit_log", Long.class)).isZero();
    });
    inTenant(B, () -> assertThat(jdbc.queryForObject("select count(*) from invitation_tokens where email='new@a.test'", Long.class)).isZero());
    assertThatThrownBy(() -> inTenant(null, () -> member(A, "other@a.test", "STAFF", ADMIN_A)))
        .isInstanceOf(DataAccessException.class);
  }

  @Test
  void auditoria_acepta_eventos_nuevos_con_actor_del_tenant_y_es_append_only() {
    setup();
    UUID invitation = new UUID(0, 1337);
    inTenant(A, () -> {
      jdbc.update("insert into audit_log (tenant_id,actor_id,occurred_at,resource_type,resource_id,event_type,details) values (?,?,now(),'USER_INVITATION',?,'USER_INVITATION_ISSUED','{\"targetRole\":\"STAFF\"}'::jsonb)", A, ADMIN_A, invitation);
      jdbc.update("insert into audit_log (tenant_id,actor_id,occurred_at,resource_type,resource_id,event_type) values (?,?,now(),'USER',?,'USER_INVITATION_ACCEPTED')", A, ADMIN_A, ADMIN_A);
      assertThat(jdbc.queryForObject("select count(*) from audit_log", Long.class)).isEqualTo(2);
    });
    assertThatThrownBy(() -> inTenant(A, () -> jdbc.update(
        "insert into audit_log (tenant_id,actor_id,occurred_at,resource_type,resource_id,event_type) values (?,?,now(),'USER',?,'USER_INVITATION_ISSUED')", A, ADMIN_A, invitation)))
        .isInstanceOf(DataAccessException.class);
    assertThatThrownBy(() -> inTenant(A, () -> jdbc.update(
        "insert into audit_log (tenant_id,actor_id,occurred_at,resource_type,resource_id,event_type) values (?,?,now(),'USER',?,'USER_ROLE_CHANGED')", A, ADMIN_B, ADMIN_A)))
        .isInstanceOf(DataAccessException.class);
    assertThatThrownBy(() -> inTenant(A, () -> jdbc.update("delete from audit_log where resource_id=?", invitation)))
        .isInstanceOf(DataAccessException.class);
  }

  @Test
  void dos_invitaciones_concurrentes_no_crean_dos_pendientes() throws Exception {
    setup();
    CountDownLatch start = new CountDownLatch(1);
    try (var workers = Executors.newFixedThreadPool(2)) {
      var one = workers.submit(() -> concurrentInsert(start));
      var two = workers.submit(() -> concurrentInsert(start));
      start.countDown();
      assertThat(one.get(20, TimeUnit.SECONDS) + two.get(20, TimeUnit.SECONDS)).isEqualTo(1);
    }
    inTenant(A, () -> assertThat(jdbc.queryForObject(
        "select count(*) from invitation_tokens where email='race@a.test' and revoked_at is null and consumed_at is null", Long.class)).isEqualTo(1));
  }

  private int concurrentInsert(CountDownLatch start) {
    try {
      start.await();
      inTenant(A, () -> member(A, "race@a.test", "STAFF", ADMIN_A));
      return 1;
    } catch (DataAccessException exception) {
      return 0;
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException(exception);
    }
  }

  private void setup() {
    for (String tenant : new String[] {A, B}) {
      jdbc.update("insert into tenant (id,name,slug,vertical) values (?,'HU104',?,'RESTAURANT') on conflict (id) do nothing", tenant, tenant);
    }
    inTenant(A, () -> actor(A, ADMIN_A, "admin@a.test"));
    inTenant(B, () -> actor(B, ADMIN_B, "admin@b.test"));
  }

  private void actor(String tenant, UUID id, String email) {
    jdbc.update("insert into app_user (id,tenant_id,email,password_hash,full_name,role) values (?,?,?,'x','Admin','ADMIN') on conflict (id) do nothing", id, tenant, email);
  }

  private UUID member(String tenant, String email, String role, UUID inviter) {
    UUID id = UUID.randomUUID();
    jdbc.update("insert into invitation_tokens (id,tenant_id,email,token_hash,expires_at,purpose,target_role,invited_by,dispatch_status) values (?,?,?,?,now() + interval '24 hours','MEMBER',?,?,'SEND_REQUESTED')", id, tenant, email, hash(), role, inviter);
    return id;
  }

  private String hash() {
    return UUID.randomUUID().toString().replace("-", "").repeat(2);
  }

  private void inTenant(String tenant, Runnable action) {
    new TransactionTemplate(transactions).executeWithoutResult(status -> {
      if (tenant != null) {
        jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenant);
      }
      action.run();
    });
  }
}
