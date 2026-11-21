package com.mapit.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.mapit.identity.domain.AdminRecoveryAuthorization;
import com.mapit.identity.domain.AdminRecoveryAuthorizationRepository;
import com.mapit.shared.audit.AuditEvent;
import com.mapit.shared.audit.AuditEventRecorder;
import com.mapit.shared.audit.AuditEventType;
import com.mapit.shared.audit.AuditResourceType;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

@Tag("integration")
@SpringBootTest
@Testcontainers
class AdminRecoveryAuthorizationIntegrationTest {
  @Container
  private static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine")
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

  @Autowired JdbcTemplate jdbc;
  @Autowired PlatformTransactionManager transactions;
  @Autowired AdminRecoveryAuthorizationRepository repository;
  @Autowired AuditEventRecorder audit;

  @Test
  void solicitud_de_platform_respeta_rls_fk_aprobacion_y_revocacion() {
    String tenant = "recovery-" + UUID.randomUUID().toString().substring(0, 8);
    UUID target = UUID.randomUUID();
    UUID operator = UUID.randomUUID();
    UUID approver = UUID.randomUUID();
    UUID requestId = UUID.randomUUID();
    Instant now = Instant.now();

    tx(() -> {
      jdbc.update("insert into tenant(id,name,slug,status,vertical) values (?,?,?,'ACTIVE','RESTAURANT')", tenant, tenant, tenant);
      scoped(tenant);
      jdbc.update("insert into app_user(id,tenant_id,email,password_hash,full_name,role,active) values (?,?,?,?,?,'ADMIN',false)",
          target, tenant, "admin@" + tenant + ".test", "!", "Admin");
      scoped("platform");
      jdbc.update("insert into app_user(id,tenant_id,email,password_hash,full_name,role) values (?,?,?,?,?,'SUPER_ADMIN')",
          operator, "platform", operator + "@test.local", "!", "Operator");
      jdbc.update("insert into app_user(id,tenant_id,email,password_hash,full_name,role) values (?,?,?,?,?,'SUPER_ADMIN')",
          approver, "platform", approver + "@test.local", "!", "Approver");
    });

    var request = new AdminRecoveryAuthorization(requestId, TenantId.of(tenant), tenant,
        target, operator, "MAP-238", "Sin ADMIN activo", now.minusSeconds(10), now.plusSeconds(300));
    tx(() -> repository.createPending(request));
    UUID rolledBackEvent = UUID.randomUUID();
    assertThatThrownBy(() -> tx(() -> {
      audit.record(new AuditEvent(rolledBackEvent, TenantId.of("platform"), operator, now,
          AuditResourceType.USER, target, AuditEventType.USER_RECOVERED,
          java.util.Map.of("targetTenantId", tenant, "ticket", "MAP-238", "reason", "Ensayo")));
      throw new IllegalStateException("Fallo simulado después de auditar");
    })).isInstanceOf(IllegalStateException.class);
    tx(() -> {
      scoped("platform");
      assertThat(jdbc.queryForObject("select count(*) from audit_log where id=?", Long.class,
          rolledBackEvent)).isZero();
    });
    tx(() -> assertThat(jdbc.queryForObject(
        "select count(*) from admin_recovery_authorization", Long.class)).isZero());
    tx(() -> {
      assertThat(repository.approve(requestId, operator, approver, now)).isTrue();
      assertThat(repository.approve(requestId, operator, approver, now)).isFalse();
      assertThat(repository.findUsable(requestId, now)).get()
          .satisfies(approved -> {
            assertThat(approved.request().id()).isEqualTo(requestId);
            assertThat(approved.approverId()).isEqualTo(approver);
          });
      assertThat(repository.revoke(requestId, now)).isTrue();
      assertThat(repository.findUsable(requestId, now)).isEmpty();
    });
    tx(() -> {
      scoped(tenant);
      assertThat(jdbc.queryForObject("select count(*) from admin_recovery_authorization", Long.class)).isZero();
      assertThat(jdbc.queryForObject("select active from app_user where tenant_id=? and id=?",
          Boolean.class, tenant, target)).isFalse();
    });
    assertThatThrownBy(() -> tx(() -> {
      scoped("platform");
      jdbc.update("update admin_recovery_authorization set target_user_id=? where id=?",
          UUID.randomUUID(), requestId);
    })).hasRootCauseInstanceOf(java.sql.SQLException.class);
    assertThatThrownBy(() -> tx(() -> repository.createPending(new AdminRecoveryAuthorization(
        UUID.randomUUID(), TenantId.of(tenant), tenant, UUID.randomUUID(), operator,
        "MAP-238", "Sin ADMIN activo", now, now.plusSeconds(300)))))
        .hasRootCauseInstanceOf(IllegalStateException.class);

    UUID concurrentId = UUID.randomUUID();
    tx(() -> repository.createPending(new AdminRecoveryAuthorization(concurrentId,
        TenantId.of(tenant), tenant, target, operator, "MAP-238", "Sin ADMIN activo",
        now.minusSeconds(10), now.plusSeconds(300))));
    var start = new CountDownLatch(1);
    try (var workers = Executors.newFixedThreadPool(2)) {
      var first = workers.submit(() -> {
        start.await();
        return new TransactionTemplate(transactions).execute(status ->
            repository.approve(concurrentId, operator, approver, now));
      });
      var second = workers.submit(() -> {
        start.await();
        return new TransactionTemplate(transactions).execute(status ->
            repository.approve(concurrentId, operator, approver, now));
      });
      start.countDown();
      assertThat(first.get(10, TimeUnit.SECONDS) ^ second.get(10, TimeUnit.SECONDS)).isTrue();
    } catch (Exception failure) {
      throw new AssertionError("No se pudo verificar la carrera de aprobación", failure);
    }
  }

  private void tx(Runnable work) {
    new TransactionTemplate(transactions).executeWithoutResult(status -> work.run());
  }

  private void scoped(String tenant) {
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenant);
  }
}
