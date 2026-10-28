package com.mapit.payments;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

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
import org.springframework.dao.DataAccessException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
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
import com.mapit.payments.domain.Payment;
import com.mapit.payments.infrastructure.MockWebhookAuthenticator;
import com.mapit.payments.infrastructure.MockWebhookCodec;
import com.mapit.shared.tenant.TenantId;

import tools.jackson.databind.ObjectMapper;

/** Flujo HTTP y PostgreSQL reales; solo el proveedor es un mock explícito sin dinero real. */
@Tag("integration")
@ActiveProfiles("test")
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@Import(PublicPaymentFlowIntegrationTest.FixedTime.class)
class PublicPaymentFlowIntegrationTest {
  private static final Instant NOW=Instant.parse("2030-06-15T12:00:00Z");
  @Container
  static final PostgreSQLContainer<?> POSTGRES=new PostgreSQLContainer<>("postgres:17-alpine")
      .withDatabaseName("mapit").withUsername("mapit").withPassword("integration_owner_password");
  @LocalServerPort int port;
  @Autowired JdbcTemplate jdbc;
  @Autowired AccessTokenIssuer tokens;
  @Autowired TransactionTemplate transactions;
  @Autowired ObjectMapper json;
  String tenant;
  String foreignTenant;
  UUID admin;
  UUID staff;
  UUID foreignStaff;
  UUID venue;
  UUID foreignVenue;
  UUID firstElement;
  UUID secondElement;
  UUID method;
  UUID qrConfiguration;

