package com.mapit.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.sql.Timestamp;
import java.time.Instant;
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
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.mapit.shared.realtime.RealtimeEvent;
import com.mapit.shared.realtime.RealtimeEventPublisher;
import com.mapit.shared.realtime.SpaceElementState;
import com.mapit.shared.tenant.TenantId;

/** Verifica RLS y fallo cerrado de la tabla durable de eventos. */
@Tag("integration")
@SpringBootTest
@Testcontainers
class RealtimeEventOutboxIsolationIntegrationTest {

  @Container
  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16-alpine")
          .withDatabaseName("mapit")
          .withUsername("mapit")
          .withPassword("test_password");

  @Autowired private JdbcTemplate jdbc;
  @Autowired private TransactionTemplate transactions;
  @Autowired private RealtimeEventPublisher publisher;

  @DynamicPropertySource
  static void databaseProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.flyway.url", POSTGRES::getJdbcUrl);
    registry.add("spring.flyway.user", POSTGRES::getUsername);
    registry.add("spring.flyway.password", POSTGRES::getPassword);
    registry.add("spring.flyway.placeholders.mapitAppDbPassword", () -> "test_app_password");
    registry.add("mapit.realtime.outbox.poll-interval-ms", () -> "3600000");
    registry.add("mapit.realtime.outbox.cleanup-interval-ms", () -> "3600000");
  }

  @BeforeEach
  void prepareRowsAndRole() {
    jdbc.execute(
        "do $$ begin "
            + "if not exists (select from pg_roles where rolname = 'mapit_rls_test') then "
            + "create role mapit_rls_test nologin nosuperuser; "
            + "end if; end $$");
    jdbc.execute("grant usage on schema public to mapit_rls_test");
    jdbc.execute("grant select, insert, update, delete on realtime_event_outbox to mapit_rls_test");
    jdbc.update(
        "insert into tenant (id, name, slug, status, vertical) values (?, ?, ?, ?, ?) on conflict (id) do nothing",
        "other",
        "Otra empresa",
        "other",
        "ACTIVE",
        "RESTAURANT");
    jdbc.update("delete from realtime_event_outbox");
    insert("demo");
    insert("other");
  }

  @Test
  void cada_tenant_solo_lee_sus_eventos_y_sin_contexto_no_lee_nada() {
    transactions.executeWithoutResult(
        status -> {
          jdbc.execute("set local role mapit_rls_test");
          setTenant("demo");
          assertThat(jdbc.queryForObject("select count(*) from realtime_event_outbox", Long.class))
              .isOne();
          assertThat(
                  jdbc.queryForObject(
                      "select count(*) from realtime_event_outbox where tenant_id = 'other'",
                      Long.class))
              .isZero();
        });

    transactions.executeWithoutResult(
        status -> {
          jdbc.execute("set local role mapit_rls_test");
          assertThat(jdbc.queryForObject("select count(*) from realtime_event_outbox", Long.class))
              .isZero();
        });
  }

  @Test
  void RLS_impide_insertar_un_evento_de_otro_tenant() {
    UUID eventId = UUID.randomUUID();
    assertThatThrownBy(
            () ->
                transactions.executeWithoutResult(
                    status -> {
                      jdbc.execute("set local role mapit_rls_test");
                      setTenant("demo");
                      jdbc.update(
                          """
                          insert into realtime_event_outbox
                            (event_id, tenant_id, event_type, schema_version, occurred_at,
                             establishment_id, aggregate_version, payload)
                          values (?, 'other', 'space-element.state.changed.v1', 1, ?, ?, 1, '{}'::jsonb)
                          """,
                          eventId,
                          Timestamp.from(Instant.now()),
                          UUID.randomUUID());
                    }))
        .isInstanceOf(DataAccessException.class);
  }

  @Test
  void publisher_escribe_el_envelope_sin_tenant_dentro_de_la_transaccion() {
    UUID eventId = UUID.randomUUID();
    UUID establishmentId = UUID.randomUUID();
    UUID elementId = UUID.randomUUID();
    RealtimeEvent event =
        RealtimeEvent.spaceElementStateChanged(
            eventId,
            Instant.parse("2026-09-17T18:00:00Z"),
            TenantId.of("demo"),
            establishmentId,
            java.util.Optional.empty(),
            elementId,
            java.util.Optional.of(SpaceElementState.AVAILABLE),
            SpaceElementState.OCCUPIED,
            2);

    transactions.executeWithoutResult(
        status -> {
          setTenant("demo");
          publisher.publish(event);
        });

    String payload =
        jdbc.queryForObject(
            "select payload::text from realtime_event_outbox where event_id = ?",
            String.class,
            eventId);
    assertThat(payload).contains("space-element.state.changed.v1");
    assertThat(payload).contains(elementId.toString());
    assertThat(payload).doesNotContain("tenantId");
  }

  private void insert(String tenantId) {
    jdbc.update(
        """
        insert into realtime_event_outbox
          (event_id, tenant_id, event_type, schema_version, occurred_at,
           establishment_id, aggregate_version, payload)
        values (?, ?, 'space-element.state.changed.v1', 1, ?, ?, 1, '{}'::jsonb)
        """,
        UUID.randomUUID(),
        tenantId,
        Timestamp.from(Instant.now()),
        UUID.randomUUID());
  }

  private void setTenant(String tenantId) {
    jdbc.queryForObject("select set_config('app.tenant_id', ?, true)", String.class, tenantId);
  }
}
