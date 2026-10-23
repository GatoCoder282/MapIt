package com.mapit.operations;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
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

import com.mapit.operations.domain.audit.AuditLogRepository;
import com.mapit.shared.audit.AuditEvent;
import com.mapit.shared.audit.AuditEventRecorder;
import com.mapit.shared.audit.AuditEventType;
import com.mapit.shared.audit.AuditResourceType;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

/** MAP-222: persistencia append-only y aislamiento real de la bitácora. */
@Tag("integration")
@SpringBootTest
@Testcontainers
class AuditLogPersistenceIntegrationTest {

  private static final String APP_PASSWORD = "audit_app_password";
  private static final String TENANT_A = "audit-map222-a";
  private static final String TENANT_B = "audit-map222-b";
  private static final UUID ACTOR_A =
      UUID.fromString("22200000-0000-0000-0000-000000000001");
  private static final UUID ACTOR_B =
      UUID.fromString("22200000-0000-0000-0000-000000000002");

  @Container
  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16-alpine")
          .withDatabaseName("mapit")
          .withUsername("mapit")
          .withPassword("test_password");

  @DynamicPropertySource
  static void databaseProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", () -> "mapit_app");
    registry.add("spring.datasource.password", () -> APP_PASSWORD);
    registry.add("spring.flyway.url", POSTGRES::getJdbcUrl);
    registry.add("spring.flyway.user", POSTGRES::getUsername);
    registry.add("spring.flyway.password", POSTGRES::getPassword);
    registry.add("spring.flyway.placeholders.mapitAppDbPassword", () -> APP_PASSWORD);
    registry.add("mapit.super-admin.password", () -> "");
    registry.add("mapit.unleash.enabled", () -> "false");
    registry.add("mapit.realtime.outbox.poll-interval-ms", () -> "3600000");
  }

  @Autowired private JdbcTemplate jdbc;
  @Autowired private PlatformTransactionManager transactions;
  @Autowired private AuditEventRecorder recorder;
  @Autowired private AuditLogRepository repository;

  @BeforeEach
  void prepareTenantsAndActors() {
    jdbc.update(
        """
        insert into tenant (id, name, slug, status, vertical)
        values (?, 'Auditoría A', ?, 'ACTIVE', 'RESTAURANT')
        on conflict (id) do nothing
        """,
        TENANT_A,
        TENANT_A);
    jdbc.update(
        """
        insert into tenant (id, name, slug, status, vertical)
        values (?, 'Auditoría B', ?, 'ACTIVE', 'RESTAURANT')
        on conflict (id) do nothing
        """,
        TENANT_B,
        TENANT_B);
    inTenant(
        TENANT_A,
        () -> insertActor(ACTOR_A, TENANT_A, "admin-a@audit.test"));
    inTenant(
        TENANT_B,
        () -> insertActor(ACTOR_B, TENANT_B, "admin-b@audit.test"));
  }

  @Test
  void persiste_y_recupera_una_entrada_inmutable_del_tenant() {
    AuditEvent event = reservationCreated(TENANT_A, ACTOR_A);

    inTenant(
        TENANT_A,
        () -> {
          recorder.record(event);
          assertThat(repository.findById(TenantId.of(TENANT_A), event.eventId()))
              .get()
              .satisfies(
                  saved -> {
                    assertThat(saved.actorId()).isEqualTo(ACTOR_A);
                    assertThat(saved.resourceId()).isEqualTo(event.resourceId());
                    assertThat(saved.eventType()).isEqualTo(AuditEventType.RESERVATION_CREATED);
                    assertThat(saved.details())
                        .containsExactlyInAnyOrderEntriesOf(event.details());
                  });
        });
  }

  @Test
  void rls_oculta_los_eventos_de_otro_tenant_y_falla_cerrado_sin_contexto() {
    AuditEvent eventA = reservationCreated(TENANT_A, ACTOR_A);
    AuditEvent eventB = reservationCreated(TENANT_B, ACTOR_B);
    inTenant(TENANT_A, () -> recorder.record(eventA));
    inTenant(TENANT_B, () -> recorder.record(eventB));

    inTenant(
        TENANT_A,
        () -> {
          assertThat(repository.findById(TenantId.of(TENANT_A), eventA.eventId())).isPresent();
          assertThat(repository.findById(TenantId.of(TENANT_A), eventB.eventId())).isEmpty();
        });
    inTenant(
        TENANT_B,
        () ->
            assertThat(repository.findById(TenantId.of(TENANT_B), eventB.eventId()))
                .isPresent());
    inTenant(null, () -> assertThat(auditCount()).isZero());
  }

  @Test
  void el_rol_runtime_no_puede_actualizar_ni_borrar_la_bitacora() {
    AuditEvent event = reservationCreated(TENANT_A, ACTOR_A);
    inTenant(TENANT_A, () -> recorder.record(event));

    assertThatThrownBy(
            () ->
                inTenant(
                    TENANT_A,
                    () ->
                        jdbc.update(
                            "update audit_log set occurred_at = now() where id = ?",
                            event.eventId())))
        .isInstanceOf(DataAccessException.class);
    assertThatThrownBy(
            () ->
                inTenant(
                    TENANT_A,
                    () -> jdbc.update("delete from audit_log where id = ?", event.eventId())))
        .isInstanceOf(DataAccessException.class);

    inTenant(
        TENANT_A,
        () ->
            assertThat(repository.findById(TenantId.of(TENANT_A), event.eventId())).isPresent());
  }

  @Test
  void rechaza_registrar_fuera_de_una_transaccion() {
    assertThatThrownBy(() -> recorder.record(reservationCreated(TENANT_A, ACTOR_A)))
        .isInstanceOf(DataAccessException.class)
        .hasMessageContaining("transacción activa");
  }

  @Test
  void la_clave_compuesta_rechaza_un_actor_de_otro_tenant() {
    AuditEvent wrongActor = reservationCreated(TENANT_A, ACTOR_B);

    assertThatThrownBy(() -> inTenant(TENANT_A, () -> recorder.record(wrongActor)))
        .isInstanceOf(DataAccessException.class);
  }

  private void insertActor(UUID id, String tenantId, String email) {
    jdbc.update(
        """
        insert into app_user (id, tenant_id, email, password_hash, full_name, role)
        values (?, ?, ?, 'hash-no-secreto', 'Admin auditoría', 'ADMIN')
        on conflict (id) do nothing
        """,
        id,
        tenantId,
        email);
  }

  private AuditEvent reservationCreated(String tenantId, UUID actorId) {
    return new AuditEvent(
        UUID.randomUUID(),
        TenantId.of(tenantId),
        actorId,
        Instant.parse("2026-10-22T18:00:00Z"),
        AuditResourceType.RESERVATION,
        UUID.randomUUID(),
        AuditEventType.RESERVATION_CREATED,
        Map.of("status", "PENDING", "establishmentId", UUID.randomUUID().toString()));
  }

  private long auditCount() {
    return jdbc.queryForObject("select count(*) from audit_log", Long.class);
  }

  private void inTenant(String tenantId, Runnable body) {
    new TransactionTemplate(transactions)
        .executeWithoutResult(
            status -> {
              if (tenantId != null) {
                jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenantId);
              }
              body.run();
            });
  }
}
