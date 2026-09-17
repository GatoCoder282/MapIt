package com.mapit.platform;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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

/**
 * MAP-175: la aplicación corre con el rol mapit_app (NOSUPERUSER, NOBYPASSRLS)
 * creado por la migración V7, y la RLS muerde de verdad en runtime: fail-closed
 * sin tenant, aislamiento A/B y ninguna conexión del pool hereda el tenant.
 *
 * <p>Flyway sigue migrando con el owner; solo el datasource de la app cambia.
 */
@Tag("integration")
@SpringBootTest
@Testcontainers
class RuntimeRoleIntegrationTest {

  private static final String APP_PASSWORD = "test_app_password";
  private static final String TENANT_DEMO = "demo";
  private static final String TENANT_PLATFORM = "platform";
  private static final String TENANT_ID_SETTING = "app.tenant_id";

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
    // Este test verifica el aislamiento aislado por tenant: el bootstrap del
    // SUPER_ADMIN (que escribe en tenant 'platform') queda desactivado para que
    // la expectativa sobre 'platform' sea exacta y no dependa del entorno.
    registry.add("mapit.super-admin.password", () -> "");
  }

  @Autowired private JdbcTemplate jdbc;
  @Autowired private PlatformTransactionManager transactions;

  @Test
  void la_aplicacion_conecta_con_el_rol_de_runtime_sin_privilegios_extras() {
    assertThat(jdbc.queryForObject("select current_user", String.class)).isEqualTo("mapit_app");
    var rol =
        jdbc.queryForMap(
            "select rolsuper, rolbypassrls, rolcreatedb, rolcreaterole from pg_roles where rolname = ?",
            "mapit_app");
    assertThat(rol.get("rolsuper")).isEqualTo(false);
    assertThat(rol.get("rolbypassrls")).isEqualTo(false);
    assertThat(rol.get("rolcreatedb")).isEqualTo(false);
    assertThat(rol.get("rolcreaterole")).isEqualTo(false);
  }

  @Test
  void sin_tenant_en_la_transaccion_las_tablas_de_negocio_devuelven_cero_filas() {
    assertThat(jdbc.queryForObject("select count(*) from app_user", Long.class)).isZero();
  }

  @Test
  void rls_aisla_por_tenant_y_una_conexion_reutilizada_no_hereda_nada() {
    // Transacción 1: DEMO inserta su usuario y lo lee.
    inTransaction(
        TENANT_DEMO,
        () -> {
          jdbc.update(
              "insert into app_user (tenant_id, email, password_hash, full_name, role) values (?, ?, 'x', 'Operador', 'STAFF')",
              TENANT_DEMO,
              "rls-pool@demo.test");
          assertThat(users(TENANT_DEMO)).isEqualTo(1);
        });

    // Transacción 2 (misma conexión del pool, sin SET LOCAL): fail-closed.
    inTransaction(
        null,
        () -> {
          assertThat(currentTenantId()).isNull();
          assertThat(jdbc.queryForObject("select count(*) from app_user", Long.class)).isZero();
        });

    // Transacción 3: otro tenant no ve al usuario de DEMO.
    inTransaction(
        TENANT_PLATFORM, () -> assertThat(countUsers()).isZero());
  }

  @Test
  void una_escritura_sin_tenant_es_rechazada_por_la_politica() {
    assertThatThrownBy(
            () ->
                inTransaction(
                    null,
                    () ->
                        jdbc.update(
                            "insert into app_user (tenant_id, email, password_hash, full_name, role) values (?, ?, 'x', 'Intruso', 'STAFF')",
                            TENANT_DEMO,
                            "intruso@demo.test")))
        .isInstanceOf(DataAccessException.class);
  }

  private void inTransaction(String tenantId, Runnable body) {
    new TransactionTemplate(transactions)
        .executeWithoutResult(
            status -> {
              if (tenantId != null) {
                jdbc.queryForObject(
                    "select set_config('" + TENANT_ID_SETTING + "', ?, true)", String.class, tenantId);
              }
              body.run();
            });
  }

  /** Cuenta usuarios visibles desde el tenant ya fijado en la transacción. */
  private long countUsers() {
    return jdbc.queryForObject("select count(*) from app_user", Long.class);
  }

  private long users(String ignoredTenant) {
    return countUsers();
  }

  private String currentTenantId() {
    return jdbc.queryForObject(
        "select nullif(current_setting('" + TENANT_ID_SETTING + "', true), '')", String.class);
  }
}
