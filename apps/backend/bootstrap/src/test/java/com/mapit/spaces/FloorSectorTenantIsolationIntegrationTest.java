package com.mapit.spaces;

import static org.assertj.core.api.Assertions.assertThat;

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
 * Verifica que {@code floor} y {@code sector} quedan aisladas por tenant mediante
 * PostgreSQL RLS (MAP-73, CU-05).
 *
 * <p>Tres frentes:
 *
 * <ul>
 *   <li><b>Aislamiento bidireccional:</b> con {@code app.tenant_id = 'tenant-iso-a'}
 *       solo se ven los pisos/sectores de ese tenant; al cambiar la sesión a
 *       {@code 'tenant-iso-b'}, solo los de ese otro tenant.
 *   <li><b>Falla cerrado:</b> sin {@code app.tenant_id} en la sesión, las consultas
 *       devuelven 0 filas.
 *   <li><b>Slugs repetibles entre tenants:</b> la unicidad es por ámbito
 *       ({@code establishment_id} para pisos, {@code floor_id} para sectores), no
 *       global, así que dos tenants pueden llamar igual a sus pisos y sectores.
 * </ul>
 *
 * <p>Las consultas se ejecutan bajo el rol {@code mapit_rls_test} (sin privilegios):
 * el usuario de la aplicación es superusuario y los superusuarios ignoran la RLS, lo
 * que daría un falso verde. Igual que {@link EstablishmentIsolationIntegrationTest}.
 */
@Tag("integration")
@SpringBootTest
@Testcontainers
class FloorSectorTenantIsolationIntegrationTest {

  @Container
  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16-alpine")
          .withDatabaseName("mapit")
          .withUsername("mapit")
          .withPassword("test_password");

  private static final String TENANT_A = "tenant-iso-a";
  private static final String TENANT_B = "tenant-iso-b";

  private static final UUID ESTABLISHMENT_A =
      UUID.fromString("30000000-0000-0000-0000-000000000001");
  private static final UUID ESTABLISHMENT_B =
      UUID.fromString("40000000-0000-0000-0000-000000000001");

  private static final UUID FLOOR_A = UUID.fromString("d1000000-0000-0000-0000-000000000001");
  private static final UUID FLOOR_B = UUID.fromString("d2000000-0000-0000-0000-000000000001");

  private static final UUID SECTOR_A = UUID.fromString("e1000000-0000-0000-0000-000000000001");
  private static final UUID SECTOR_B = UUID.fromString("e2000000-0000-0000-0000-000000000001");

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
    jdbcTemplate.execute("grant select on floor to mapit_rls_test");
    jdbcTemplate.execute("grant select on sector to mapit_rls_test");

    insertarTenantSiNoExiste(TENANT_A, "Tenant Aislado A", "tenant-iso-a");
    insertarTenantSiNoExiste(TENANT_B, "Tenant Aislado B", "tenant-iso-b");

    // Reset solo de las filas de estos tenants, para no pisar fixtures de otras suites
    // que compartan el contenedor en la misma JVM.
    jdbcTemplate.update("delete from sector where tenant_id in (?, ?)", TENANT_A, TENANT_B);
    jdbcTemplate.update("delete from floor where tenant_id in (?, ?)", TENANT_A, TENANT_B);

    insertarEstablecimientoSiNoExiste(ESTABLISHMENT_A, TENANT_A, "Establecimiento A", "est-iso-a");
    insertarEstablecimientoSiNoExiste(ESTABLISHMENT_B, TENANT_B, "Establecimiento B", "est-iso-b");

