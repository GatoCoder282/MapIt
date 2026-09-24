package com.mapit.spaces;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;

import java.util.UUID;

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
 * Verifica que {@code space_element} queda aislada por tenant mediante PostgreSQL RLS
 * (HU-2.03 / MAP-113) — la misma garantía que pisos y sectores: ver CA-9 de la spec.
 *
 * <p>Tres frentes:
 *
 * <ul>
 *   <li><b>Aislamiento bidireccional:</b> con {@code app.tenant_id = 'tenant-element-a'}
 *       solo se ven los elementos de ese tenant; al cambiar a {@code 'tenant-element-b'},
 *       solo los de ese otro.
 *   <li><b>Falla cerrado:</b> sin {@code app.tenant_id} en la sesión, la consulta devuelve
 *       0 filas.
 *   <li><b>Sin orfandad:</b> un elemento sin sector vivo correspondiente no se puede
 *       insertar (FK {@code ON DELETE RESTRICT} + FK NOT NULL).
 * </ul>
 *
 * <p>Las consultas se ejecutan bajo el rol {@code mapit_rls_test} (sin privilegios): el
 * usuario de la aplicación es superusuario y los superusuarios ignoran la RLS, lo que
 * daría un falso verde. Igual que {@link FloorSectorTenantIsolationIntegrationTest}.
 */
@Tag("integration")
@SpringBootTest
@Testcontainers
class SpaceElementTenantIsolationIntegrationTest {

  @Container
  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16-alpine")
          .withDatabaseName("mapit")
          .withUsername("mapit")
          .withPassword("test_password");

  private static final String TENANT_A = "tenant-element-a";
  private static final String TENANT_B = "tenant-element-b";

  private static final UUID ESTABLISHMENT_A =
      UUID.fromString("50000000-0000-0000-0000-000000000001");
  private static final UUID ESTABLISHMENT_B =
      UUID.fromString("60000000-0000-0000-0000-000000000001");
  private static final UUID FLOOR_A = UUID.fromString("a5000000-0000-0000-0000-000000000001");
  private static final UUID FLOOR_B = UUID.fromString("b5000000-0000-0000-0000-000000000001");
  private static final UUID SECTOR_A = UUID.fromString("c5000000-0000-0000-0000-000000000001");
  private static final UUID SECTOR_B = UUID.fromString("c6000000-0000-0000-0000-000000000001");
  private static final UUID ELEMENT_A = UUID.fromString("f5000000-0000-0000-0000-000000000001");
  private static final UUID ELEMENT_B = UUID.fromString("f6000000-0000-0000-0000-000000000001");

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
    jdbcTemplate.execute("grant select on space_element to mapit_rls_test");

    insertarTenantSiNoExiste(TENANT_A, "Tenant Elementos A", "tenant-element-a");
    insertarTenantSiNoExiste(TENANT_B, "Tenant Elementos B", "tenant-element-b");

    // Reset solo de las filas de estos tenants para no pisar otras suites del contenedor.
    jdbcTemplate.update(
        "delete from space_element where tenant_id in (?, ?)", TENANT_A, TENANT_B);
    jdbcTemplate.update("delete from sector where tenant_id in (?, ?)", TENANT_A, TENANT_B);
    jdbcTemplate.update("delete from floor where tenant_id in (?, ?)", TENANT_A, TENANT_B);
    jdbcTemplate.update(
        "delete from establishment where tenant_id in (?, ?)", TENANT_A, TENANT_B);

    insertarEstablecimiento(ESTABLISHMENT_A, TENANT_A, "Establecimiento A", "est-elem-a");
    insertarEstablecimiento(ESTABLISHMENT_B, TENANT_B, "Establecimiento B", "est-elem-b");

    insertarPiso(FLOOR_A, TENANT_A, ESTABLISHMENT_A, "Planta A", 1, "planta-a");
    insertarPiso(FLOOR_B, TENANT_B, ESTABLISHMENT_B, "Planta B", 1, "planta-b");

