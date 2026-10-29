package com.mapit.verticals;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.mapit.identity.domain.AccessTokenIssuer;
import com.mapit.identity.domain.AuthenticatedUser;
import com.mapit.identity.domain.UserRole;
import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagPort;
import com.mapit.shared.tenant.TenantId;

/**
 * HU-7.01/7.02 · MAP-233: el mismo servicio de reservas aplica turno, noche, evento y estadía
 * según la vertical del establecimiento, con 409 por solape, 400 por ventana o elemento no
 * reservable, 403 con la vertical apagada y sin cruzar tenants (CA-8…CA-13).
 *
 * <p>Reloj fijo el 25/10/2026; todas las fechas son de noviembre en La Paz (UTC-4).
 */
@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@Import(VerticalReservationIntegrationTest.TestBeans.class)
class VerticalReservationIntegrationTest {

  @Container
  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16-alpine")
          .withDatabaseName("mapit")
          .withUsername("mapit")
          .withPassword("test_password");

  private static final String TENANT_A = "verticales-a";
  private static final String TENANT_B = "verticales-b";
  private static final UUID STAFF_A = uuid("81000000-0000-0000-0000-000000000001");
  private static final UUID PERSON_A = uuid("81000000-0000-0000-0000-000000000002");

  private static final UUID RESTAURANT = uuid("81000000-0000-0000-0000-000000000101");
  private static final UUID NIGHTCLUB = uuid("81000000-0000-0000-0000-000000000201");
  private static final UUID EVENT_HALL = uuid("81000000-0000-0000-0000-000000000301");
  private static final UUID HOTEL = uuid("81000000-0000-0000-0000-000000000401");
  private static final UUID RESTAURANT_B = uuid("82000000-0000-0000-0000-000000000101");

  private static final UUID TABLE = uuid("81000000-0000-0000-0000-000000000111");
  private static final UUID STAGE = uuid("81000000-0000-0000-0000-000000000112");
  private static final UUID VIP_ZONE = uuid("81000000-0000-0000-0000-000000000211");
  private static final UUID SEAT_1 = uuid("81000000-0000-0000-0000-000000000311");
  private static final UUID SEAT_2 = uuid("81000000-0000-0000-0000-000000000312");
  private static final UUID ROOM = uuid("81000000-0000-0000-0000-000000000411");
  private static final UUID TABLE_B = uuid("82000000-0000-0000-0000-000000000111");

  private static final Set<String> APAGADAS = ConcurrentHashMap.newKeySet();

  @LocalServerPort private int port;
  @Autowired private JdbcTemplate jdbc;
  @Autowired private AccessTokenIssuer tokens;