  @DynamicPropertySource static void configuration(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url",POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username",POSTGRES::getUsername);
    registry.add("spring.datasource.password",POSTGRES::getPassword);
    registry.add("spring.flyway.url",POSTGRES::getJdbcUrl);
    registry.add("spring.flyway.user",POSTGRES::getUsername);
    registry.add("spring.flyway.password",POSTGRES::getPassword);
    registry.add("spring.flyway.placeholders.mapitAppDbPassword",()->"integration_runtime_password");
    registry.add("mapit.unleash.enabled",()->"false");
    registry.add("mapit.payments.mock.enabled",()->"true");
    registry.add("mapit.payments.mock.webhook-secret",()->"integration_mock_secret_012345678901234567890123456789");
    registry.add("mapit.realtime.outbox.poll-interval-ms",()->"3600000");
    registry.add("mapit.realtime.outbox.cleanup-interval-ms",()->"3600000");
  }

  @BeforeEach void seed() {
    tenant="flow-"+UUID.randomUUID();
    foreignTenant="flow-"+UUID.randomUUID();
    admin=UUID.randomUUID(); staff=UUID.randomUUID(); foreignStaff=UUID.randomUUID();
    venue=UUID.randomUUID(); foreignVenue=UUID.randomUUID();
    firstElement=UUID.randomUUID(); secondElement=UUID.randomUUID();
    seedTenant(tenant,venue);
    seedTenant(foreignTenant,foreignVenue);
    user(admin,tenant,UserRole.ADMIN);
    user(staff,tenant,UserRole.STAFF);
    user(foreignStaff,foreignTenant,UserRole.STAFF);
    jdbc.update("insert into establishment_staff_access(tenant_id,establishment_id,user_id,can_check_in,updated_at,updated_by) values(?,?,?,true,now(),?)",tenant,venue,staff,admin);
    jdbc.update("insert into establishment_staff_access(tenant_id,establishment_id,user_id,can_check_in,updated_at,updated_by) values(?,?,?,true,now(),?)",foreignTenant,foreignVenue,foreignStaff,foreignStaff);
    UUID floor=UUID.randomUUID();
    UUID sector=UUID.randomUUID();
    jdbc.update("insert into floor(id,tenant_id,establishment_id,name,level) values(?,?,?,'Piso real',0)",floor,tenant,venue);
    jdbc.update("insert into sector(id,tenant_id,floor_id,name,max_capacity) values(?,?,?,'Sector real',10)",sector,tenant,floor);
    for(UUID element:List.of(firstElement,secondElement)) {
      jdbc.update("insert into space_element(id,tenant_id,sector_id,type,state,x,y) values(?,?,?,'TABLE','AVAILABLE',1,1)",element,tenant,sector);
    }
    client().put().uri("/api/v1/establishments/"+venue+"/payment-policy")
        .headers(h->h.setBearerAuth(bearer(admin,tenant,UserRole.ADMIN)))
        .contentType(MediaType.APPLICATION_JSON)
        .body(Map.of("enabled",true,"currency","BOB","depositAmount","120.00","totalAmount","400.00","paymentWindowMinutes",30))
        .exchange().expectStatus().isOk();
    client().post().uri("/api/v1/payment-methods/mock-qr")
        .headers(h->h.setBearerAuth(bearer(admin,tenant,UserRole.ADMIN)))
        .contentType(MediaType.APPLICATION_JSON).body(mockQrRequest())
        .exchange().expectStatus().isCreated();
    qrConfiguration=jdbc.queryForObject("select id from mock_qr_configuration where tenant_id=? and establishment_id=?",UUID.class,tenant,venue);
    method=jdbc.queryForObject("select id from merchant_payment_method where tenant_id=? and establishment_id=? and mock_qr_configuration_id is not null and superseded_at is null",
        UUID.class,tenant,venue);
  }

  @Test void reserva_pago_webhook_comprobante_y_llegadas_concurrentes_son_persistentes_e_idempotentes() throws Exception {
    Booking booking=book("12:15","13:15");
    assertThat(booking.accessToken()).matches("[A-Za-z0-9_-]{43}");
    assertThat(booking.accessExpiresAt()).isEqualTo(Instant.parse("2030-06-16T13:15:00Z"));
    assertThat(jdbc.queryForObject("select token_hash from reservation_access where tenant_id=? and reservation_id=?",String.class,tenant,booking.id()))
        .matches("[a-f0-9]{64}").isNotEqualTo(booking.accessToken());
    client().get().uri(scope(booking)+"/checkout").header("X-Reservation-Access",booking.accessToken())
        .exchange().expectStatus().isOk().expectBody().jsonPath("$.amount").isEqualTo("120.00")
        .jsonPath("$.currency").isEqualTo("BOB").jsonPath("$.reservation.status").isEqualTo("CREATED")
        .jsonPath("$.reservation.personId").doesNotExist()
        .jsonPath("$.methods[0].provider").isEqualTo("MOCK_GATEWAY")
        .jsonPath("$.methods[0].simulationPath").isEqualTo("/simulacion/qr/" +
            jdbc.queryForObject("select simulation_token from mock_qr_configuration where tenant_id=? and establishment_id=?",UUID.class,tenant,venue))
        .jsonPath("$.methods[0].bankName").doesNotExist()
        .jsonPath("$.methods[0].accountReference").doesNotExist();
    UUID requestId=UUID.randomUUID();
    IdResponse attempt=start(booking,requestId);
    assertThat(start(booking,requestId).id()).isEqualTo(attempt.id());
    assertThat(start(booking,UUID.randomUUID()).id()).isEqualTo(attempt.id());
    assertThat(jdbc.queryForObject("select count(*) from payment where tenant_id=? and reservation_id=?",Integer.class,tenant,booking.id())).isEqualTo(1);
    UUID historicalMethod=method;
    Map<String,Object> changedConfiguration=mockQrRequest();
    changedConfiguration.put("bankName","Banco actualizado");
    client().put().uri("/api/v1/payment-methods/mock-qr/"+qrConfiguration)
        .headers(h->h.setBearerAuth(bearer(admin,tenant,UserRole.ADMIN)))
        .contentType(MediaType.APPLICATION_JSON).body(changedConfiguration).exchange().expectStatus().isOk();
    method=jdbc.queryForObject("select id from merchant_payment_method where tenant_id=? and mock_qr_configuration_id=? and superseded_at is null",
        UUID.class,tenant,qrConfiguration);
    assertThat(method).isNotEqualTo(historicalMethod);
    assertThat(jdbc.queryForObject("select superseded_at from merchant_payment_method where id=?",java.sql.Timestamp.class,historicalMethod)).isNotNull();
    assertThat(jdbc.queryForObject("select bank_name from merchant_payment_method where id=?",String.class,historicalMethod))
        .isEqualTo("Mock sin dinero real");
    client().get().uri(scope(booking)+"/checkout").header("X-Reservation-Access",booking.accessToken())
        .exchange().expectStatus().isOk().expectBody().jsonPath("$.available").isEqualTo(false)
        .jsonPath("$.unavailableReason").isEqualTo("PAYMENT_PENDING")
        .jsonPath("$.methods.length()").isEqualTo(0)
        .jsonPath("$.historicalMethod.id").isEqualTo(historicalMethod.toString())
        .jsonPath("$.historicalMethod.simulationPath").isEqualTo("/simulacion/qr/"+
            jdbc.queryForObject("select simulation_token from mock_qr_configuration where tenant_id=? and establishment_id=?",UUID.class,tenant,venue))
        .jsonPath("$.payment.id").isEqualTo(attempt.id().toString());
    client().post().uri(scope(booking)+"/payments").header("X-Reservation-Access",booking.accessToken())
        .contentType(MediaType.APPLICATION_JSON).body(Map.of("methodId",method,"requestId",UUID.randomUUID()))
        .exchange().expectStatus().isEqualTo(409);
    client().post().uri(scope(booking)+"/receipt").header("X-Reservation-Access",booking.accessToken())
        .exchange().expectStatus().isNotFound();
    UUID event=UUID.randomUUID();
    simulate(booking,attempt.id(),event);
    simulate(booking,attempt.id(),event);
    assertThat(count("payment_webhook_event","payment_id",attempt.id())).isEqualTo(1);
    assertThat(count("payment_verification","payment_id",attempt.id())).isEqualTo(1);
    assertThat(reservationStatus(booking)).isEqualTo("CONFIRMED");
    assertThat(elementStates()).containsExactly("AVAILABLE","AVAILABLE");
    Receipt issued=issueReceipt(booking);
    assertThat(issued.token()).matches("[A-Za-z0-9_-]{43}").isNotEqualTo(booking.accessToken());
    assertThat(issued.paidAmount()).isEqualTo("120.00");
    assertThat(issued.balanceAmount()).isEqualTo("280.00");
    client().get().uri(venuePath()+"/receipts/"+issued.token()).exchange().expectStatus().isOk()
        .expectBody().jsonPath("$.token").doesNotExist().jsonPath("$.url").doesNotExist()
        .jsonPath("$.reservation.status").isEqualTo("CONFIRMED");
    client().post().uri(checkInPath()+"/lookup")
        .headers(h->h.setBearerAuth(bearer(staff,tenant,UserRole.STAFF)))
        .contentType(MediaType.APPLICATION_JSON).body(Map.of("token",issued.token()))
        .exchange().expectStatus().isOk().expectBody().jsonPath("$.receipt.checkIn").isEqualTo("NOT_CHECKED_IN");
    assertThat(reservationStatus(booking)).isEqualTo("CONFIRMED");
    CountDownLatch ready=new CountDownLatch(2);
    CountDownLatch start=new CountDownLatch(1);
    try(var executor=Executors.newFixedThreadPool(2)) {
      java.util.concurrent.Callable<Integer> arrival=()->{
        ready.countDown();
        if(!start.await(10,TimeUnit.SECONDS)) throw new IllegalStateException("Carrera no iniciada");
        return arriveStatus(issued.token(),venue,staff,tenant);
      };
      var first=executor.submit(arrival); var second=executor.submit(arrival);
      assertThat(ready.await(10,TimeUnit.SECONDS)).isTrue(); start.countDown();
      assertThat(first.get(20,TimeUnit.SECONDS)).isEqualTo(200);
      assertThat(second.get(20,TimeUnit.SECONDS)).isEqualTo(200);
    }
    assertThat(arriveStatus(issued.token(),venue,staff,tenant)).isEqualTo(200);
    assertThat(reservationStatus(booking)).isEqualTo("ACTIVE");
    assertThat(elementStates()).containsExactly("OCCUPIED","OCCUPIED");
    assertThat(count("reservation_event","reservation_id",booking.id())).isEqualTo(2);
    assertThat(jdbc.queryForObject("select count(*) from reservation_event where tenant_id=? and reservation_id=? and event_type='CHECKED_IN'",Integer.class,tenant,booking.id())).isEqualTo(1);
    assertThat(jdbc.queryForObject("select checked_in_by from reservation where tenant_id=? and id=?",UUID.class,tenant,booking.id())).isEqualTo(staff);
    assertThat(jdbc.queryForObject("select count(*) from space_element_state_change where tenant_id=?",Integer.class,tenant)).isEqualTo(2);
    assertThat(jdbc.queryForObject("select count(*) from realtime_event_outbox where tenant_id=? and event_type='space-element.state.changed.v1'",Integer.class,tenant)).isEqualTo(2);
  }

  @Test void catalogo_publico_busca_establecimientos_reales_sin_ratings_inventados() {
    client().get().uri("/api/v1/public/establishments?query="+tenant).exchange().expectStatus().isOk()
        .expectBody().jsonPath("$.length()").isEqualTo(1)
        .jsonPath("$[0].tenantSlug").isEqualTo(tenant)
        .jsonPath("$[0].establishmentSlug").isEqualTo("venue")
        .jsonPath("$[0].rating").doesNotExist();
    client().get().uri("/api/v1/public/establishments?query=missing-"+UUID.randomUUID())
        .exchange().expectStatus().isOk().expectBody().json("[]");
  }

  @Test void starts_concurrentes_con_requestIds_distintos_reutilizan_un_solo_intento_mock() throws Exception {
    Booking booking=book("12:15","13:15");
    CountDownLatch ready=new CountDownLatch(2);
    CountDownLatch start=new CountDownLatch(1);
    try(var executor=Executors.newFixedThreadPool(2)) {
      java.util.concurrent.Callable<UUID> begin=()->{
        ready.countDown();
        if(!start.await(10,TimeUnit.SECONDS)) throw new IllegalStateException("Carrera no iniciada");
        return start(booking,UUID.randomUUID()).id();
      };
      var first=executor.submit(begin); var second=executor.submit(begin);
      assertThat(ready.await(10,TimeUnit.SECONDS)).isTrue(); start.countDown();
      assertThat(first.get(20,TimeUnit.SECONDS)).isEqualTo(second.get(20,TimeUnit.SECONDS));
    }
    assertThat(jdbc.queryForObject("select count(*) from payment where tenant_id=? and reservation_id=?",Integer.class,tenant,booking.id())).isEqualTo(1);
  }

  @Test void alias_de_request_reutilizado_se_conserva_despues_de_fallar_el_pago() {
    Booking booking=book("12:15","13:15");
    UUID firstRequest=UUID.randomUUID();
    UUID reusedRequest=UUID.randomUUID();
    IdResponse first=start(booking,firstRequest);
    assertThat(start(booking,reusedRequest).id()).isEqualTo(first.id());

    simulateOutcome(booking,first.id(),UUID.randomUUID(),"FAILED");

    assertThat(start(booking,reusedRequest).id()).isEqualTo(first.id());
    assertThat(start(booking,firstRequest).id()).isEqualTo(first.id());
    assertThat(jdbc.queryForObject("select request_id from payment where tenant_id=? and id=?",UUID.class,tenant,first.id()))
        .isEqualTo(firstRequest);
    assertThat(jdbc.queryForObject("select count(*) from payment_request_alias where tenant_id=? and reservation_id=? and payment_id=?",
        Integer.class,tenant,booking.id(),first.id())).isEqualTo(2);
    assertThat(jdbc.queryForObject("select count(*) from payment where tenant_id=? and reservation_id=?",Integer.class,tenant,booking.id())).isEqualTo(1);
    UUID aliasId=jdbc.queryForObject("select id from payment_request_alias where tenant_id=? and reservation_id=? and request_id=?",
        UUID.class,tenant,booking.id(),reusedRequest);
    assertThatThrownBy(()->jdbc.update("insert into payment_request_alias(id,tenant_id,reservation_id,request_id,payment_id) values(?,?,?,?,?)",
        UUID.randomUUID(),tenant,booking.id(),reusedRequest,first.id())).isInstanceOf(DataAccessException.class);
    assertThat(jdbc.queryForObject("select payment_id from payment_request_alias where tenant_id=? and id=?",UUID.class,tenant,aliasId))
        .isEqualTo(first.id());
  }

  @Test void UUID_y_credencial_de_otro_ambito_no_autorizan_lectura_ni_llegada() {
    Booking booking=book("12:15","13:15");
    client().get().uri(scope(booking)+"/checkout").exchange().expectStatus().isBadRequest();
    client().get().uri(scope(booking)+"/checkout").header("X-Reservation-Access","A".repeat(43))
        .exchange().expectStatus().isNotFound();
    client().get().uri("/api/v1/public/tenants/"+foreignTenant+"/establishments/venue/reservations/"+booking.id()+"/checkout")
        .header("X-Reservation-Access",booking.accessToken()).exchange().expectStatus().isNotFound();
    IdResponse attempt=start(booking,UUID.randomUUID()); simulate(booking,attempt.id(),UUID.randomUUID());
    Receipt receipt=issueReceipt(booking);
    client().post().uri(checkInPath()).contentType(MediaType.APPLICATION_JSON).body(Map.of("token",receipt.token()))
        .exchange().expectStatus().isUnauthorized();
    assertThat(arriveStatus(receipt.token(),foreignVenue,foreignStaff,foreignTenant)).isEqualTo(404);
    assertThat(arriveStatus("A".repeat(43),venue,staff,tenant)).isEqualTo(404);
    assertThat(reservationStatus(booking)).isEqualTo("CONFIRMED");
    assertThat(elementStates()).containsExactly("AVAILABLE","AVAILABLE");
    client().post().uri("/api/v1/public/payments/mock/webhook").header("X-Mock-Timestamp",Long.toString(NOW.getEpochSecond()))
        .header("X-Mock-Signature","0".repeat(64)).contentType(MediaType.APPLICATION_JSON).body("{}")
        .exchange().expectStatus().isUnauthorized();
  }

  @Test void ingreso_autenticado_con_comercio_suspendido_se_registra_para_conciliacion() {
    Booking booking=book("12:15","13:15");
    IdResponse payment=start(booking,UUID.randomUUID());
    String external=jdbc.queryForObject("select external_reference from payment where tenant_id=? and id=?",String.class,tenant,payment.id());
    String merchant=jdbc.queryForObject("select merchant_reference from payment where tenant_id=? and id=?",String.class,tenant,payment.id());
    byte[] body=json.writeValueAsBytes(new MockWebhookCodec.Wire(tenant,payment.id(),UUID.randomUUID().toString(),
        external,merchant,new BigDecimal("120.00"),"BOB",Payment.Outcome.CONFIRMED));
    MockWebhookAuthenticator auth=new MockWebhookAuthenticator(
        "integration_mock_secret_012345678901234567890123456789".getBytes(StandardCharsets.UTF_8),Clock.fixed(NOW,ZoneOffset.UTC));
    jdbc.update("update tenant set status='SUSPENDED' where id=?",tenant);
    client().post().uri("/api/v1/public/payments/mock/webhook")
        .header("X-Mock-Timestamp",Long.toString(NOW.getEpochSecond()))
        .header("X-Mock-Signature",auth.sign(NOW.getEpochSecond(),body))
        .contentType(MediaType.APPLICATION_JSON).body(body).exchange().expectStatus().isOk()
        .expectBody().jsonPath("$.status").isEqualTo("RECONCILIATION_REQUIRED");
    assertThat(count("payment_webhook_event","payment_id",payment.id())).isEqualTo(1);
    assertThat(count("payment_verification","payment_id",payment.id())).isEqualTo(1);
    assertThat(reservationStatus(booking)).isEqualTo("CREATED");
    assertThat(elementStates()).containsExactly("AVAILABLE","AVAILABLE");
  }

  @Test void fuera_de_ventana_no_activa_ni_ocupa_y_RLS_falla_cerrado() {
    Booking booking=book("13:00","14:00");
    IdResponse attempt=start(booking,UUID.randomUUID()); simulate(booking,attempt.id(),UUID.randomUUID());
    Receipt receipt=issueReceipt(booking);
    assertThat(arriveStatus(receipt.token(),venue,staff,tenant)).isEqualTo(409);
    assertThat(reservationStatus(booking)).isEqualTo("CONFIRMED");
    assertThat(elementStates()).containsExactly("AVAILABLE","AVAILABLE");
    transactions.executeWithoutResult(status->{
      jdbc.execute("set local role mapit_app");
      jdbc.queryForObject("select set_config('app.tenant_id','',true)",String.class);
      for(String table:List.of("reservation_access","reservation_event","payment_receipt","reservation_payment_quote","payment_request_alias"))
        assertThat(jdbc.queryForObject("select count(*) from "+table,Integer.class)).isZero();
      jdbc.queryForObject("select set_config('app.tenant_id',?,true)",String.class,foreignTenant);
      assertThat(jdbc.queryForObject("select count(*) from reservation_access where reservation_id=?",Integer.class,booking.id())).isZero();
      jdbc.queryForObject("select set_config('app.tenant_id',?,true)",String.class,tenant);
      assertThat(jdbc.queryForObject("select count(*) from reservation_access where reservation_id=?",Integer.class,booking.id())).isEqualTo(1);
    });
    assertThatThrownBy(()->transactions.executeWithoutResult(status->{
      jdbc.execute("set local role mapit_app");
      jdbc.queryForObject("select set_config('app.tenant_id',?,true)",String.class,tenant);
      jdbc.update("delete from reservation_event where reservation_id=?",booking.id());
    })).isInstanceOf(DataAccessException.class);
    assertThatThrownBy(()->transactions.executeWithoutResult(status->{
      jdbc.execute("set local role mapit_app");
      jdbc.queryForObject("select set_config('app.tenant_id',?,true)",String.class,tenant);
      jdbc.update("delete from payment_request_alias where reservation_id=?",booking.id());
    })).isInstanceOf(DataAccessException.class);
  }

  @Test void cancelacion_concurrente_persiste_historial_no_toca_reserva_y_reintento_no_renueva_cotizacion() throws Exception {
    Booking booking=book("12:15","13:15");
    UUID request=UUID.randomUUID(), event=UUID.randomUUID();
    IdResponse first=start(booking,request);
    var snapshot=jdbc.queryForMap("select amount,currency,expires_at from payment where tenant_id=? and id=?",tenant,first.id());
    CountDownLatch ready=new CountDownLatch(2), go=new CountDownLatch(1);
    try(var executor=Executors.newFixedThreadPool(2)) {
      java.util.concurrent.Callable<Void> cancel=()->{
        ready.countDown();
        if(!go.await(10,TimeUnit.SECONDS)) throw new IllegalStateException("Carrera no iniciada");
        simulateOutcome(booking,first.id(),event,"CANCELLED");
        return null;
      };
      var a=executor.submit(cancel); var b=executor.submit(cancel);
      assertThat(ready.await(10,TimeUnit.SECONDS)).isTrue(); go.countDown();
      a.get(20,TimeUnit.SECONDS); b.get(20,TimeUnit.SECONDS);
    }
    assertThat(count("payment_webhook_event","payment_id",first.id())).isEqualTo(1);
    assertThat(count("payment_verification","payment_id",first.id())).isZero();
    assertThat(reservationStatus(booking)).isEqualTo("CREATED");
    assertThat(elementStates()).containsExactly("AVAILABLE","AVAILABLE");
    assertThat(count("reservation_event","reservation_id",booking.id())).isZero();
    assertThat(jdbc.queryForObject("select count(*) from realtime_event_outbox where tenant_id=? and event_type='payment.status.changed' and payload::jsonb->>'status'='CANCELLED'",Integer.class,tenant)).isEqualTo(1);
    client().get().uri(scope(booking)+"/checkout").header("X-Reservation-Access",booking.accessToken())
        .exchange().expectStatus().isOk().expectBody().jsonPath("$.payment.status").isEqualTo("CANCELLED")
        .jsonPath("$.available").isEqualTo(true).jsonPath("$.historicalMethod").isEmpty();
    client().post().uri(scope(booking)+"/receipt").header("X-Reservation-Access",booking.accessToken())
        .exchange().expectStatus().isNotFound();
    assertThat(start(booking,request).id()).isEqualTo(first.id());
    webhook(first.id(),event,"FAILED",400,"CANCELLED");
    webhook(first.id(),UUID.randomUUID(),"EXPIRED",200,"CANCELLED");
    jdbc.update("update payment_policy set deposit_amount=200,payment_window_minutes=120 where tenant_id=? and establishment_id=?",tenant,venue);
    IdResponse retry=start(booking,UUID.randomUUID());
    assertThat(retry.id()).isNotEqualTo(first.id());
    assertThat(jdbc.queryForMap("select amount,currency,expires_at from payment where tenant_id=? and id=?",tenant,retry.id())).isEqualTo(snapshot);
    simulate(booking,retry.id(),UUID.randomUUID());
    webhook(retry.id(),UUID.randomUUID(),"CANCELLED",200,"CONFIRMED");
    assertThat(reservationStatus(booking)).isEqualTo("CONFIRMED");
    assertThat(elementStates()).containsExactly("AVAILABLE","AVAILABLE");
    assertThat(jdbc.queryForObject("select status from payment where tenant_id=? and id=?",String.class,tenant,first.id())).isEqualTo("CANCELLED");
    assertThat(jdbc.queryForObject("select count(*) from payment where tenant_id=? and reservation_id=?",Integer.class,tenant,booking.id())).isEqualTo(2);
  }

  @Test void ingreso_sobre_cancelado_requiere_conciliacion_sin_confirmar_ni_ocupar() {
    Booking booking=book("12:15","13:15");
    IdResponse first=start(booking,UUID.randomUUID());
    simulateOutcome(booking,first.id(),UUID.randomUUID(),"CANCELLED");
    webhook(first.id(),UUID.randomUUID(),"CONFIRMED",200,"RECONCILIATION_REQUIRED");
    assertThat(reservationStatus(booking)).isEqualTo("CREATED");
    assertThat(elementStates()).containsExactly("AVAILABLE","AVAILABLE");
    assertThat(count("payment_verification","payment_id",first.id())).isEqualTo(1);
    client().get().uri(scope(booking)+"/checkout").header("X-Reservation-Access",booking.accessToken())
        .exchange().expectStatus().isOk().expectBody().jsonPath("$.available").isEqualTo(false)
        .jsonPath("$.payment.status").isEqualTo("RECONCILIATION_REQUIRED");
    client().post().uri(scope(booking)+"/receipt").header("X-Reservation-Access",booking.accessToken())
        .exchange().expectStatus().isNotFound();
  }

  @Test void sede_y_tenant_cruzados_y_capabilities_revocadas_o_vencidas_fallan_cerrado() {
    Booking booking=book("12:15","13:15");
    IdResponse attempt=start(booking,UUID.randomUUID());
    UUID sibling=UUID.randomUUID();
    jdbc.update("insert into establishment(id,tenant_id,name,type,slug,timezone) values(?,?,'Otra sede','RESTAURANT','other','UTC')",sibling,tenant);
    for(String path:List.of("/api/v1/public/tenants/"+foreignTenant+"/establishments/venue", "/api/v1/public/tenants/"+tenant+"/establishments/other")) {
      String scope=path+"/reservations/"+booking.id();
      client().get().uri(scope+"/checkout").header("X-Reservation-Access",booking.accessToken()).exchange().expectStatus().isNotFound();
      client().post().uri(scope+"/payments").header("X-Reservation-Access",booking.accessToken())
          .contentType(MediaType.APPLICATION_JSON).body(Map.of("methodId",method,"requestId",UUID.randomUUID())).exchange().expectStatus().isNotFound();
      client().post().uri(scope+"/payments/"+attempt.id()+"/simulate").header("X-Reservation-Access",booking.accessToken())
          .contentType(MediaType.APPLICATION_JSON).body(Map.of("outcome","CANCELLED")).exchange().expectStatus().isNotFound();
      client().post().uri(scope+"/receipt").header("X-Reservation-Access",booking.accessToken()).exchange().expectStatus().isNotFound();
    }
    simulate(booking,attempt.id(),UUID.randomUUID());
    Receipt receipt=issueReceipt(booking);
    for(String path:List.of("/api/v1/public/tenants/"+foreignTenant+"/establishments/venue", "/api/v1/public/tenants/"+tenant+"/establishments/other")) {
      client().get().uri(path+"/receipts/"+receipt.token()).exchange().expectStatus().isNotFound();
    }
    jdbc.update("update reservation_access set revoked_at=? where tenant_id=? and reservation_id=?",java.sql.Timestamp.from(NOW),tenant,booking.id());
    client().get().uri(scope(booking)+"/checkout").header("X-Reservation-Access",booking.accessToken()).exchange().expectStatus().isNotFound();
    jdbc.update("update reservation_access set revoked_at=null,created_at=?,expires_at=? where tenant_id=? and reservation_id=?",java.sql.Timestamp.from(NOW.minusSeconds(60)),java.sql.Timestamp.from(NOW),tenant,booking.id());
    client().get().uri(scope(booking)+"/checkout").header("X-Reservation-Access",booking.accessToken()).exchange().expectStatus().isNotFound();
    jdbc.update("update payment_receipt set revoked_at=? where tenant_id=? and token_hash=?",java.sql.Timestamp.from(NOW),tenant,com.mapit.payments.domain.receipt.ReceiptToken.hashOf(receipt.token()));
    client().get().uri(venuePath()+"/receipts/"+receipt.token()).exchange().expectStatus().isNotFound();
    jdbc.update("update payment_receipt set revoked_at=null,created_at=?,expires_at=? where tenant_id=? and token_hash=?",java.sql.Timestamp.from(NOW.minusSeconds(60)),java.sql.Timestamp.from(NOW),tenant,com.mapit.payments.domain.receipt.ReceiptToken.hashOf(receipt.token()));
    client().get().uri(venuePath()+"/receipts/"+receipt.token()).exchange().expectStatus().isNotFound();
    assertThat(reservationStatus(booking)).isEqualTo("CONFIRMED");
    assertThat(elementStates()).containsExactly("AVAILABLE","AVAILABLE");
  }

  private void webhook(UUID payment,UUID event,String outcome,int expectedStatus,String expectedPaymentStatus) {
    var saved=jdbc.queryForMap("select external_reference,merchant_reference from payment where tenant_id=? and id=?",tenant,payment);
    byte[] body=json.writeValueAsBytes(new MockWebhookCodec.Wire(tenant,payment,event.toString(),
        (String)saved.get("external_reference"),(String)saved.get("merchant_reference"),new BigDecimal("120.00"),"BOB",Payment.Outcome.valueOf(outcome)));
    var auth=new MockWebhookAuthenticator("integration_mock_secret_012345678901234567890123456789".getBytes(StandardCharsets.UTF_8),Clock.fixed(NOW,ZoneOffset.UTC));
    client().post().uri("/api/v1/public/payments/mock/webhook").header("X-Mock-Timestamp",Long.toString(NOW.getEpochSecond()))
        .header("X-Mock-Signature",auth.sign(NOW.getEpochSecond(),body)).contentType(MediaType.APPLICATION_JSON).body(body)
        .exchange().expectStatus().isEqualTo(expectedStatus);
    assertThat(jdbc.queryForObject("select status from payment where tenant_id=? and id=?",String.class,tenant,payment)).isEqualTo(expectedPaymentStatus);
  }

  @Test void descriptor_vigente_y_soft_deleted_referenciado_sigue_en_checkout_y_recibo_propio() {
    Booking booking=book("12:15","13:15");
    jdbc.update("update space_element set label='Mesa Jardín',capacity=6 where tenant_id=? and id=?",tenant,firstElement);
    IdResponse attempt=start(booking,UUID.randomUUID());
    simulate(booking,attempt.id(),UUID.randomUUID());
    Receipt receipt=issueReceipt(booking);
    jdbc.update("update space_element set label='Jardín renombrado',deleted_at=now() where tenant_id=? and id=?",tenant,firstElement);
    jdbc.update("update sector set deleted_at=now() where tenant_id=?",tenant);
    jdbc.update("update floor set deleted_at=now() where tenant_id=?",tenant);
    for(String path:List.of(scope(booking)+"/checkout",venuePath()+"/receipts/"+receipt.token())) {
      client().get().uri(path).header("X-Reservation-Access",booking.accessToken())
          .exchange().expectStatus().isOk().expectBody()
          .jsonPath("$.reservation.spaces.length()").isEqualTo(2)
          .jsonPath("$.reservation.spaces[?(@.id=='"+firstElement+"')].name").isEqualTo("Jardín renombrado")
          .jsonPath("$.reservation.spaces[?(@.id=='"+firstElement+"')].capacity").isEqualTo(6);
    }
    client().get().uri(venuePath()+"/availability/map?date=2030-06-15&startTime=12:15&endTime=13:15")
        .exchange().expectStatus().isOk().expectBody().jsonPath("$.floors").isEmpty();
    client().get().uri("/api/v1/public/tenants/"+foreignTenant+"/establishments/venue/receipts/"+receipt.token())
        .exchange().expectStatus().isNotFound();
    assertThat(reservationStatus(booking)).isEqualTo("CONFIRMED");
    assertThat(elementStates()).containsExactly("AVAILABLE","AVAILABLE");
  }

  private Booking book(String start,String end) {
    Booking booking=client().post().uri(venuePath()+"/reservations").contentType(MediaType.APPLICATION_JSON)
        .body(Map.of("date","2030-06-15","startTime",start,"endTime",end,"spaceElementIds",List.of(firstElement,secondElement),
            "customer",Map.of("fullName","Cliente de integración","email","guest@example.test")))
        .exchange().expectStatus().isCreated().expectHeader().valueEquals("Cache-Control","no-store")
        .expectBody(Booking.class).returnResult().getResponseBody();
    assertThat(booking).isNotNull(); return booking;
  }
  private IdResponse start(Booking booking,UUID request) {
    IdResponse payment=client().post().uri(scope(booking)+"/payments").header("X-Reservation-Access",booking.accessToken())
        .contentType(MediaType.APPLICATION_JSON).body(Map.of("methodId",method,"requestId",request))
        .exchange().expectStatus().isCreated().expectBody(IdResponse.class).returnResult().getResponseBody();
    assertThat(payment).isNotNull(); return payment;
  }
  private void simulate(Booking booking,UUID payment,UUID event) {
    simulateOutcome(booking,payment,event,"CONFIRMED");
  }
  private void simulateOutcome(Booking booking,UUID payment,UUID event,String outcome) {
    client().post().uri(scope(booking)+"/payments/"+payment+"/simulate").header("X-Reservation-Access",booking.accessToken())
        .contentType(MediaType.APPLICATION_JSON).body(Map.of("outcome",outcome,"eventId",event))
        .exchange().expectStatus().isOk().expectBody().jsonPath("$.status").isEqualTo(outcome);
  }
  private Receipt issueReceipt(Booking booking) {
    Receipt receipt=client().post().uri(scope(booking)+"/receipt").header("X-Reservation-Access",booking.accessToken())
        .exchange().expectStatus().isCreated().expectBody(Receipt.class).returnResult().getResponseBody();
    assertThat(receipt).isNotNull(); return receipt;
  }
  private int arriveStatus(String token,UUID establishment,UUID operator,String operatorTenant) {
    return client().post().uri("/api/v1/establishments/"+establishment+"/check-ins")
        .headers(h->h.setBearerAuth(bearer(operator,operatorTenant,UserRole.STAFF)))
        .contentType(MediaType.APPLICATION_JSON).body(Map.of("token",token))
        .exchange().returnResult(Void.class).getStatus().value();
  }
  private List<String> elementStates() {
    return jdbc.queryForList("select state from space_element where tenant_id=? order by id",String.class,tenant);
  }
  private String reservationStatus(Booking booking) {
    return jdbc.queryForObject("select status from reservation where tenant_id=? and id=?",String.class,tenant,booking.id());
  }
  private int count(String table,String column,UUID id) {
    return jdbc.queryForObject("select count(*) from "+table+" where tenant_id=? and "+column+"=?",Integer.class,tenant,id);
  }
  private String venuePath() { return "/api/v1/public/tenants/"+tenant+"/establishments/venue"; }
  private String scope(Booking booking) { return venuePath()+"/reservations/"+booking.id(); }
  private String checkInPath() { return "/api/v1/establishments/"+venue+"/check-ins"; }
  private RestTestClient client() { return RestTestClient.bindToServer().baseUrl("http://localhost:"+port).build(); }
  private String bearer(UUID user,String userTenant,UserRole role) {
    return tokens.issue(new AuthenticatedUser(user,TenantId.of(userTenant),"operator@example.test","Operador",role)).value();
  }
  private Map<String,Object> mockQrRequest() {
    Map<String,Object> value=new HashMap<>();
    value.put("establishmentId",venue); value.put("country","BO");
    value.put("bankName","Mock sin dinero real"); value.put("accountReference","merchant-integration");
    value.put("accountHolderName","Empresa de integración"); value.put("enabled",true);
    return value;
  }
  private void seedTenant(String id,UUID establishment) {
    jdbc.update("insert into tenant(id,name,slug,status,vertical) values(?,?,?,'ACTIVE','RESTAURANT')",id,id,id);
    jdbc.update("insert into establishment(id,tenant_id,name,type,slug,timezone) values(?,?,?,'RESTAURANT','venue','UTC')",establishment,id,id+" Local");
  }
  private void user(UUID id,String userTenant,UserRole role) {
    jdbc.update("insert into app_user(id,tenant_id,email,password_hash,full_name,role) values(?,?,?,'unused','Operador',?)",id,userTenant,id+"@example.test",role.name());
  }
  record Booking(UUID id,String accessToken,Instant accessExpiresAt) {}
  record IdResponse(UUID id) {}
  record Receipt(String token,String paidAmount,String balanceAmount) {}
  @TestConfiguration static class FixedTime {
    @Bean @Primary Clock integrationClock() { return Clock.fixed(NOW,ZoneOffset.UTC); }
  }
}
