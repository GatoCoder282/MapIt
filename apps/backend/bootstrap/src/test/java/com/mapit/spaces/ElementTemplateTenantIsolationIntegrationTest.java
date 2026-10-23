package com.mapit.spaces;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;

import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Verifica que {@code element_template} queda aislada por tenant mediante PostgreSQL RLS
 * (HU-4.02 / MAP-203, MAP-207) — la misma garantía que pisos, sectores y elementos.
 *
 * <p>Tres frentes:
 *
 * <ul>
 *   <li><b>Aislamiento bidireccional:</b> con {@code app.tenant_id = 'tenant-template-a'}
 *       solo se ven las plantillas de ese tenant; al cambiar a {@code 'tenant-template-b'},
 *       solo las de ese otro.
 *   <li><b>Falla cerrado:</b> sin {@code app.tenant_id} en la sesión, la consulta devuelve
 *       0 filas.
 *   <li><b>Constraints de la migración V16:</b> unicidad de nombre por tenant sobre filas
 *       vivas (case-insensitive), longitud de nombre, pareja {@code deleted_by}/{@code
 *       deleted_at} y FK a {@code tenant} que impide orfandad.
 * </ul>
 *
 * <p>Las consultas de aislamiento se ejecutan bajo el rol {@code mapit_rls_test} (sin
 * privilegios): el usuario de la aplicación es superusuario y los superusuarios ignoran la
 * RLS, lo que daría un falso verde. Igual que {@link SpaceElementTenantIsolationIntegrationTest}.
 */
@Tag("integration")
@SpringBootTest
@Testcontainers
class ElementTemplateTenantIsolationIntegrationTest {

  @Container
  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16-alpine")
          .withDatabaseName("mapit")
          .withUsername("mapit")
          .withPassword("test_password");

  private static final String TENANT_A = "tenant-template-a";
  private static final String TENANT_B = "tenant-template-b";

  private static final UUID TEMPLATE_A =
      UUID.fromString("7a000000-0000-0000-0000-000000000001");
  private static final UUID TEMPLATE_B =
      UUID.fromString("7b000000-0000-0000-0000-000000000001");

  @Autowired private JdbcTemplate jdbcTemplate;

  @Autowired private TransactionTemplate transactionTemplate;