  @DynamicPropertySource
  static void databaseProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add("spring.flyway.url", POSTGRES::getJdbcUrl);
    registry.add("spring.flyway.user", POSTGRES::getUsername);
    registry.add("spring.flyway.password", POSTGRES::getPassword);
    registry.add("spring.flyway.placeholders.mapitAppDbPassword", () -> "test_app_password");
    registry.add("mapit.unleash.enabled", () -> "false");
    registry.add("mapit.realtime.outbox.poll-interval-ms", () -> "3600000");
    registry.add("mapit.realtime.outbox.cleanup-interval-ms", () -> "3600000");
  }

  @BeforeEach
  void fixtures() {
    APAGADAS.clear();
    // La bitácora es inmutable (HU-5.03): se vacía entera, como en ReservationCreationIntegrationTest.
    jdbc.execute("truncate table audit_log");
    for (String table :
        List.of(
            "reservation_space_element",
            "reservation",
            "person",
            "space_element",
            "sector",
            "floor",
            "establishment",
            "app_user")) {
      jdbc.update("delete from " + table + " where tenant_id in (?, ?)", TENANT_A, TENANT_B);
    }
    jdbc.update("delete from tenant where id in (?, ?)", TENANT_A, TENANT_B);

    tenant(TENANT_A);
    tenant(TENANT_B);
    jdbc.update(
        "insert into app_user (id, tenant_id, email, password_hash, full_name, role) values (?, ?, 'staff@verticales.test', 'unused', 'Staff', 'STAFF')",
        STAFF_A,
        TENANT_A);
    jdbc.update(
        "insert into person (id, tenant_id, full_name, email, created_by, updated_by) values (?, ?, 'Cliente A', 'cliente@verticales.test', ?, ?)",
        PERSON_A,
        TENANT_A,
        STAFF_A,
        STAFF_A);

    venue(TENANT_A, RESTAURANT, "RESTAURANT", "restaurante");
    element(TENANT_A, RESTAURANT, TABLE, "TABLE", "Mesa 4");
    element(TENANT_A, RESTAURANT, STAGE, "STAGE", "Escenario");
    venue(TENANT_A, NIGHTCLUB, "NIGHTCLUB", "discoteca");
    element(TENANT_A, NIGHTCLUB, VIP_ZONE, "SECTOR_ZONE", "Zona VIP");
    venue(TENANT_A, EVENT_HALL, "EVENT_HALL", "salon");
    element(TENANT_A, EVENT_HALL, SEAT_1, "SEAT", "Fila A · 1");
    element(TENANT_A, EVENT_HALL, SEAT_2, "SEAT", "Fila A · 2");
    venue(TENANT_A, HOTEL, "HOTEL", "hotel");
    element(TENANT_A, HOTEL, ROOM, "ROOM", "Habitación 101");
    venue(TENANT_B, RESTAURANT_B, "RESTAURANT", "restaurante");
    element(TENANT_B, RESTAURANT_B, TABLE_B, "TABLE", "Mesa B");
  }

  // ── Restaurante: turno ────────────────────────────────────────────────

  @Test
  void restaurante_reserva_turnos_del_mismo_dia_y_rechaza_lo_demas() {
    publicReservation(TENANT_A, "restaurante", TABLE, "2026-11-02", "19:00", null, "21:00")
        .expectStatus()
        .isCreated()
        .expectBody()
        .jsonPath("$.endDate")
        .isEqualTo("2026-11-02");

    // Un turno no cruza el día ni dura más de 6 h.
    publicReservation(TENANT_A, "restaurante", TABLE, "2026-11-03", "22:00", null, "01:00")
        .expectStatus()
        .isBadRequest();
    publicReservation(TENANT_A, "restaurante", TABLE, "2026-11-03", "10:00", null, "17:00")
        .expectStatus()
        .isBadRequest();
    // El escenario se dibuja pero no se reserva.
    publicReservation(TENANT_A, "restaurante", STAGE, "2026-11-03", "19:00", null, "21:00")
        .expectStatus()
        .isBadRequest();
    // Solape con el turno ya creado.
    publicReservation(TENANT_A, "restaurante", TABLE, "2026-11-02", "20:00", null, "22:00")
        .expectStatus()
        .isEqualTo(409);
  }

  // ── Discoteca: noche ──────────────────────────────────────────────────

  @Test
  void discoteca_reserva_una_noche_que_termina_al_dia_siguiente() {
    publicReservation(TENANT_A, "discoteca", VIP_ZONE, "2026-11-06", "23:00", null, "04:00")
        .expectStatus()
        .isCreated()
        .expectBody()
        .jsonPath("$.endDate")
        .isEqualTo("2026-11-07")
        .jsonPath("$.endsAt")
        .isEqualTo("2026-11-07T08:00:00Z");

    publicReservation(TENANT_A, "discoteca", VIP_ZONE, "2026-11-07", "01:00", null, "03:00")
        .expectStatus()
        .isEqualTo(409);
    publicReservation(TENANT_A, "discoteca", VIP_ZONE, "2026-11-08", "18:00", "2026-11-09", "08:00")
        .expectStatus()
        .isBadRequest();
  }

  // ── Salón de eventos: evento y ubicación numerada ─────────────────────

  @Test
  void salon_reserva_butacas_numeradas_sin_solape_por_butaca() {
    publicReservation(TENANT_A, "salon", SEAT_1, "2026-11-07", "18:00", null, "23:00")
        .expectStatus()
        .isCreated();
    publicReservation(TENANT_A, "salon", SEAT_1, "2026-11-07", "20:00", null, "22:00")
        .expectStatus()
        .isEqualTo(409);
    publicReservation(TENANT_A, "salon", SEAT_2, "2026-11-07", "20:00", null, "22:00")
        .expectStatus()
        .isCreated();
  }

  // ── Hotel: estadía ────────────────────────────────────────────────────

  @Test
  void hotel_reserva_estadias_por_noches_con_solape_y_salida_encadenada() {
    publicReservation(TENANT_A, "hotel", ROOM, "2026-11-02", "15:00", "2026-11-04", "12:00")
        .expectStatus()
        .isCreated()
        .expectBody()
        .jsonPath("$.date")
        .isEqualTo("2026-11-02")
        .jsonPath("$.endDate")
        .isEqualTo("2026-11-04");

    publicReservation(TENANT_A, "hotel", ROOM, "2026-11-03", "15:00", "2026-11-05", "12:00")
        .expectStatus()
        .isEqualTo(409);
    // Entra el día en que sale el anterior: 12:00 → 15:00 no colisiona.
    publicReservation(TENANT_A, "hotel", ROOM, "2026-11-04", "15:00", "2026-11-05", "12:00")
        .expectStatus()
        .isCreated();
    // Sin noches, o más de 30.
    publicReservation(TENANT_A, "hotel", ROOM, "2026-11-10", "10:00", "2026-11-10", "12:00")
        .expectStatus()
        .isBadRequest();
    publicReservation(TENANT_A, "hotel", ROOM, "2026-11-10", "15:00", "2026-12-12", "12:00")
        .expectStatus()
        .isBadRequest();
  }

  @Test
  void el_mapa_publico_lleva_el_perfil_y_solo_ofrece_lo_reservable() {
    publicReservation(TENANT_A, "hotel", ROOM, "2026-11-02", "15:00", "2026-11-04", "12:00")
        .expectStatus()
        .isCreated();

    map(TENANT_A, "hotel", "date=2026-11-03&startTime=15:00&endDate=2026-11-04&endTime=12:00")
        .expectStatus()
        .isOk()
        .expectBody()
        .jsonPath("$.vertical.establishmentType").isEqualTo("HOTEL")
        .jsonPath("$.vertical.bookingMode").isEqualTo("STAY")
        .jsonPath("$.vertical.defaultStartTime").isEqualTo("15:00")
        .jsonPath("$.vertical.enabled").isEqualTo(true)
        .jsonPath("$.endDate").isEqualTo("2026-11-04")
        .jsonPath("$.floors[0].sectors[0].elements[0].availability").isEqualTo("RESERVED");

    map(TENANT_A, "restaurante", "date=2026-11-02&startTime=19:00&endTime=21:00")
        .expectStatus()
        .isOk()
        .expectBody()
        .jsonPath("$.vertical.bookingMode").isEqualTo("SHIFT")
        .jsonPath("$.vertical.maxDurationMinutes").isEqualTo(360)
        .jsonPath("$.floors[0].sectors[0].elements[?(@.type == 'STAGE')].selectable")
        .isEqualTo(List.of(false))
        .jsonPath("$.floors[0].sectors[0].elements[?(@.type == 'TABLE')].selectable")
        .isEqualTo(List.of(true));

    // La lista simple de HU-6.01 tampoco ofrece el escenario.
    http()
        .get()
        .uri("/api/v1/public/tenants/{t}/establishments/restaurante/availability?date=2026-11-02", TENANT_A)
        .exchange()
        .expectStatus()
        .isOk()
        .expectBody()
        .jsonPath("$.elements[*].type")
        .isEqualTo(List.of("TABLE"));
  }

  @Test
  void el_portal_obtiene_el_perfil_por_slug_antes_de_buscar() {
    http()
        .get()
        .uri("/api/v1/public/tenants/{t}/establishments/discoteca/vertical-profile", TENANT_A)
        .exchange()
        .expectStatus()
        .isOk()
        .expectBody()
        .jsonPath("$.establishmentType").isEqualTo("NIGHTCLUB")
        .jsonPath("$.bookingMode").isEqualTo("NIGHT")
        .jsonPath("$.allowsOvernight").isEqualTo(true)
        .jsonPath("$.reservableElementTypes").isEqualTo(List.of("TABLE", "BAR", "SECTOR_ZONE"));
    http()
        .get()
        .uri("/api/v1/public/tenants/{t}/establishments/discoteca/vertical-profile", TENANT_B)
        .exchange()
        .expectStatus()
        .isNotFound();
  }

  // ── Habilitación por Unleash ──────────────────────────────────────────

  @Test
  void hotel_apagado_rechaza_reservas_publicas_y_de_staff_sin_cambiar_de_vertical() {
    APAGADAS.add(FeatureFlag.VERTICAL_HOTEL.clave() + "@" + TENANT_A);

    publicReservation(TENANT_A, "hotel", ROOM, "2026-11-02", "15:00", "2026-11-04", "12:00")
        .expectStatus()
        .isForbidden()
        .expectBody()
        .jsonPath("$.type").isEqualTo("https://mapit.local/problems/vertical-disabled")
        .jsonPath("$.vertical").isEqualTo("HOTEL");
    staffReservation(HOTEL, ROOM, "2026-11-02T19:00:00Z", "2026-11-04T16:00:00Z")
        .expectStatus()
        .isForbidden();

    map(TENANT_A, "hotel", "date=2026-11-02&startTime=15:00&endDate=2026-11-04&endTime=12:00")
        .expectStatus()
        .isOk()
        .expectBody()
        .jsonPath("$.vertical.establishmentType").isEqualTo("HOTEL")
        .jsonPath("$.vertical.enabled").isEqualTo(false)
        .jsonPath("$.floors[0].sectors[0].elements[0].selectable").isEqualTo(false);

    // Los restaurantes del mismo tenant siguen reservando.
    publicReservation(TENANT_A, "restaurante", TABLE, "2026-11-02", "19:00", null, "21:00")
        .expectStatus()
        .isCreated();
  }

  // ── Staff y aislamiento ───────────────────────────────────────────────

  @Test
  void staff_reserva_una_estadia_con_las_mismas_reglas_que_el_portal() {
    staffReservation(HOTEL, ROOM, "2026-11-02T19:00:00Z", "2026-11-04T16:00:00Z")
        .expectStatus()
        .isCreated();
    staffReservation(HOTEL, ROOM, "2026-11-10T19:00:00Z", "2026-11-10T21:00:00Z")
        .expectStatus()
        .isBadRequest();
    staffReservation(RESTAURANT, STAGE, "2026-11-02T23:00:00Z", "2026-11-03T01:00:00Z")
        .expectStatus()
        .isBadRequest();
  }

  @Test
  void nunca_se_reserva_un_elemento_de_otro_tenant_ni_de_otro_establecimiento() {
    publicReservation(TENANT_A, "restaurante", TABLE_B, "2026-11-02", "19:00", null, "21:00")
        .expectStatus()
        .isNotFound();
    publicReservation(TENANT_B, "restaurante", TABLE, "2026-11-02", "19:00", null, "21:00")
        .expectStatus()
        .isNotFound();
    // Habitación del hotel pedida desde el restaurante del mismo tenant.
    publicReservation(TENANT_A, "restaurante", ROOM, "2026-11-02", "19:00", null, "21:00")
        .expectStatus()
        .isBadRequest();
  }

  private RestTestClient.ResponseSpec publicReservation(
      String tenant,
      String establishmentSlug,
      UUID element,
      String date,
      String startTime,
      String endDate,
      String endTime) {
    Map<String, Object> body = new HashMap<>();
    body.put("date", date);
    body.put("startTime", startTime);
    if (endDate != null) {
      body.put("endDate", endDate);
    }
    body.put("endTime", endTime);
    body.put("spaceElementIds", List.of(element));
    body.put("customer", Map.of("fullName", "Ana Pérez", "email", "ana@verticales.test"));
    return http()
        .post()
        .uri(
            "/api/v1/public/tenants/{t}/establishments/{e}/reservations", tenant, establishmentSlug)
        .contentType(MediaType.APPLICATION_JSON)
        .body(body)
        .exchange();
  }

  private RestTestClient.ResponseSpec staffReservation(
      UUID establishment, UUID element, String startsAt, String endsAt) {
    String token =
        tokens
            .issue(
                new AuthenticatedUser(
                    STAFF_A,
                    TenantId.of(TENANT_A),
                    "staff@verticales.test",
                    "Staff",
                    UserRole.STAFF))
            .value();
    return http()
        .post()
        .uri("/api/v1/establishments/{id}/reservations", establishment)
        .contentType(MediaType.APPLICATION_JSON)
        .header("Authorization", "Bearer " + token)
        .body(
            Map.of(
                "personId", PERSON_A,
                "spaceElementIds", List.of(element),
                "startsAt", startsAt,
                "endsAt", endsAt))
        .exchange();
  }

  private RestTestClient.ResponseSpec map(String tenant, String establishmentSlug, String query) {
    return http()
        .get()
        .uri(
            "/api/v1/public/tenants/"
                + tenant
                + "/establishments/"
                + establishmentSlug
                + "/availability/map?"
                + query)
        .exchange();
  }

  private RestTestClient http() {
    return RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
  }

  private void tenant(String id) {
    jdbc.update(
        "insert into tenant (id, name, slug, status, vertical) values (?, ?, ?, 'ACTIVE', 'RESTAURANT')",
        id,
        "Empresa " + id,
        id);
  }

  /** Establecimiento con un piso y un sector cuyo id deriva del del establecimiento. */
  private void venue(String tenant, UUID id, String type, String slug) {
    jdbc.update(
        "insert into establishment (id, tenant_id, name, type, slug, timezone) values (?, ?, ?, ?, ?, 'America/La_Paz')",
        id,
        tenant,
        "Local " + slug,
        type,
        slug);
    jdbc.update(
        "insert into floor (id, tenant_id, establishment_id, name, level, slug) values (?, ?, ?, 'Planta', 1, 'planta')",
        child(id, 2),
        tenant,
        id);
    jdbc.update(
        "insert into sector (id, tenant_id, floor_id, name, slug, max_capacity) values (?, ?, ?, 'Sala', 'sala', 100)",
        child(id, 3),
        tenant,
        child(id, 2));
  }

  private void element(String tenant, UUID venue, UUID id, String type, String label) {
    jdbc.update(
        "insert into space_element (id, tenant_id, sector_id, type, state, label, x, y) values (?, ?, ?, ?, 'AVAILABLE', ?, 1, 1)",
        id,
        tenant,
        child(venue, 3),
        type,
        label);
  }

  private static UUID child(UUID venue, int suffix) {
    String value = venue.toString();
    return UUID.fromString(value.substring(0, value.length() - 1) + suffix);
  }

  private static UUID uuid(String value) {
    return UUID.fromString(value);
  }

  @TestConfiguration
  static class TestBeans {

    @Bean
    @Primary
    Clock reservationClock() {
      return Clock.fixed(Instant.parse("2026-10-25T12:00:00Z"), ZoneOffset.UTC);
    }

    @Bean
    @Primary
    FeatureFlagPort featureFlags() {
      return new FeatureFlagPort() {
        @Override
        public boolean isEnabled(FeatureFlag flag) {
          return flag.valorPorDefecto();
        }

        @Override
        public boolean isEnabled(FeatureFlag flag, boolean defaultValue) {
          return defaultValue;
        }

        @Override
        public boolean isEnabledFor(FeatureFlag flag, TenantId tenantId) {
          return !APAGADAS.contains(flag.clave() + "@" + tenantId.value());
        }
      };
    }
  }
}
