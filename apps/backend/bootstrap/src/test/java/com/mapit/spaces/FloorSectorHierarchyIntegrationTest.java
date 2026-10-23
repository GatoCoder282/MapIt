package com.mapit.spaces;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
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
 * Verifica la jerarquía piso → sector y su aislamiento multi-tenant por PostgreSQL RLS
 * (MAP-72, CU-05).
 *
 * <p>Dos frentes:
 *
 * <ul>
 *   <li><b>Jerarquía:</b> un piso agrupa N sectores, cada sector pertenece a un único
 *       piso y las consultas por {@code floor_id} no mezclan sectores de otros pisos.
 *   <li><b>RLS:</b> cada tenant solo ve sus pisos y sectores; sin
 *       {@code app.tenant_id} en la sesión la consulta devuelve 0 filas (falla cerrado).
 * </ul>
 *
 * <p>Las consultas se ejecutan bajo el rol {@code mapit_rls_test} (sin privilegios) por
 * la misma razón que en {@link EstablishmentIsolationIntegrationTest}: el usuario de la
 * aplicación es superusuario y los superusuarios ignoran la RLS.
 */
@Tag("integration")
@SpringBootTest
@Testcontainers
class FloorSectorHierarchyIntegrationTest {

  @Container
  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16-alpine")
          .withDatabaseName("mapit")
          .withUsername("mapit")
          .withPassword("test_password");

  // Identidades fijas para poder referenciarlas desde las aserciones.
  private static final String TENANT_A = "tenant-a";
  private static final String TENANT_B = "tenant-b";

  private static final UUID ESTABLISHMENT_A =
      UUID.fromString("10000000-0000-0000-0000-000000000001");
  private static final UUID ESTABLISHMENT_B =
      UUID.fromString("20000000-0000-0000-0000-000000000001");

  private static final UUID FLOOR_A1 = UUID.fromString("a1000000-0000-0000-0000-000000000001");
  private static final UUID FLOOR_A2 = UUID.fromString("a1000000-0000-0000-0000-000000000002");
  private static final UUID FLOOR_B1 = UUID.fromString("b1000000-0000-0000-0000-000000000001");

  private static final UUID SECTOR_A1A = UUID.fromString("c1000000-0000-0000-0000-000000000001");
  private static final UUID SECTOR_A1B = UUID.fromString("c1000000-0000-0000-0000-000000000002");
  private static final UUID SECTOR_A2A = UUID.fromString("c1000000-0000-0000-0000-000000000003");
  private static final UUID SECTOR_B1A = UUID.fromString("c2000000-0000-0000-0000-000000000001");

  @Autowired private JdbcTemplate jdbcTemplate;

  @Autowired private TransactionTemplate transactionTemplate;