    // Mismo nombre y mismo slug en ambos tenants, a propósito: la unicidad es por ámbito.
    insertarPiso(FLOOR_A, TENANT_A, ESTABLISHMENT_A, "Piso Único", "piso-unico");
    insertarPiso(FLOOR_B, TENANT_B, ESTABLISHMENT_B, "Piso Único", "piso-unico");
    insertarSector(SECTOR_A, TENANT_A, FLOOR_A, "Sector Único", "sector-unico");
    insertarSector(SECTOR_B, TENANT_B, FLOOR_B, "Sector Único", "sector-unico");
  }

  // ===== (a) Aislamiento bidireccional =====

  @Test
  void tenant_a_solo_ve_sus_pisos_y_sectores() {
    enContexto(
        TENANT_A,
        () -> {
          assertThat(jdbcTemplate.queryForObject("select count(*) from floor", Long.class))
              .isEqualTo(1L);
          assertThat(jdbcTemplate.queryForObject("select count(*) from sector", Long.class))
              .isEqualTo(1L);
          // Aunque el SQL apunte al otro tenant, la RLS lo filtra.
          assertThat(
                  jdbcTemplate.queryForObject(
                      "select count(*) from floor where tenant_id = ?", Long.class, TENANT_B))
              .isZero();
          assertThat(
                  jdbcTemplate.queryForObject(
                      "select count(*) from sector where floor_id = ?", Long.class, FLOOR_B))
              .isZero();
        });
  }

  @Test
  void tenant_b_solo_ve_sus_pisos_y_sectores() {
    enContexto(
        TENANT_B,
        () -> {
          assertThat(jdbcTemplate.queryForObject("select count(*) from floor", Long.class))
              .isEqualTo(1L);
          assertThat(jdbcTemplate.queryForObject("select count(*) from sector", Long.class))
              .isEqualTo(1L);
          assertThat(
                  jdbcTemplate.queryForObject(
                      "select count(*) from floor where tenant_id = ?", Long.class, TENANT_A))
              .isZero();
          assertThat(
                  jdbcTemplate.queryForObject(
                      "select count(*) from sector where floor_id = ?", Long.class, FLOOR_A))
              .isZero();
        });
  }

  // ===== (b) Falla cerrado =====

  @Test
  void sin_tenant_en_la_sesion_no_devuelve_ninguna_fila() {
    transactionTemplate.executeWithoutResult(
        status -> {
          jdbcTemplate.execute("set local role mapit_rls_test");

          // Sin app.tenant_id en la sesión: cero filas, no todas. En ambas tablas.
          assertThat(jdbcTemplate.queryForObject("select count(*) from floor", Long.class))
              .isZero();
          assertThat(jdbcTemplate.queryForObject("select count(*) from sector", Long.class))
              .isZero();
        });
  }

  // ===== (c) Unicidad de slugs por tenant =====

  @Test
  void el_mismo_slug_puede_repetirse_en_tenants_distintos() {
    // Si la unicidad fuese global, el @BeforeEach ya habría fallado al insertar
    // 'piso-unico' y 'sector-unico' en ambos tenants. Aquí se demuestra que ambas
    // filas coexisten y que cada consulta RLS solo devuelve la propia.
    assertThat(
            jdbcTemplate.queryForObject(
                "select count(*) from floor where slug = 'piso-unico'", Long.class))
        .isEqualTo(2L);
    assertThat(
            jdbcTemplate.queryForObject(
                "select count(*) from sector where slug = 'sector-unico'", Long.class))
        .isEqualTo(2L);

    enContexto(
        TENANT_A,
        () ->
            assertThat(
                    jdbcTemplate.queryForObject(
                        "select count(*) from floor where slug = 'piso-unico'", Long.class))
                .isEqualTo(1L));
    enContexto(
        TENANT_B,
        () ->
            assertThat(
                    jdbcTemplate.queryForObject(
                        "select count(*) from floor where slug = 'piso-unico'", Long.class))
                .isEqualTo(1L));
  }

  // ===== Infraestructura del test =====

  /**
   * Ejecuta las aserciones bajo el rol sin privilegios y con el contexto de tenant
   * configurado, replicando cómo el backend fija {@code app.tenant_id} (SET LOCAL):
   * ambos ajustes mueren al cerrar la transacción.
   */
  private void enContexto(String tenantId, Runnable aserciones) {
    transactionTemplate.executeWithoutResult(
        status -> {
          jdbcTemplate.execute("set local role mapit_rls_test");
          jdbcTemplate.queryForObject(
              "select set_config('app.tenant_id', ?, true)", String.class, tenantId);
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

  private void insertarEstablecimientoSiNoExiste(
      UUID id, String tenantId, String nombre, String slug) {
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
      UUID id, String tenantId, UUID establishmentId, String nombre, String slug) {
    jdbcTemplate.update(
        "insert into floor (id, tenant_id, establishment_id, name, level, slug) "
            + "values (?, ?, ?, ?, ?, ?)",
        id,
        tenantId,
        establishmentId,
        nombre,
        1,
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
        50);
  }
}
