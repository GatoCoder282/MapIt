package com.mapit.demo;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Verifica que la tabla nueva queda aislada por tenant mediante PostgreSQL RLS. */
@Tag("integration")
@SpringBootTest
@Testcontainers
class DemoItemIsolationIntegrationTest {

  @Container
  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16-alpine")
          .withDatabaseName("mapit")
          .withUsername("mapit")
          .withPassword("test_password");

  @Autowired private JdbcTemplate jdbcTemplate;

  @Autowired private TransactionTemplate transactionTemplate;

  @DynamicPropertySource
  static void databaseProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
  }

  @BeforeEach
  void prepareRowsAndNonPrivilegedRole() {
    jdbcTemplate.execute(
        "do $$ begin "
            + "if not exists (select from pg_roles where rolname = 'mapit_rls_test') then "
            + "create role mapit_rls_test nologin nosuperuser; "
            + "end if; end $$");
    jdbcTemplate.execute("grant usage on schema public to mapit_rls_test");
    jdbcTemplate.execute("grant select on demo_item to mapit_rls_test");
    jdbcTemplate.update(
        "insert into tenant (id, name, slug, status) values (?, ?, ?, ?) on conflict (id) do nothing",
        "other",
        "Otra empresa",
        "other",
        "ACTIVE");
    jdbcTemplate.update("delete from demo_item");
    jdbcTemplate.update(
        "insert into demo_item (tenant_id, name, description) values (?, ?, ?)",
        "demo",
        "Visible",
        "Fila del tenant demo");
    jdbcTemplate.update(
        "insert into demo_item (tenant_id, name, description) values (?, ?, ?)",
        "other",
        "Invisible",
        "Fila de otro tenant");
  }

  @Test
  void solo_expone_las_filas_del_tenant_actual() {
    transactionTemplate.executeWithoutResult(
        status -> {
          jdbcTemplate.execute("set local role mapit_rls_test");
          jdbcTemplate.queryForObject(
              "select set_config('app.tenant_id', ?, true)", String.class, "demo");

          assertThat(jdbcTemplate.queryForObject("select count(*) from demo_item", Long.class))
              .isEqualTo(1L);
          assertThat(
                  jdbcTemplate.queryForObject(
                      "select count(*) from demo_item where tenant_id = 'other'", Long.class))
              .isZero();
        });
  }
}