  @DynamicPropertySource
  static void databaseProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    // La migración V9 crea el rol mapit_app con esta contraseña (ver MAP-175).
    registry.add("spring.flyway.url", POSTGRES::getJdbcUrl);
    registry.add("spring.flyway.user", POSTGRES::getUsername);
    registry.add("spring.flyway.password", POSTGRES::getPassword);
    registry.add("spring.flyway.placeholders.mapitAppDbPassword", () -> "test_app_password");
  }

  @BeforeEach
  void prepararRolSinPrivilegiosYDatos() {
    jdbcTemplate.execute(
        "do $$ begin "
            + "if not exists (select from pg_roles where rolname = 'mapit_rls_test') then "
            + "create role mapit_rls_test nologin nosuperuser; "
            + "end if; end $$");
    jdbcTemplate.execute("grant usage on schema public to mapit_rls_test");
    jdbcTemplate.execute("grant select on element_template to mapit_rls_test");

    insertarTenantSiNoExiste(TENANT_A, "Tenant Plantillas A", "tenant-template-a");
    insertarTenantSiNoExiste(TENANT_B, "Tenant Plantillas B", "tenant-template-b");

    // Reset solo de las filas de estos tenants para no pisar otras suites del contenedor.
    jdbcTemplate.update(
        "delete from element_template where tenant_id in (?, ?)", TENANT_A, TENANT_B);

    insertarPlantilla(TEMPLATE_A, TENANT_A, "Mesa redonda A", "TABLE");
    insertarPlantilla(TEMPLATE_B, TENANT_B, "Barra central B", "BAR");
  }

  // ===== (a) Aislamiento bidireccional =====

  @Test
  void tenant_a_solo_ve_sus_plantillas() {
    enContexto(
        TENANT_A,
        () -> {
          assertThat(
                  jdbcTemplate.queryForObject(
                      "select count(*) from element_template", Long.class))
              .isEqualTo(1L);
          // Aunque el SQL apunte al id de la plantilla del otro tenant, la RLS lo filtra.
          assertThat(
                  jdbcTemplate.queryForObject(
                      "select count(*) from element_template where id = ?",
                      Long.class,
                      TEMPLATE_B))
              .isZero();
        });
  }

  @Test
  void tenant_b_solo_ve_sus_plantillas() {
    enContexto(
        TENANT_B,
        () -> {
          assertThat(
                  jdbcTemplate.queryForObject(
                      "select count(*) from element_template", Long.class))
              .isEqualTo(1L);
          assertThat(
                  jdbcTemplate.queryForObject(
                      "select count(*) from element_template where tenant_id = ?",
                      Long.class,
                      TENANT_A))
              .isZero();
        });
  }

  // ===== (b) Sin tenant en la sesión: falla cerrado =====

  @Test
  void sin_tenant_en_la_sesion_no_se_ve_ninguna_plantilla() {
    enContextoSinTenant(
        () ->
            assertThat(
                    jdbcTemplate.queryForObject(
                        "select count(*) from element_template", Long.class))
                .isZero());
  }

  // ===== (c) Constraints de la migración V16 =====

  @Test
  void nombre_duplicado_case_insensitive_en_el_mismo_tenant_falla() {
    insertarPlantilla(UUID.randomUUID(), TENANT_A, "Mesa VIP", "TABLE");
    assertThatExceptionOfType(DataIntegrityViolationException.class)
        .as("El índice único (tenant_id, lower(name)) sobre filas vivas debe rechazar el duplicado")
        .isThrownBy(
            () -> insertarPlantilla(UUID.randomUUID(), TENANT_A, "mesa vip", "BAR"));
  }

  @Test
  void mismo_nombre_en_otro_tenant_si_se_permite() {
    insertarPlantilla(UUID.randomUUID(), TENANT_A, "Nombre compartido", "TABLE");
    // No debe lanzar: la unicidad es por tenant.
    insertarPlantilla(UUID.randomUUID(), TENANT_B, "Nombre compartido", "TABLE");
  }

  @Test
  void nombre_duplicado_tras_baja_logica_si_se_permite() {
    UUID original = UUID.randomUUID();
    insertarPlantilla(original, TENANT_A, "Reutilizable", "SEAT");
    jdbcTemplate.update(
        "update element_template set deleted_at = now() where id = ?", original);
    // La baja lógica libera el nombre (índice parcial WHERE deleted_at IS NULL).
    insertarPlantilla(UUID.randomUUID(), TENANT_A, "Reutilizable", "STAGE");
  }

  @Test
  void nombre_vacio_o_largo_falla_por_check() {
    assertThatExceptionOfType(DataIntegrityViolationException.class)
        .isThrownBy(() -> insertarPlantilla(UUID.randomUUID(), TENANT_A, "", "TABLE"));
    assertThatExceptionOfType(DataIntegrityViolationException.class)
        .isThrownBy(
            () ->
                insertarPlantilla(
                    UUID.randomUUID(), TENANT_A, "x".repeat(101), "TABLE"));
  }

  @Test
  void deleted_by_sin_deleted_at_falla_por_check() {
    assertThatExceptionOfType(DataIntegrityViolationException.class)
        .isThrownBy(
            () ->
                jdbcTemplate.update(
                    "insert into element_template (id, tenant_id, name, type, deleted_by) "
                        + "values (?, ?, 'Maliciosa', 'TABLE', ?)",
                    UUID.randomUUID(),
                    TENANT_A,
                    UUID.randomUUID()));
  }

  @Test
  void fk_impide_plantilla_de_tenant_inexistente() {
    assertThatExceptionOfType(DataIntegrityViolationException.class)
        .as("Debe fallar al insertar una plantilla con tenant que no existe")
        .isThrownBy(
            () -> insertarPlantilla(UUID.randomUUID(), "tenant-fantasma", "Huérfana", "TABLE"));
  }

  // ===== Helpers =====

  private void enContexto(String tenantId, Runnable aserciones) {
    transactionTemplate.executeWithoutResult(
        status -> {
          jdbcTemplate.execute("set local role mapit_rls_test");
          jdbcTemplate.queryForObject(
              "select set_config('app.tenant_id', ?, true)", String.class, tenantId);
          aserciones.run();
        });
  }

  private void enContextoSinTenant(Runnable aserciones) {
    transactionTemplate.executeWithoutResult(
        status -> {
          jdbcTemplate.execute("set local role mapit_rls_test");
          aserciones.run();
        });
  }

  private void insertarTenantSiNoExiste(String id, String nombre, String slug) {
    jdbcTemplate.update(
        "insert into tenant (id, name, slug, status, vertical) values (?, ?, ?, ?, ?) "
            + "on conflict (id) do nothing",
        id,
        nombre,
        slug,
        "ACTIVE",
        "RESTAURANT");
  }

  private void insertarPlantilla(UUID id, String tenantId, String nombre, String type) {
    jdbcTemplate.update(
        "insert into element_template (id, tenant_id, name, type) values (?, ?, ?, ?)",
        id,
        tenantId,
        nombre,
        type);
  }
}
