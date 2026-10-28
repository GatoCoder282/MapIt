package com.mapit.payments;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Tag("integration")
@Testcontainers
class PaymentMigrationUpgradeIntegrationTest {
  @Container
  static final PostgreSQLContainer<?> DATABASE = new PostgreSQLContainer<>("postgres:17-alpine")
      .withDatabaseName("mapit").withUsername("mapit").withPassword("upgrade_test_only");

  @Test
  void upgradesAlreadyAppliedV21WithoutRepairOrLosingLegacyArrival() {
    var config = Flyway.configure().dataSource(DATABASE.getJdbcUrl(), DATABASE.getUsername(), DATABASE.getPassword())
        .locations("classpath:db/migration").placeholders(Map.of("mapitAppDbPassword", "upgrade_runtime_only"));
    config.target("21").load().migrate();
    var jdbc = new JdbcTemplate(new DriverManagerDataSource(DATABASE.getJdbcUrl(), DATABASE.getUsername(), DATABASE.getPassword()));
    UUID venue = UUID.randomUUID(), actor = UUID.randomUUID(), person = UUID.randomUUID(), reservation = UUID.randomUUID();
    jdbc.update("insert into tenant(id,name,slug,status,vertical) values('upgrade-test','Upgrade','upgrade-test','ACTIVE','RESTAURANT')");
    jdbc.update("insert into establishment(id,tenant_id,name,type,slug,timezone) values(?,'upgrade-test','Local','RESTAURANT','venue','UTC')", venue);
    jdbc.update("insert into app_user(id,tenant_id,email,password_hash,full_name,role) values(?,'upgrade-test','upgrade@example.test','unused','Operador','STAFF')", actor);
    jdbc.update("insert into person(id,tenant_id,full_name) values(?,'upgrade-test','Cliente de prueba')", person);
    jdbc.update("insert into reservation(id,tenant_id,establishment_id,person_id,starts_at,ends_at,status) values(?,'upgrade-test',?,?,now(),now()+interval '1 hour','CREATED')", reservation, venue, person);
    jdbc.update("""
        insert into reservation_access(tenant_id,reservation_id,token_hash,created_at,expires_at,checked_in_at,checked_in_by)
        values('upgrade-test',?,repeat('a',64),now(),now()+interval '1 day',timestamp with time zone '2026-10-25 12:00:00+00',?)
        """, reservation, actor);
    assertThat(jdbc.queryForObject("select checksum from flyway_schema_history where version='21'", Integer.class)).isEqualTo(2144903075);

    UUID method = UUID.randomUUID(), payment = UUID.randomUUID(), expired = UUID.randomUUID();
    jdbc.update("""
        insert into merchant_payment_method(id,tenant_id,establishment_id,display_name,country,currency,provider,
          bank_name,account_reference,enabled,created_at,updated_at,created_by,updated_by)
        values(?,'upgrade-test',?,'Mock','BO','USD','MOCK_GATEWAY','Mock','merchant',true,now(),now(),?,?)
        """, method, venue, actor, actor);
    for (UUID id : new UUID[]{payment, expired}) {
      jdbc.update("""
          insert into payment(id,tenant_id,establishment_id,reservation_id,method_id,provider,merchant_reference,
            external_reference,amount,currency,status,created_at,expires_at,request_id)
          values(?,'upgrade-test',?,?,?,'MOCK_GATEWAY','merchant',?,10,'USD',?,now(),now()+interval '1 hour',?)
          """, id, venue, reservation, method, id.toString(), id.equals(expired) ? "EXPIRED" : "PENDING", UUID.randomUUID());
    }
    config.target("26").load().migrate();
    assertThatThrownBy(() -> jdbc.update("update payment set status='CANCELLED' where id=?", payment))
        .isInstanceOf(DataAccessException.class);

    var latest = config.target("latest").load();
    latest.migrate();
    latest.validate();
    assertThat(jdbc.update("update payment set status='CANCELLED' where id=?", payment)).isEqualTo(1);
    assertThat(jdbc.queryForObject("select status from payment where id=?", String.class, payment)).isEqualTo("CANCELLED");
    assertThat(jdbc.queryForObject("select status from payment where id=?", String.class, expired)).isEqualTo("EXPIRED");
    assertThat(jdbc.queryForObject("select amount from payment where id=?", java.math.BigDecimal.class, payment))
        .isEqualByComparingTo("10");
    assertThat(jdbc.queryForObject("select count(*) from payment_request_alias where tenant_id='upgrade-test'", Integer.class)).isEqualTo(2);
    assertThatThrownBy(() -> jdbc.update("update payment set status='UNKNOWN' where id=?", payment))
        .isInstanceOf(DataAccessException.class);
    assertThat(jdbc.queryForObject("select checked_in_by from reservation where id=?", UUID.class, reservation)).isEqualTo(actor);
    assertThat(jdbc.queryForObject("select extract(epoch from checked_in_at)::bigint from reservation where id=?", Long.class, reservation))
        .isEqualTo(Instant.parse("2026-10-25T12:00:00Z").getEpochSecond());
    assertThat(jdbc.queryForObject("select establishment_id from reservation_access where reservation_id=?", UUID.class, reservation)).isEqualTo(venue);
    assertThat(jdbc.queryForObject("select token_hash from reservation_access where reservation_id=?", String.class, reservation)).isEqualTo("a".repeat(64));
    assertThat(jdbc.queryForObject("select checksum from flyway_schema_history where version='21'", Integer.class)).isEqualTo(2144903075);
    assertThat(jdbc.queryForObject("select count(*) from information_schema.columns where table_name='realtime_event_outbox' and column_name='reservation_id'", Integer.class)).isEqualTo(1);
  }
}