  @DynamicPropertySource
  static void databaseProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    // La migración V9 crea el rol mapit_app con esta contraseña (vers MAP-175).
    registry.add("spring.flyway.url", POSTGRES::getJdbcUrl);
    registry.add("spring.flyway.user", POSTGRES::getUsername);
    registry.add("spring.flyway.password", POSTGRES::getPassword);
    registry.add("spring.flyway.placeholders.mapitAppDbPassword", () -> "test_app_password");
  }

  @BeforeEach
  void prepararRolSinPrivilegiosYJerarquia() {
    jdbcTemplate.execute(
        "do $$ begin "
            + "if not exists (select from pg_roles where rolname = 'mapit_rls_test') then "
            + "create role mapit_rls_test nologin nosuperuser; "
            + "end if; end $$");
    jdbcTemplate.execute("grant usage on schema public to mapit_rls_test");
    jdbcTemplate.execute("grant select on floor to mapit_rls_test");
    jdbcTemplate.execute("grant select on sector to mapit_rls_test");

    // Fixtures. Como superusuario la RLS no se aplica; la jerarquía se monta plana.
    insertarTenantSiNoExiste(TENANT_A, "Tenant A", "tenant-a");
    insertarTenantSiNoExiste(TENANT_B, "Tenant B", "tenant-b");

    jdbcTemplate.update("delete from sector");
    jdbcTemplate.update("delete from floor");

    insertarEstablecimientoSiNoExiste(ESTABLISHMENT_A, TENANT_A, "Establecimiento A", "est-a");
    insertarEstablecimientoSiNoExiste(ESTABLISHMENT_B, TENANT_B, "Establecimiento B", "est-b");

    // tenant A: dos pisos; el piso 1 con dos sectores, el piso 2 con uno.
    insertarPiso(FLOOR_A1, TENANT_A, ESTABLISHMENT_A, "Piso 1", 1, "piso-1");
    insertarPiso(FLOOR_A2, TENANT_A, ESTABLISHMENT_A, "Piso 2", 2, "piso-2");
    // tenant B: un piso con un sector.
    insertarPiso(FLOOR_B1, TENANT_B, ESTABLISHMENT_B, "Piso 1", 1, "piso-1");

    insertarSector(SECTOR_A1A, TENANT_A, FLOOR_A1, "Salón Principal", "salon-principal", 150);
    insertarSector(SECTOR_A1B, TENANT_A, FLOOR_A1, "Terraza", "terraza", 60);
    insertarSector(SECTOR_A2A, TENANT_A, FLOOR_A2, "Barra", "barra", 40);
    insertarSector(SECTOR_B1A, TENANT_B, FLOOR_B1, "Lobby", "lobby", 80);
  }

  // ===== Jerarquía piso → sector =====

  @Test
  void un_piso_agrupa_exactamente_sus_sectores() {
    enContexto(
        TENANT_A,
        () -> {
          assertThat(
                  jdbcTemplate.queryForObject(
                      "select count(*) from sector where floor_id = ?", Long.class, FLOOR_A1))
              .isEqualTo(2L);
          assertThat(
                  jdbcTemplate.queryForList(
                      "select name from sector where floor_id = ? order by name",
                      String.class,
                      FLOOR_A1))
              .containsExactly("Salón Principal", "Terraza");
        });
  }

  @Test
  void cada_sector_pertenece_a_un_unico_piso() {
    enContexto(
        TENANT_A,
        () -> {
          // Un sector no aparece bajo dos pisos: la FK floor_id es escalar.
          assertThat(
                  jdbcTemplate.queryForObject(
                      "select count(distinct floor_id) from sector where id = ?",
                      Long.class,
                      SECTOR_A1A))
              .isEqualTo(1L);
          assertThat(
                  jdbcTemplate.queryForObject(
                      "select floor_id from sector where id = ?", UUID.class, SECTOR_A1B))
              .isEqualTo(FLOOR_A1);
        });
  }

  @Test
  void el_filtro_por_piso_no_mezcla_sectores_de_otros_pisos() {
    enContexto(
        TENANT_A,
        () -> {
          // El piso 2 no hereda los sectores del piso 1 aunque compartan establecimiento.
          List<UUID> sectoresPiso2 =
              jdbcTemplate.queryForList(
                  "select id from sector where floor_id = ?", UUID.class, FLOOR_A2);
          assertThat(sectoresPiso2).containsExactly(SECTOR_A2A);
          assertThat(sectoresPiso2).doesNotContain(SECTOR_A1A, SECTOR_A1B);
        });
  }

  // ===== Aislamiento multi-tenant (RLS) =====

  @Test
  void cada_tenant_solo_ve_sus_pisos_y_sectores() {
    enContexto(
        TENANT_A,
        () -> {
          assertThat(jdbcTemplate.queryForObject("select count(*) from floor", Long.class))
              .isEqualTo(2L);
          assertThat(jdbcTemplate.queryForObject("select count(*) from sector", Long.class))
              .isEqualTo(3L);
          // Aunque el SQL mencione al otro tenant, la RLS lo filtra.
          assertThat(
                  jdbcTemplate.queryForObject(
                      "select count(*) from floor where tenant_id = ?", Long.class, TENANT_B))
              .isZero();
          assertThat(
                  jdbcTemplate.queryForObject(
                      "select count(*) from sector where floor_id = ?", Long.class, FLOOR_B1))
              .isZero();
        });

    enContexto(
        TENANT_B,
        () -> {
          assertThat(jdbcTemplate.queryForObject("select count(*) from floor", Long.class))
              .isEqualTo(1L);
          assertThat(jdbcTemplate.queryForObject("select count(*) from sector", Long.class))
              .isEqualTo(1L);
          assertThat(
                  jdbcTemplate.queryForObject(
                      "select id from sector where floor_id = ?", UUID.class, FLOOR_B1))
              .isEqualTo(SECTOR_B1A);
        });
  }

  @Test
  void sin_tenant_en_la_sesion_no_devuelve_ninguna_fila() {
    transactionTemplate.executeWithoutResult(
        status -> {
          jdbcTemplate.execute("set local role mapit_rls_test");

          // Falla cerrado en ambas tablas de la jerarquía: sin contexto, cero filas.
          assertThat(jdbcTemplate.queryForObject("select count(*) from floor", Long.class))
              .isZero();
          assertThat(jdbcTemplate.queryForObject("select count(*) from sector", Long.class))
              .isZero();
        });
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

  private void insertarPiso(UUID id, String tenantId, UUID establishmentId, String nombre,
      int nivel, String slug) {
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

  private void insertarSector(
      UUID id, String tenantId, UUID floorId, String nombre, String slug, int maxCapacity) {
    jdbcTemplate.update(
        "insert into sector (id, tenant_id, floor_id, name, slug, max_capacity) "
            + "values (?, ?, ?, ?, ?, ?)",
        id,
        tenantId,
        floorId,
        nombre,
        slug,
        maxCapacity);
  }
}
