package com.mapit.payments;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.mapit.identity.domain.AccessTokenIssuer;
import com.mapit.identity.domain.AuthenticatedUser;
import com.mapit.identity.domain.UserRole;
import com.mapit.payments.application.PaymentService;
import com.mapit.payments.domain.Money;
import com.mapit.payments.domain.Payment;
import com.mapit.payments.domain.PaymentMethodRepository;
import com.mapit.payments.domain.PaymentProvider;
import com.mapit.payments.domain.PaymentRepository;
import com.mapit.payments.domain.ReservationPaymentPort;
import com.mapit.payments.infrastructure.MockPaymentGateway;
import com.mapit.shared.tenant.TenantId;

/** API real y RLS: métodos administrativos independientes del contrato público de reservas. */
@Tag("integration")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class PaymentMethodsIntegrationTest {
  private static final String PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWH8AAAAASUVORK5CYII=";
  @Container
  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine")
      .withDatabaseName("mapit").withUsername("mapit").withPassword("test_password");

  @LocalServerPort int port;
  @Autowired JdbcTemplate jdbc;
  @Autowired AccessTokenIssuer tokens;
  @Autowired TransactionTemplate transactions;
  @Autowired PaymentRepository paymentRepository;
  @Autowired PaymentMethodRepository methodRepository;
  String tenantA;
  String tenantB;
  UUID adminA;
  UUID adminB;
  UUID establishmentA;
  UUID establishmentB;

  @DynamicPropertySource
  static void properties(DynamicPropertyRegistry registry) {
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
    tenantA = "payments-" + UUID.randomUUID();
    tenantB = "payments-" + UUID.randomUUID();
    adminA = UUID.randomUUID();
    adminB = UUID.randomUUID();
    establishmentA = UUID.randomUUID();
    establishmentB = UUID.randomUUID();
    seed(tenantA, adminA, establishmentA);
    seed(tenantB, adminB, establishmentB);
  }

  @Test
  void onlyAdminCanReadOrWriteAndAnonymousCannotAccess() {
    client().get().uri("/api/v1/payment-methods").exchange().expectStatus().isUnauthorized();
    for (UserRole role : new UserRole[] {UserRole.STAFF, UserRole.MANAGER, UserRole.SUPER_ADMIN}) {
      String bearer = token(adminA, tenantA, role);
      client().get().uri("/api/v1/payment-methods").headers(h -> h.setBearerAuth(bearer))
          .exchange().expectStatus().isForbidden();
      client().post().uri("/api/v1/payment-methods").headers(h -> h.setBearerAuth(bearer))
          .contentType(MediaType.APPLICATION_JSON).body(request(null)).exchange().expectStatus().isForbidden();
    }
    create(tenantA, adminA, null);
  }

  @Test
  void foreignTenantCannotListUpdateOrConfigureEstablishment() {
    UUID method = create(tenantA, adminA, null);
    client().get().uri("/api/v1/payment-methods")
        .headers(h -> h.setBearerAuth(token(adminB, tenantB, UserRole.ADMIN)))
        .exchange().expectStatus().isOk().expectBody().json("[]");
    client().put().uri("/api/v1/payment-methods/" + method)
        .headers(h -> h.setBearerAuth(token(adminB, tenantB, UserRole.ADMIN)))
        .contentType(MediaType.APPLICATION_JSON).body(request(null))
        .exchange().expectStatus().isNotFound();
    client().post().uri("/api/v1/payment-methods")
        .headers(h -> h.setBearerAuth(token(adminA, tenantA, UserRole.ADMIN)))
        .contentType(MediaType.APPLICATION_JSON).body(request(establishmentB))
        .exchange().expectStatus().isNotFound();
    client().get().uri("/api/v1/payment-methods?establishmentId=" + establishmentB)
        .headers(h -> h.setBearerAuth(token(adminA, tenantA, UserRole.ADMIN)))
        .exchange().expectStatus().isNotFound();
  }

  @Test
  void localDisabledMethodOverridesTenantDefaultAndStaticRemainsManual() {
    UUID defaultId = create(tenantA, adminA, null);
    client().get().uri("/api/v1/payment-methods?establishmentId=" + establishmentA)
        .headers(h -> h.setBearerAuth(token(adminA, tenantA, UserRole.ADMIN)))
        .exchange().expectStatus().isOk().expectBody().jsonPath("$[0].id").isEqualTo(defaultId.toString());
    UUID localId = create(tenantA, adminA, establishmentA);
    Map<String, Object> disabled = request(establishmentA);
    disabled.put("enabled", false);
    client().put().uri("/api/v1/payment-methods/" + localId)
        .headers(h -> h.setBearerAuth(token(adminA, tenantA, UserRole.ADMIN)))
        .contentType(MediaType.APPLICATION_JSON).body(disabled)
        .exchange().expectStatus().isOk().expectBody().jsonPath("$.verification").isEqualTo("MANUAL");
    client().get().uri("/api/v1/payment-methods?establishmentId=" + establishmentA)
        .headers(h -> h.setBearerAuth(token(adminA, tenantA, UserRole.ADMIN)))
        .exchange().expectStatus().isOk().expectBody()
        .jsonPath("$.length()").isEqualTo(1)
        .jsonPath("$[0].id").isEqualTo(localId.toString())
        .jsonPath("$[0].enabled").isEqualTo(false);
    assertThat(jdbc.queryForObject("select count(*) from payment where tenant_id = ?", Integer.class, tenantA)).isZero();
  }

  @Test
  void runtimeRoleRlsFailsClosedAndHistoryIsAppendOnly() {
    create(tenantA, adminA, null);
    create(tenantB, adminB, null);
    transactions.executeWithoutResult(status -> {
      jdbc.execute("set local role mapit_app");
      jdbc.queryForObject("select set_config('app.tenant_id', '', true)", String.class);
      assertThat(jdbc.queryForObject("select count(*) from merchant_payment_method", Integer.class)).isZero();
      jdbc.queryForObject("select set_config('app.tenant_id', ?, true)", String.class, tenantA);
      assertThat(jdbc.queryForObject("select count(*) from merchant_payment_method", Integer.class)).isEqualTo(1);
      assertThat(jdbc.queryForObject("select count(*) from merchant_payment_method where tenant_id = ?", Integer.class, tenantB)).isZero();
    });
    assertThatThrownBy(() -> transactions.executeWithoutResult(status -> {
      jdbc.execute("set local role mapit_app");
      jdbc.execute("delete from payment_verification");
    })).isInstanceOf(org.springframework.dao.DataAccessException.class);
    assertThatThrownBy(() -> transactions.executeWithoutResult(status -> {
      jdbc.execute("set local role mapit_app");
      jdbc.execute("update payment_webhook_event set outcome = 'CONFIRMED'");
    })).isInstanceOf(org.springframework.dao.DataAccessException.class);
  }

  @Test
  void invalidCountryAndFakeRasterAreRejected() {
    Map<String, Object> invalid = request(null);
    invalid.put("country", "ZZ");
    post(invalid).expectStatus().isBadRequest();
    invalid = request(null);
    invalid.put("staticQrImage", "data:image/png;base64,PGh0bWw+");
    post(invalid).expectStatus().isBadRequest();
  }

  @Test
  void staffNeedsExplicitVenueGrantAndRevocationIsTenantScoped() {
    UUID staff = UUID.randomUUID();
    jdbc.update("insert into app_user(id,tenant_id,email,password_hash,full_name,role) values(?,?,?,'unused','Operador','STAFF')",staff,tenantA,staff+"@example.test");
    String staffBearer=token(staff,tenantA,UserRole.STAFF);
    client().get().uri("/api/v1/establishments/accessible").headers(h->h.setBearerAuth(staffBearer))
        .exchange().expectStatus().isOk().expectBody().json("[]");
    String path="/api/v1/establishments/"+establishmentA+"/staff-access/"+staff;
    client().put().uri(path).headers(h->h.setBearerAuth(token(adminB,tenantB,UserRole.ADMIN)))
        .contentType(MediaType.APPLICATION_JSON).body(Map.of("canCheckIn",true)).exchange().expectStatus().isNotFound();
    client().put().uri(path).headers(h->h.setBearerAuth(token(adminA,tenantA,UserRole.ADMIN)))
        .contentType(MediaType.APPLICATION_JSON).body(Map.of("canCheckIn",true)).exchange().expectStatus().isOk();
    client().get().uri("/api/v1/establishments/accessible").headers(h->h.setBearerAuth(staffBearer))
        .exchange().expectStatus().isOk().expectBody().jsonPath("$.length()").isEqualTo(1)
        .jsonPath("$[0].id").isEqualTo(establishmentA.toString()).jsonPath("$[0].canCheckIn").isEqualTo(true)
        .jsonPath("$[0].canManagePayments").isEqualTo(false);
    client().put().uri(path).headers(h->h.setBearerAuth(token(adminA,tenantA,UserRole.ADMIN)))
        .contentType(MediaType.APPLICATION_JSON).body(Map.of("canCheckIn",false)).exchange().expectStatus().isOk();
    client().get().uri("/api/v1/establishments/accessible").headers(h->h.setBearerAuth(staffBearer))
        .exchange().expectStatus().isOk().expectBody().json("[]");
    transactions.executeWithoutResult(status->{
      jdbc.execute("set local role mapit_app");
      jdbc.queryForObject("select set_config('app.tenant_id','',true)",String.class);
      assertThat(jdbc.queryForObject("select count(*) from establishment_staff_access",Integer.class)).isZero();
      jdbc.queryForObject("select set_config('app.tenant_id',?,true)",String.class,tenantB);
      assertThat(jdbc.queryForObject("select count(*) from establishment_staff_access",Integer.class)).isZero();
    });
  }

  @Test
  void ledgerContainsOnlyRequestedVenueAndRequiresAdministrator() {
    UUID method=create(tenantA,adminA,null);
    UUID payment=seedConfirmedPayment(tenantA,adminA,establishmentA,method);
    UUID otherVenue=UUID.randomUUID();
    jdbc.update("insert into establishment(id,tenant_id,name,type,slug,timezone) values(?,?,'Otra sucursal','RESTAURANT','other-venue','UTC')",otherVenue,tenantA);
    seedConfirmedPayment(tenantA,adminA,otherVenue,method);
    String path="/api/v1/payments?establishmentId="+establishmentA+"&status=CONFIRMED&limit=1&offset=0";
    client().get().uri(path).headers(h->h.setBearerAuth(token(adminA,tenantA,UserRole.STAFF)))
        .exchange().expectStatus().isForbidden();
    client().get().uri(path).headers(h->h.setBearerAuth(token(adminB,tenantB,UserRole.ADMIN)))
        .exchange().expectStatus().isNotFound();
    client().get().uri(path).headers(h->h.setBearerAuth(token(adminA,tenantA,UserRole.ADMIN)))
        .exchange().expectStatus().isOk().expectBody().jsonPath("$.total").isEqualTo(1)
        .jsonPath("$.items[0].id").isEqualTo(payment.toString()).jsonPath("$.items[0].amount").isEqualTo("12.34")
        .jsonPath("$.items[0].establishmentId").isEqualTo(establishmentA.toString())
        .jsonPath("$.items[0].merchantReference").doesNotExist();
    client().get().uri("/api/v1/payments?establishmentId="+establishmentA+"&limit=101")
        .headers(h->h.setBearerAuth(token(adminA,tenantA,UserRole.ADMIN))).exchange().expectStatus().isBadRequest();
    client().get().uri("/api/v1/payments?establishmentId="+establishmentA+"&offset=1&limit=1")
        .headers(h->h.setBearerAuth(token(adminA,tenantA,UserRole.ADMIN))).exchange().expectStatus().isOk()
        .expectBody().jsonPath("$.total").isEqualTo(1).jsonPath("$.items.length()").isEqualTo(0);
  }

  private UUID seedConfirmedPayment(String tenant,UUID actor,UUID venue,UUID method) {
    UUID person=UUID.randomUUID(),reservation=UUID.randomUUID(),payment=UUID.randomUUID();
    jdbc.update("insert into person(id,tenant_id,full_name,created_by) values(?,?,'Cliente de ledger',?)",person,tenant,actor);
    jdbc.update("insert into reservation(id,tenant_id,establishment_id,person_id,starts_at,ends_at,status,created_by) values(?,?,?,?,now(),now()+interval '1 hour','CONFIRMED',?)",reservation,tenant,venue,person,actor);
    jdbc.update("""
        insert into payment(id,tenant_id,establishment_id,reservation_id,method_id,provider,merchant_reference,external_reference,
          amount,currency,status,created_at,expires_at,verified_at,verified_by,verification_source)
        values(?,?,?,?,?,'STATIC_BANK_QR','cuenta-empresa',?,'12.34','BOB','CONFIRMED',now(),now()+interval '1 hour',now(),?,'MANUAL')
        """,payment,tenant,venue,reservation,method,payment.toString(),actor);
    jdbc.update("update reservation set confirmed_payment_id=? where tenant_id=? and id=?",payment,tenant,reservation);
    return payment;
  }

  @Test
  void concurrentDuplicateEventsHaveOnePersistentEffect() throws Exception {
    UUID methodId = create(tenantA, adminA, null);
    // Fixture de un intento mock preexistente, con su método posteriormente deshabilitado.
    jdbc.update("update merchant_payment_method set provider='MOCK_GATEWAY',static_qr_image=null,enabled=false where id=?", methodId);
    UUID personId = UUID.randomUUID();
    UUID reservationId = UUID.randomUUID();
    Instant now = Instant.parse("2026-10-24T12:00:00Z");
    Clock clock = Clock.fixed(now, ZoneOffset.UTC);
    jdbc.update("insert into person(id,tenant_id,full_name,created_by) values (?,?,'Cliente',?)", personId, tenantA, adminA);
    jdbc.update("insert into reservation(id,tenant_id,establishment_id,person_id,starts_at,ends_at,created_by) values (?,?,?,?,now(),now()+interval '1 hour',?)",
        reservationId, tenantA, establishmentA, personId, adminA);
    Payment payment = new Payment(UUID.randomUUID(), TenantId.of(tenantA), establishmentA, reservationId,
        methodId, PaymentProvider.MOCK_GATEWAY, "merchant", "external-" + UUID.randomUUID(),
        new Money(BigDecimal.TEN, "BOB"), Payment.Status.PENDING, now, now.plusSeconds(600), null, null, null);
    transactions.executeWithoutResult(status -> paymentRepository.insert(payment));
    AtomicInteger confirmations = new AtomicInteger();
    // Contrato de reserva de prueba: acredita concurrencia JDBC, no integración HU-6.02.
    ReservationPaymentPort reservations = new ReservationPaymentPort() {
      public Quote quote(TenantId tenant, UUID id) { throw new UnsupportedOperationException(); }
      public boolean confirm(Payment received) { confirmations.incrementAndGet(); return true; }
    };
    PaymentService service = new PaymentService(paymentRepository, methodRepository, reservations,
        new MockPaymentGateway(true, Set.of("test"), clock), () -> Optional.of(TenantId.of(tenantA)),
        () -> Optional.of(adminA), clock);
    PaymentService.VerifiedEvent event = new PaymentService.VerifiedEvent(payment.tenantId(), payment.id(),
        payment.provider(), "duplicate-event", payment.externalReference(), payment.merchantReference(),
        payment.money(), Payment.Outcome.CONFIRMED);
    CountDownLatch ready = new CountDownLatch(2);
    CountDownLatch start = new CountDownLatch(1);
    try (var executor = Executors.newFixedThreadPool(2)) {
      java.util.concurrent.Callable<Payment> action = () -> {
        ready.countDown();
        if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("No se inició la carrera");
        return transactions.execute(status -> service.process(event));
      };
      var first = executor.submit(action);
      var second = executor.submit(action);
      assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
      start.countDown();
      assertThat(first.get(20, TimeUnit.SECONDS).status()).isEqualTo(Payment.Status.CONFIRMED);
      assertThat(second.get(20, TimeUnit.SECONDS).status()).isEqualTo(Payment.Status.CONFIRMED);
    }
    assertThat(confirmations.get()).isEqualTo(1);
    assertThat(jdbc.queryForObject("select count(*) from payment_webhook_event where payment_id=?", Integer.class, payment.id())).isEqualTo(1);
    assertThat(jdbc.queryForObject("select count(*) from payment_verification where payment_id=?", Integer.class, payment.id())).isEqualTo(1);
  }

  private RestTestClient.ResponseSpec post(Map<String, Object> body) {
    return client().post().uri("/api/v1/payment-methods")
        .headers(h -> h.setBearerAuth(token(adminA, tenantA, UserRole.ADMIN)))
        .contentType(MediaType.APPLICATION_JSON).body(body).exchange();
  }

  private UUID create(String tenant, UUID user, UUID establishment) {
    var response = client().post().uri("/api/v1/payment-methods")
        .headers(h -> h.setBearerAuth(token(user, tenant, UserRole.ADMIN)))
        .contentType(MediaType.APPLICATION_JSON).body(request(establishment))
        .exchange().expectStatus().isCreated().expectBody(MethodId.class).returnResult().getResponseBody();
    assertThat(response).isNotNull();
    return response.id();
  }

  private Map<String, Object> request(UUID establishment) {
    Map<String, Object> request = new HashMap<>();
    request.put("establishmentId", establishment);
    request.put("displayName", "Banco propio");
    request.put("country", "BO");
    request.put("currency", "BOB");
    request.put("provider", "STATIC_BANK_QR");
    request.put("bankName", "Banco de pruebas");
    request.put("accountReference", "cuenta-empresa");
    request.put("accountHolderName", "Empresa de prueba");
    request.put("staticQrImage", PNG);
    request.put("enabled", true);
    return request;
  }

  private RestTestClient client() {
    return RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
  }

  private String token(UUID user, String tenant, UserRole role) {
    return tokens.issue(new AuthenticatedUser(user, TenantId.of(tenant), "staff@payments.test", "Staff", role)).value();
  }

  record MethodId(UUID id) {}

  private void seed(String tenant, UUID user, UUID establishment) {
    jdbc.update("insert into tenant (id,name,slug,status,vertical) values (?,? ,?,'ACTIVE','RESTAURANT')", tenant, tenant, tenant);
    jdbc.update("insert into app_user (id,tenant_id,email,password_hash,full_name,role) values (?,?,'admin@payments.test','unused','Admin','ADMIN')", user, tenant);
    jdbc.update("insert into establishment (id,tenant_id,name,type,slug) values (?,?,'Local','RESTAURANT',?)", establishment, tenant, tenant);
  }
}
