package com.mapit.payments;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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

/** V28 se verifica solo en PostgreSQL efímero, incluyendo datos legacy sin enlace textual. */
@Tag("integration")
@Testcontainers
class MockPaymentProjectionMigrationIntegrationTest {
  @Container
  static final PostgreSQLContainer<?> DATABASE = new PostgreSQLContainer<>("postgres:17-alpine")
      .withDatabaseName("mapit").withUsername("mapit").withPassword("projection_test_only");

  @Test
  void backfills_only_matching_configuration_and_policy_and_enforces_composite_link() {
    var configuration = Flyway.configure().dataSource(DATABASE.getJdbcUrl(), DATABASE.getUsername(), DATABASE.getPassword())
        .locations("classpath:db/migration").placeholders(Map.of("mapitAppDbPassword", "projection_runtime_only"));
    configuration.target("27").load().migrate();
    JdbcTemplate jdbc = new JdbcTemplate(new DriverManagerDataSource(
        DATABASE.getJdbcUrl(), DATABASE.getUsername(), DATABASE.getPassword()));

    UUID establishment = UUID.randomUUID(), missingPolicyEstablishment = UUID.randomUUID(), actor = UUID.randomUUID();
    UUID otherEstablishment = UUID.randomUUID(), otherActor = UUID.randomUUID();
    UUID configurationId = UUID.randomUUID(), missingPolicyConfigurationId = UUID.randomUUID();
    UUID otherConfigurationId = UUID.randomUUID();
    jdbc.update("insert into tenant(id,name,slug,status,vertical) values('projection-test','Projection','projection-test','ACTIVE','RESTAURANT')");
    jdbc.update("insert into tenant(id,name,slug,status,vertical) values('projection-other','Other','projection-other','ACTIVE','RESTAURANT')");
    jdbc.update("insert into app_user(id,tenant_id,email,password_hash,full_name,role) values(?,'projection-test','admin@projection.test','unused','Admin','ADMIN')", actor);
    jdbc.update("insert into app_user(id,tenant_id,email,password_hash,full_name,role) values(?,'projection-other','admin@other.test','unused','Admin','ADMIN')", otherActor);
    jdbc.update("insert into establishment(id,tenant_id,name,type,slug) values(?,'projection-test','Local','RESTAURANT','venue')", establishment);
    jdbc.update("insert into establishment(id,tenant_id,name,type,slug) values(?,'projection-test','Other','RESTAURANT','other')", missingPolicyEstablishment);
    jdbc.update("insert into establishment(id,tenant_id,name,type,slug) values(?,'projection-other','Local','RESTAURANT','venue')", otherEstablishment);
    insertConfiguration(jdbc, configurationId, establishment, actor);
    insertConfiguration(jdbc, missingPolicyConfigurationId, missingPolicyEstablishment, actor);
    jdbc.update("insert into mock_qr_configuration(id,tenant_id,establishment_id,country,bank_name,account_holder_name,account_reference,enabled,simulation_token,created_at,updated_at,created_by,updated_by) values(?,'projection-other',?,'BO','Banco de prueba','Titular de prueba','cuenta-123',true,gen_random_uuid(),now(),now(),?,?)",
        otherConfigurationId, otherEstablishment, otherActor, otherActor);
    jdbc.update("insert into payment_policy(id,tenant_id,establishment_id,enabled,currency,deposit_amount,payment_window_minutes,updated_at,updated_by) values(?,'projection-test',?,false,'BOB',10,30,now(),?)",
        UUID.randomUUID(), establishment, actor);
    jdbc.update("insert into payment_policy(id,tenant_id,establishment_id,enabled,currency,deposit_amount,payment_window_minutes,updated_at,updated_by) values(?,'projection-other',?,false,'USD',10,30,now(),?)",
        UUID.randomUUID(), otherEstablishment, otherActor);
    UUID legacyMethodId = UUID.randomUUID();
    jdbc.update("""
        insert into merchant_payment_method(id,tenant_id,establishment_id,display_name,country,currency,provider,
          bank_name,account_reference,enabled,created_at,updated_at,created_by,updated_by,account_holder_name)
        values(?,'projection-test',?,'QR de prueba','BO','BOB','MOCK_GATEWAY','Banco de prueba','cuenta-123',true,now(),now(),?,?,?)
        """, legacyMethodId, establishment, actor, actor, "Titular de prueba");

    jdbc.execute("create role projection_migrator login password 'projection_migrator_only' nosuperuser nobypassrls");
    jdbc.execute("grant usage, create on schema public to projection_migrator");
    jdbc.execute("grant select on tenant, payment_policy to projection_migrator");
    jdbc.execute("alter table flyway_schema_history owner to projection_migrator");
    jdbc.execute("alter table mock_qr_configuration owner to projection_migrator");
    jdbc.execute("alter table merchant_payment_method owner to projection_migrator");
    assertThat(jdbc.queryForObject("select rolsuper from pg_roles where rolname='projection_migrator'", Boolean.class)).isFalse();
    assertThat(jdbc.queryForObject("select rolbypassrls from pg_roles where rolname='projection_migrator'", Boolean.class)).isFalse();

    var migrator = Flyway.configure()
        .dataSource(DATABASE.getJdbcUrl(), "projection_migrator", "projection_migrator_only")
        .locations("classpath:db/migration").placeholders(Map.of("mapitAppDbPassword", "projection_runtime_only"))
        .target("28").load();
    migrator.migrate();
    migrator.validate();

    assertThat(jdbc.queryForObject("select count(*) from merchant_payment_method where tenant_id='projection-test' and mock_qr_configuration_id=? and superseded_at is null",
        Integer.class, configurationId)).isEqualTo(1);
    assertThat(jdbc.queryForObject("select count(*) from merchant_payment_method where tenant_id='projection-other' and mock_qr_configuration_id=? and superseded_at is null",
        Integer.class, otherConfigurationId)).isEqualTo(1);
    assertThat(jdbc.queryForObject("select currency from merchant_payment_method where tenant_id='projection-test' and mock_qr_configuration_id=?",
        String.class, configurationId)).isEqualTo("BOB");
    assertThat(jdbc.queryForObject("select enabled from merchant_payment_method where tenant_id='projection-test' and mock_qr_configuration_id=?",
        Boolean.class, configurationId)).isTrue();
    assertThat(jdbc.queryForObject("select mock_qr_configuration_id from merchant_payment_method where id=?",
        UUID.class, legacyMethodId)).isNull();
    assertThat(jdbc.queryForObject("select count(*) from merchant_payment_method where tenant_id='projection-test' and mock_qr_configuration_id=?",
        Integer.class, missingPolicyConfigurationId)).isZero();

    assertThatThrownBy(() -> jdbc.update("""
        insert into merchant_payment_method(id,tenant_id,establishment_id,display_name,country,currency,provider,
          bank_name,account_reference,static_qr_image,enabled,created_at,updated_at,created_by,updated_by,
          account_holder_name,mock_qr_configuration_id)
        select gen_random_uuid(),tenant_id,establishment_id,display_name,country,currency,provider,bank_name,
          account_reference,static_qr_image,enabled,created_at,updated_at,created_by,updated_by,
          account_holder_name,mock_qr_configuration_id
        from merchant_payment_method where mock_qr_configuration_id=? and superseded_at is null
        """, configurationId)).isInstanceOf(DataAccessException.class);

    assertThatThrownBy(() -> jdbc.update("update merchant_payment_method set establishment_id=? where id=?",
        missingPolicyEstablishment, jdbc.queryForObject("select id from merchant_payment_method where mock_qr_configuration_id=?", UUID.class, configurationId)))
        .isInstanceOf(DataAccessException.class);
  }

  private static void insertConfiguration(JdbcTemplate jdbc, UUID id, UUID establishment, UUID actor) {
    jdbc.update("""
        insert into mock_qr_configuration(id,tenant_id,establishment_id,country,bank_name,account_holder_name,
          account_reference,enabled,created_at,updated_at,created_by,updated_by)
        values(?,'projection-test',?,'BO','Banco de prueba','Titular de prueba','cuenta-123',true,now(),now(),?,?)
        """, id, establishment, actor, actor);
  }
}