    insertarSector(SECTOR_A, TENANT_A, FLOOR_A, "Sector A", "sector-a");
    insertarSector(SECTOR_B, TENANT_B, FLOOR_B, "Sector B", "sector-b");

    insertarElemento(ELEMENT_A, TENANT_A, SECTOR_A, "TABLE", "AVAILABLE", 10.0, 20.0);
    insertarElemento(ELEMENT_B, TENANT_B, SECTOR_B, "TABLE", "AVAILABLE", 30.0, 40.0);
  }

  // ===== (a) Aislamiento bidireccional =====

  @Test
  void tenant_a_solo_ve_sus_elementos_del_sector() {
    enContexto(
        TENANT_A,
        () -> {
          assertThat(jdbcTemplate.queryForObject("select count(*) from space_element", Long.class))
              .isEqualTo(1L);
          // Aunque el SQL apunte al sector del otro tenant, la RLS lo filtra.
          assertThat(
                  jdbcTemplate.queryForObject(
                      "select count(*) from space_element where sector_id = ?",
                      Long.class,
                      SECTOR_B))
              .isZero();
        });
  }

  @Test
  void tenant_b_solo_ve_sus_elementos() {
    enContexto(
        TENANT_B,
        () -> {
          assertThat(jdbcTemplate.queryForObject("select count(*) from space_element", Long.class))
              .isEqualTo(1L);
          assertThat(
                  jdbcTemplate.queryForObject(
                      "select count(*) from space_element where tenant_id = ?",
                      Long.class,
                      TENANT_A))
              .isZero();
        });
  }

  // ===== (b) Sin tenant en la sesión: falla cerrado =====

  @Test
  void sin_tenant_en_la_sesion_no_se_ve_ningun_elemento() {
    enContextoSinTenant(
        () ->
            assertThat(
                    jdbcTemplate.queryForObject("select count(*) from space_element", Long.class))
                .isZero());
  }

  // ===== (c) Integridad: no se puede crear orfandad por SQL directo =====

  @Test
  void fks_impiden_elemento_sin_sector() {
    UUID sectorQueNoExiste = UUID.fromString("99999999-9999-9999-9999-999999999999");
    assertThatExceptionOfType(org.springframework.dao.DataIntegrityViolationException.class)
        .as("Debe fail al insertar un elemento apuntando a un sector inexistente")
        .isThrownBy(
            () ->
                jdbcTemplate.update(
                    "insert into space_element (id, tenant_id, sector_id, type, state, x, y) "
                        + "values (?, ?, ?, 'TABLE', 'AVAILABLE', 1, 1)",
                    UUID.randomUUID(),
                    TENANT_A,
                    sectorQueNoExiste));
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

  private void insertarEstablecimiento(UUID id, String tenantId, String nombre, String slug) {
    jdbcTemplate.update(
        "insert into establishment (id, tenant_id, name, type, slug) values (?, ?, ?, ?, ?) "
            + "on conflict (id) do nothing",
        id,
        tenantId,
        nombre,
        "RESTAURANT",
        slug);
  }

  private void insertarPiso(
      UUID id, String tenantId, UUID establishmentId, String nombre, int nivel, String slug) {
    jdbcTemplate.update(
        "insert into floor (id, tenant_id, establishment_id, name, level, slug) "
            + "values (?, ?, ?, ?, ?, ?)",
        id,
        tenantId,
        establishmentId,
        nombre,
        nivel,
        slug);
  }

  private void insertarSector(UUID id, String tenantId, UUID floorId, String nombre, String slug) {
    jdbcTemplate.update(
        "insert into sector (id, tenant_id, floor_id, name, slug, max_capacity) "
            + "values (?, ?, ?, ?, ?, ?)",
        id,
        tenantId,
        floorId,
        nombre,
        slug,
        100);
  }

  private void insertarElemento(
      UUID id, String tenant, UUID sectorId, String type, String state, double x, double y) {
    jdbcTemplate.update(
        "insert into space_element (id, tenant_id, sector_id, type, state, x, y) "
            + "values (?, ?, ?, ?, ?, ?, ?)",
        id,
        tenant,
        sectorId,
        type,
        state,
        x,
        y);
  }
}
