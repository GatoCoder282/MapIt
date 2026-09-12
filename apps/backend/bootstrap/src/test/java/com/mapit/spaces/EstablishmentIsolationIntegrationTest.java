package com.mapit.spaces;

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

/**
 * Verifica que {@code establishment} queda aislada por tenant mediante PostgreSQL RLS (CA-9).
 *
 * <p>Las consultas se ejecutan bajo el rol {@code mapit_rls_test}, sin privilegios, porque el
 * usuario de la aplicación es superusuario y los superusuarios <strong>ignoran la RLS</strong>.
 * Probar con el usuario normal daría un falso verde: se verían todas las filas y el test no
 * demostraría nada.
 */
@Tag("integration")
@SpringBootTest
@Testcontainers
class EstablishmentIsolationIntegrationTest {

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
  void prepararFilasYRolSinPrivilegios() {
    jdbcTemplate.execute(
        "do $$ begin "
            + "if not exists (select from pg_roles where rolname = 'mapit_rls_test') then "
            + "create role mapit_rls_test nologin nosuperuser; "
            + "end if; end $$");
    jdbcTemplate.execute("grant usage on schema public to mapit_rls_test");
    jdbcTemplate.execute("grant select on establishment to mapit_rls_test");

    jdbcTemplate.update(
        "insert into tenant (id, name, slug, status) values (?, ?, ?, ?) on conflict (id) do nothing",
        "other",
        "Otra empresa",
        "other",
        "ACTIVE");

    jdbcTemplate.update("delete from establishment");
    jdbcTemplate.update(
        "insert into establishment (tenant_id, name, type, slug) values (?, ?, ?, ?)",
        "demo",
        "Visible",
        "RESTAURANT",
        "visible");
    jdbcTemplate.update(
        "insert into establishment (tenant_id, name, type, slug) values (?, ?, ?, ?)",
        "other",
        "Invisible",
        "HOTEL",
        "invisible");
  }

  @Test
  void solo_expone_los_establecimientos_del_tenant_actual() {
    transactionTemplate.executeWithoutResult(
        status -> {
          jdbcTemplate.execute("set local role mapit_rls_test");
          jdbcTemplate.queryForObject(
              "select set_config('app.tenant_id', ?, true)", String.class, "demo");

          // Sin filtro por tenant_id en el SQL: quien filtra es la RLS.
          assertThat(jdbcTemplate.queryForObject("select count(*) from establishment", Long.class))
              .isEqualTo(1L);
          assertThat(
                  jdbcTemplate.queryForObject(
                      "select count(*) from establishment where tenant_id = 'other'", Long.class))
              .isZero();
        });
  }

  @Test
  void sin_tenant_en_la_sesion_no_devuelve_ninguna_fila() {
    transactionTemplate.executeWithoutResult(
        status -> {
          jdbcTemplate.execute("set local role mapit_rls_test");

          // Falla cerrado: sin contexto de tenant, cero filas (no todas).
          assertThat(jdbcTemplate.queryForObject("select count(*) from establishment", Long.class))
              .isZero();
        });
  }

  @Test
  void el_slug_puede_repetirse_entre_tenants_distintos() {
    transactionTemplate.executeWithoutResult(
        status -> {
          jdbcTemplate.queryForObject(
              "select set_config('app.tenant_id', ?, true)", String.class, "other");

          // El índice único es (tenant_id, slug): 'visible' ya existe en el tenant demo,
          // así que si la unicidad fuese global esta inserción fallaría.
          jdbcTemplate.update(
              "insert into establishment (tenant_id, name, type, slug) values (?, ?, ?, ?)",
              "other",
              "Mismo slug, otra empresa",
              "EVENT_HALL",
              "visible");

          assertThat(
                  jdbcTemplate.queryForObject(
                      "select count(*) from establishment where slug = 'visible'", Long.class))
              .isEqualTo(2L);
        });
  }
}
