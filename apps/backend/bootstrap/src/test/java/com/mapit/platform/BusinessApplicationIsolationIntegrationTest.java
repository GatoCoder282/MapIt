package com.mapit.platform;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;

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

/** MAP-261: la migración V34 aísla las solicitudes previas al alta con el rol runtime. */
@Tag("integration")
@SpringBootTest
@Testcontainers
class BusinessApplicationIsolationIntegrationTest {

  @Container
  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:17-alpine")
          .withDatabaseName("mapit")
          .withUsername("mapit")
          .withPassword("test_password");

  @DynamicPropertySource
  static void databaseProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", () -> "mapit_app");
    registry.add("spring.datasource.password", () -> "test_app_password");
    registry.add("spring.flyway.url", POSTGRES::getJdbcUrl);
    registry.add("spring.flyway.user", POSTGRES::getUsername);
    registry.add("spring.flyway.password", POSTGRES::getPassword);
    registry.add("spring.flyway.placeholders.mapitAppDbPassword", () -> "test_app_password");
    registry.add("mapit.super-admin.password", () -> "");
  }

  @Autowired private JdbcTemplate jdbc;
  @Autowired private PlatformTransactionManager transactions;

  @Test
  void solo_platform_puede_crear_y_leer_solicitudes_pendientes() {
    UUID id = UUID.randomUUID();
    inTransaction("platform", () -> assertThat(insert(id, "platform", "ana@example.com", "Hotel Norte"))
        .isEqualTo(1));

    inTransaction("platform", () -> {
      var row = jdbc.queryForMap("select status, approved_tenant_id from business_application where id = ?", id);
      assertThat(row.get("status")).isEqualTo("PENDING");
      assertThat(row.get("approved_tenant_id")).isNull();
    });
    inTransaction(null, () -> assertThat(count(id)).isZero());
    inTransaction("demo", () -> {
      assertThat(count(id)).isZero();
      assertThat(jdbc.update("delete from business_application where id = ?", id)).isZero();
      assertThat(jdbc.update("update business_application set business_name = 'Intruso' where id = ?", id))
          .isZero();
    });
    assertThatThrownBy(() -> inTransaction("demo", () ->
        insert(UUID.randomUUID(), "platform", "intruso@example.com", "Hotel Intruso")))
        .isInstanceOf(DataAccessException.class);
    inTransaction("platform", () -> assertThat(count(id)).isEqualTo(1));
  }

  @Test
  void la_base_rechaza_duplicados_pendientes_aun_con_diferente_capitalizacion() {
    inTransaction("platform", () -> insert(UUID.randomUUID(), "platform", "doble@example.com", "Hotel Norte"));

    assertThatThrownBy(() -> inTransaction("platform", () ->
        insert(UUID.randomUUID(), "platform", "doble@example.com", "  hOTEL nORTE  ")))
        .isInstanceOf(DataAccessException.class);
  }

  private int insert(UUID id, String tenant, String email, String businessName) {
    return jdbc.update(
        """
        insert into business_application
          (id, tenant_id, business_name, vertical, location, contact_name, contact_email,
           verification_token_hash, verification_expires_at)
        values (?, ?, ?, 'HOTEL', 'Cochabamba', 'Ana Pérez', ?, ?, now() + interval '1 day')
        """,
        id, tenant, businessName, email, id.toString().replace("-", "").repeat(2));
  }

  private Long count(UUID id) {
    return jdbc.queryForObject("select count(*) from business_application where id = ?", Long.class, id);
  }

  private void inTransaction(String tenant, Runnable body) {
    new TransactionTemplate(transactions).executeWithoutResult(status -> {
      if (tenant != null) {
        jdbc.queryForObject("select set_config('app.tenant_id', ?, true)", String.class, tenant);
      }
      body.run();
    });
  }
}
