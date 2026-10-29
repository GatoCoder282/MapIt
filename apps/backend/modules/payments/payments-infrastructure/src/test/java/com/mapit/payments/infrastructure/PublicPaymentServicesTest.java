package com.mapit.payments.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.mapit.payments.application.PaymentMethodService;
import com.mapit.payments.application.PaymentReceiptService;
import com.mapit.payments.application.PaymentService;
import com.mapit.payments.application.PublicCheckoutService;
import com.mapit.payments.domain.MerchantPaymentMethod;
import com.mapit.payments.domain.MockQrConfiguration;
import com.mapit.payments.domain.MockQrConfigurationRepository;
import com.mapit.payments.domain.Money;
import com.mapit.payments.domain.Payment;
import com.mapit.payments.domain.PaymentConfigurationRepository;
import com.mapit.payments.domain.PaymentGatewayPort;
import com.mapit.payments.domain.PaymentMethodRepository;
import com.mapit.payments.domain.PaymentPolicy;
import com.mapit.payments.domain.PaymentProvider;
import com.mapit.payments.domain.PaymentReceiptRepository;
import com.mapit.payments.domain.PaymentRepository;
import com.mapit.payments.domain.PaymentReservationAccessPort;
import com.mapit.payments.domain.receipt.ReceiptToken;
import com.mapit.shared.tenant.TenantId;

class PublicPaymentServicesTest {
  private static final TenantId TENANT = TenantId.of("tenant-a");
  private static final UUID RESERVATION = UUID.randomUUID();
  private static final UUID ESTABLISHMENT = UUID.randomUUID();
  private static final Instant NOW = Instant.parse("2026-10-25T12:00:00Z");
  private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
  private final PaymentReservationAccessPort access = mock(PaymentReservationAccessPort.class);
  private final PaymentMethodRepository methods = mock(PaymentMethodRepository.class);
  private final MockQrConfigurationRepository mockQrConfigurations = mock(MockQrConfigurationRepository.class);
  private final PaymentConfigurationRepository configuration = mock(PaymentConfigurationRepository.class);
  private final PaymentRepository payments = mock(PaymentRepository.class);
  private final PaymentService engine = mock(PaymentService.class);
  private final PaymentGatewayPort gateway = mock(PaymentGatewayPort.class);
  private final PaymentReceiptRepository receipts = mock(PaymentReceiptRepository.class);
  private final PublicCheckoutService checkout = new PublicCheckoutService(access, methods, mockQrConfigurations, configuration, payments, engine, CLOCK, gateway);
  private final PaymentReceiptService receiptService = new PaymentReceiptService(access, payments, receipts, configuration, CLOCK);

  @BeforeEach
  void scope() {
    when(access.authorize("tenant-a", "venue", RESERVATION, "capability")).thenReturn(view("CREATED"));
    when(access.read(TENANT, RESERVATION)).thenReturn(view("CONFIRMED"));
    when(access.resolveTenant("tenant-a", "venue")).thenReturn(TENANT);
    when(gateway.capabilities()).thenReturn(new PaymentGatewayPort.Capabilities(false, false, true, true, false, Set.of(), Set.of()));
    when(engine.refreshExpiry(any())).thenAnswer(invocation -> invocation.getArgument(0));
  }

  @Test
  void sin_politica_no_inventa_importes_y_total_desconocido_no_inventa_saldo() {
    var unavailable = checkout.checkout("tenant-a", "venue", RESERVATION, "capability");
    assertThat(unavailable.available()).isFalse();
    assertThat(unavailable.amount()).isNull();
    assertThat(unavailable.totalAmount()).isNull();
    assertThat(unavailable.balanceAmount()).isNull();
    when(configuration.policy(TENANT, ESTABLISHMENT)).thenReturn(Optional.of(policy()));
    when(methods.list(TENANT)).thenReturn(List.of(staticMethod(null, true)));
    var configured = checkout.checkout("tenant-a", "venue", RESERVATION, "capability");
    assertThat(configured.available()).isTrue();
    assertThat(configured.amount()).isEqualTo("10.00");
    assertThat(configured.totalAmount()).isNull();
    assertThat(configured.balanceAmount()).isNull();
  }

  @Test
  void checkout_sin_cotizacion_no_ofrece_pagar_desde_el_fin_de_la_reserva() {
    when(configuration.policy(TENANT, ESTABLISHMENT)).thenReturn(Optional.of(policy()));
    when(methods.list(TENANT)).thenReturn(List.of(staticMethod(null, true)));
    Instant end = view("CREATED").endsAt();
    for (Instant now : List.of(end.minusSeconds(1), end, end.plusSeconds(1))) {
      var service = new PublicCheckoutService(access, methods, mockQrConfigurations, configuration,
          payments, engine, Clock.fixed(now, ZoneOffset.UTC), gateway);
      var result = service.checkout("tenant-a", "venue", RESERVATION, "capability");
      assertThat(result.available()).as("checkout a las %s", now).isEqualTo(now.isBefore(end));
      assertThat(result.unavailableReason()).isEqualTo(now.isBefore(end) ? null : "PAYMENT_WINDOW_EXPIRED");
    }
    org.mockito.Mockito.verify(configuration, org.mockito.Mockito.never()).insertQuote(any());
  }

  @Test
  void configuracion_local_deshabilitada_sustituye_default_y_mock_se_oculta_si_no_hay_gateway() {
    when(configuration.policy(TENANT, ESTABLISHMENT)).thenReturn(Optional.of(policy()));
    when(methods.list(TENANT)).thenReturn(List.of(method(null, true), method(ESTABLISHMENT, false)));
    assertThat(checkout.checkout("tenant-a", "venue", RESERVATION, "capability").methods()).isEmpty();
    when(methods.list(TENANT)).thenReturn(List.of(method(null, true)));
    when(gateway.capabilities()).thenReturn(new UnavailablePaymentGateway().capabilities());
    assertThat(checkout.checkout("tenant-a", "venue", RESERVATION, "capability").methods()).isEmpty();
  }

  @Test
  void mock_legacy_local_cuenta_para_ocultar_fallback_global_sin_mostrarse() {
    when(configuration.policy(TENANT, ESTABLISHMENT)).thenReturn(Optional.of(policy()));
    when(methods.list(TENANT)).thenReturn(List.of(method(ESTABLISHMENT, true), staticMethod(null, true)));

    var result = checkout.checkout("tenant-a", "venue", RESERVATION, "capability");

    assertThat(result.methods()).isEmpty();
    assertThat(result.available()).isFalse();
  }

  @Test
  void checkout_publico_no_ofrece_mock_sin_vinculo_a_configuracion_local() {
    when(configuration.policy(TENANT, ESTABLISHMENT)).thenReturn(Optional.of(policy()));
    when(methods.list(TENANT)).thenReturn(List.of(method(null, true)));

    var result = checkout.checkout("tenant-a", "venue", RESERVATION, "capability");

    assertThat(result.methods()).isEmpty();
    assertThat(result.available()).isFalse();
    assertThat(result.unavailableReason()).isEqualTo("PAYMENT_METHOD_UNAVAILABLE");
  }

  @Test
  void checkout_ofrece_solo_proyeccion_local_vigente_y_no_expone_datos_bancarios() {
    MockQrConfiguration config = new MockQrConfiguration(UUID.randomUUID(), TENANT, ESTABLISHMENT, "BO",
        "Banco secreto", "Titular secreto", "cuenta-secreta", true, UUID.randomUUID(), NOW, NOW,
        UUID.randomUUID(), UUID.randomUUID());
    MerchantPaymentMethod projection = new MerchantPaymentMethod(UUID.randomUUID(), TENANT, ESTABLISHMENT,
        "QR de prueba", "BO", "USD", PaymentProvider.MOCK_GATEWAY, "Banco secreto", "cuenta-secreta",
        null, true, NOW, NOW, UUID.randomUUID(), UUID.randomUUID(), "Titular secreto", config.id(), null);
    MerchantPaymentMethod globalTraditional = new MerchantPaymentMethod(UUID.randomUUID(), TENANT, null,
        "Transferencia", "BO", "USD", PaymentProvider.STATIC_BANK_QR, "Banco", "transfer", "data:image/png;base64,iVBORw0KGgoAAQ==",
        true, NOW, NOW, UUID.randomUUID(), UUID.randomUUID());
    when(configuration.policy(TENANT, ESTABLISHMENT)).thenReturn(Optional.of(policy()));
    when(mockQrConfigurations.findByEstablishment(TENANT, ESTABLISHMENT)).thenReturn(Optional.of(config));
    when(methods.list(TENANT)).thenReturn(List.of(projection, globalTraditional));

    var result = checkout.checkout("tenant-a", "venue", RESERVATION, "capability");

    assertThat(result.methods()).extracting("id").containsExactly(globalTraditional.id(), projection.id());
    assertThat(result.methods().get(1).simulationPath()).isEqualTo(config.simulationPath());
    assertThat(result.methods().toString()).doesNotContain("Banco secreto", "Titular secreto", "cuenta-secreta");
  }

  @Test
  void metodo_utilizado_no_cambia_cuenta_qr_o_moneda_pero_admite_desactivacion() {
    MerchantPaymentMethod original = method(null, true);
    when(methods.lock(TENANT, original.id())).thenReturn(Optional.of(original));
    when(methods.hasPayments(TENANT, original.id())).thenReturn(true);
    when(methods.update(any())).thenReturn(true);
    PaymentMethodService service = new PaymentMethodService(methods, () -> Optional.of(TENANT),
        () -> Optional.of(UUID.randomUUID()), CLOCK, true);
    var changedAccount = new PaymentMethodService.Draft(null, original.displayName(), original.country(), original.currency(),
        original.provider(), original.bankName(), "new-account", null, true, "Titular de prueba");
    assertThatThrownBy(() -> service.update(original.id(), changedAccount)).isInstanceOf(PaymentService.Conflict.class);
    var disabled = new PaymentMethodService.Draft(null, "Renamed", original.country(), original.currency(),
        original.provider(), original.bankName(), original.accountReference(), null, false);
    assertThat(service.update(original.id(), disabled).enabled()).isFalse();
  }

  @Test
  void intento_pendiente_muestra_metodo_historico_sin_ofrecerlo_para_iniciar() {
    UUID configurationId = UUID.randomUUID();
    MockQrConfiguration config = new MockQrConfiguration(configurationId, TENANT, ESTABLISHMENT, "BO",
        "Banco", "Titular", "cuenta", true, UUID.randomUUID(), NOW, NOW, UUID.randomUUID(), UUID.randomUUID());
    MerchantPaymentMethod original = new MerchantPaymentMethod(UUID.randomUUID(), TENANT, ESTABLISHMENT,
        "QR de prueba", "BO", "USD", PaymentProvider.MOCK_GATEWAY, "Banco", "cuenta", null,
        false, NOW, NOW, UUID.randomUUID(), UUID.randomUUID(), "Titular", configurationId, NOW.minusSeconds(1));
    MerchantPaymentMethod current = new MerchantPaymentMethod(UUID.randomUUID(), TENANT, ESTABLISHMENT,
        "QR actual", "BO", "USD", PaymentProvider.MOCK_GATEWAY, "Banco", "cuenta", null,
        true, NOW, NOW, UUID.randomUUID(), UUID.randomUUID(), "Titular", configurationId, null);
    Payment confirmed = payment();
    Payment pending = new Payment(confirmed.id(), TENANT, ESTABLISHMENT, RESERVATION, original.id(),
        PaymentProvider.MOCK_GATEWAY, "merchant", "external", confirmed.money(), Payment.Status.PENDING,
        confirmed.createdAt(), confirmed.expiresAt(), null, null, null);
    when(configuration.policy(TENANT, ESTABLISHMENT)).thenReturn(Optional.of(policy()));
    when(payments.latest(TENANT, RESERVATION)).thenReturn(Optional.of(pending));
    when(methods.list(TENANT)).thenReturn(List.of(original, current));
    when(mockQrConfigurations.find(TENANT, configurationId)).thenReturn(Optional.of(config));
    when(gateway.capabilities()).thenReturn(new UnavailablePaymentGateway().capabilities());

    var result = checkout.checkout("tenant-a", "venue", RESERVATION, "capability");

    assertThat(result.available()).isFalse();
    assertThat(result.unavailableReason()).isEqualTo("PAYMENT_PENDING");
    assertThat(result.methods()).isEmpty();
    assertThat(result.historicalMethod().id()).isEqualTo(original.id());
    assertThat(result.historicalMethod().simulationPath()).isEqualTo(config.simulationPath());
    when(configuration.lockEstablishment(TENANT, ESTABLISHMENT)).thenReturn(true);
    when(methods.find(TENANT, original.id())).thenReturn(Optional.of(original));
    assertThatThrownBy(() -> checkout.start("tenant-a", "venue", RESERVATION, "capability",
        original.id(), UUID.randomUUID())).isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void conciliacion_prevalece_sobre_un_intento_fallido_mas_reciente_y_no_ofrece_cobrar() {
    Payment confirmed = payment();
    Payment reconcile = new Payment(confirmed.id(), TENANT, ESTABLISHMENT, RESERVATION, confirmed.methodId(),
        confirmed.provider(), confirmed.merchantReference(), confirmed.externalReference(), confirmed.money(),
        Payment.Status.RECONCILIATION_REQUIRED, confirmed.createdAt(), confirmed.expiresAt(), NOW, null, "WEBHOOK");
    when(configuration.policy(TENANT, ESTABLISHMENT)).thenReturn(Optional.of(policy()));
    when(payments.reconciliationRequired(TENANT, RESERVATION)).thenReturn(Optional.of(reconcile));
    when(methods.list(TENANT)).thenReturn(List.of(method(null, true)));
    var result = checkout.checkout("tenant-a", "venue", RESERVATION, "capability");
    assertThat(result.available()).isFalse();
    assertThat(result.unavailableReason()).isEqualTo("PAYMENT_RECONCILIATION_REQUIRED");
    assertThat(result.payment().status()).isEqualTo(Payment.Status.RECONCILIATION_REQUIRED);
  }

  @Test
  void emision_requiere_reserva_confirmada_y_persiste_solo_hash_con_datos_actuales() {
    when(payments.confirmed(TENANT, RESERVATION)).thenReturn(Optional.of(payment()));
    var issued = receiptService.issue("tenant-a", "venue", RESERVATION, "capability");
    ArgumentCaptor<PaymentReceiptRepository.StoredReceipt> stored = ArgumentCaptor.forClass(PaymentReceiptRepository.StoredReceipt.class);
    verify(receipts).insert(stored.capture());
    assertThat(stored.getValue().tokenHash()).isEqualTo(ReceiptToken.hashOf(issued.token()));
    assertThat(stored.getValue().tokenHash()).isNotEqualTo(issued.token());
    assertThat(issued.expiresAt()).isEqualTo(NOW.plusSeconds(3600 + 86400));
    assertThat(issued.url()).contains("tenantSlug=tenant-a&establishmentSlug=venue");
    assertThat(issued.paidAmount()).isEqualTo("10.00");
    assertThat(issued.totalAmount()).isNull();
    assertThat(issued.balanceAmount()).isNull();
    when(access.read(TENANT, RESERVATION)).thenReturn(view("CANCELLED"));
    assertThatThrownBy(() -> receiptService.issue("tenant-a", "venue", RESERVATION, "capability"))
        .isInstanceOf(PaymentMethodService.NotFound.class);
  }

  @Test
  void recibo_se_resuelve_con_tenant_sin_pii_y_admite_reserva_activa_pero_no_revocada() {
    ReceiptToken token = ReceiptToken.generate();
    var descriptor = new PaymentReceiptRepository.StoredReceipt(UUID.randomUUID(), TENANT, ESTABLISHMENT,
        RESERVATION, payment().id(), token.hash(), NOW.minusSeconds(1), NOW.plusSeconds(60), null);
    when(receipts.findByHash(TENANT, token.hash())).thenReturn(Optional.of(descriptor));
    when(payments.confirmed(TENANT, RESERVATION)).thenReturn(Optional.of(payment()));
    when(access.read(TENANT, RESERVATION)).thenReturn(view("ACTIVE"));
    var result = receiptService.read("tenant-a", "venue", token.presentationValue());
    assertThat(result.checkIn()).isEqualTo("CHECKED_IN");
    assertThat(result.token()).isNull();
    assertThat(result.url()).isNull();
    when(receipts.findByHash(TENANT, token.hash())).thenReturn(Optional.of(new PaymentReceiptRepository.StoredReceipt(
        descriptor.id(), TENANT, ESTABLISHMENT, RESERVATION, payment().id(), token.hash(), NOW.minusSeconds(1), NOW.plusSeconds(60), NOW)));
    assertThatThrownBy(() -> receiptService.read("tenant-a", "venue", token.presentationValue())).isInstanceOf(PaymentMethodService.NotFound.class);
  }

  @Test
  void cancelado_se_recupera_sin_metodo_historico_y_no_emite_recibo() {
    Payment original = payment();
    Payment cancelled = new Payment(original.id(), TENANT, ESTABLISHMENT, RESERVATION, original.methodId(),
        original.provider(), original.merchantReference(), original.externalReference(), original.money(),
        Payment.Status.CANCELLED, original.createdAt(), original.expiresAt(), null, null, null);
    when(configuration.policy(TENANT, ESTABLISHMENT)).thenReturn(Optional.of(policy()));
    when(payments.latest(TENANT, RESERVATION)).thenReturn(Optional.of(cancelled));
    when(payments.find(TENANT, cancelled.id())).thenReturn(Optional.of(cancelled));
    when(methods.list(TENANT)).thenReturn(List.of(staticMethod(null, true)));
    var result = checkout.checkout("tenant-a", "venue", RESERVATION, "capability");
    assertThat(result.payment().status()).isEqualTo(Payment.Status.CANCELLED);
    assertThat(result.payment().paidAmount()).isEqualTo("0");
    assertThat(result.historicalMethod()).isNull();
    assertThat(result.available()).isTrue();
    assertThat(checkout.simulationResult("tenant-a", "venue", RESERVATION, "capability", cancelled.id()).status())
        .isEqualTo(Payment.Status.CANCELLED);
    assertThatThrownBy(() -> receiptService.issue("tenant-a", "venue", RESERVATION, "capability"))
        .isInstanceOf(PaymentMethodService.NotFound.class);
    assertThatThrownBy(() -> checkout.paymentForSimulation("tenant-a", "venue", RESERVATION, "capability", UUID.randomUUID()))
        .isInstanceOf(PaymentMethodService.NotFound.class);
  }

  @Test void readiness_enum_ordenado_runtime_y_metodo_sin_escrituras() {
    var service=new com.mapit.payments.application.PaymentReadinessService(configuration,mockQrConfigurations,methods,gateway,()->Optional.of(TENANT));
    assertThatThrownBy(()->service.read(ESTABLISHMENT)).isInstanceOf(PaymentMethodService.NotFound.class);
    when(methods.establishmentExists(TENANT,ESTABLISHMENT)).thenReturn(true);
    assertThat(service.read(ESTABLISHMENT).blockers()).extracting(Enum::name).containsExactly("POLICY_MISSING","QR_MISSING");
    var config=new MockQrConfiguration(UUID.randomUUID(),TENANT,ESTABLISHMENT,"BO","Bank","Holder","merchant",true,UUID.randomUUID(),NOW,NOW,UUID.randomUUID(),UUID.randomUUID());
    when(mockQrConfigurations.findByEstablishment(TENANT,ESTABLISHMENT)).thenReturn(Optional.of(config));
    when(configuration.policy(TENANT,ESTABLISHMENT)).thenReturn(Optional.of(policy()));
    assertThat(service.read(ESTABLISHMENT).blockers()).extracting(Enum::name).containsExactly("METHOD_MISSING");
    when(gateway.capabilities()).thenReturn(new UnavailablePaymentGateway().capabilities());
    assertThat(service.read(ESTABLISHMENT).blockers()).extracting(Enum::name).containsExactly("MOCK_RUNTIME_DISABLED");
    var wrong=new MerchantPaymentMethod(UUID.randomUUID(),TENANT,UUID.randomUUID(),"Mock","BO","BOB",PaymentProvider.MOCK_GATEWAY,
        "Bank","merchant",null,false,NOW,NOW,UUID.randomUUID(),UUID.randomUUID(),"Holder",config.id(),NOW);
    when(methods.projection(TENANT,config.id())).thenReturn(Optional.of(wrong));
    assertThat(service.read(ESTABLISHMENT).blockers()).extracting(Enum::name).containsExactly("MOCK_RUNTIME_DISABLED","METHOD_DISABLED","METHOD_SUPERSEDED","METHOD_CURRENCY_MISMATCH","METHOD_SCOPE_MISMATCH");
    org.mockito.Mockito.verify(configuration,org.mockito.Mockito.never()).savePolicy(any());
    org.mockito.Mockito.verify(configuration,org.mockito.Mockito.never()).lockEstablishment(any(),any());
    org.mockito.Mockito.verify(methods,org.mockito.Mockito.never()).insert(any());
    var disabledPolicy=new PaymentPolicy(UUID.randomUUID(),TENANT,ESTABLISHMENT,false,new Money(BigDecimal.TEN,"USD"),null,30,NOW,UUID.randomUUID());
    var disabledQr=new MockQrConfiguration(config.id(),TENANT,ESTABLISHMENT,"BO","Bank","Holder","merchant",false,config.simulationToken(),NOW,NOW,UUID.randomUUID(),UUID.randomUUID());
    when(configuration.policy(TENANT,ESTABLISHMENT)).thenReturn(Optional.of(disabledPolicy));
    when(mockQrConfigurations.findByEstablishment(TENANT,ESTABLISHMENT)).thenReturn(Optional.of(disabledQr));
    assertThat(service.read(ESTABLISHMENT).blockers()).extracting(Enum::name)
        .startsWith("POLICY_DISABLED","QR_DISABLED","MOCK_RUNTIME_DISABLED");
  }

  private static PaymentPolicy policy() {
    return new PaymentPolicy(UUID.randomUUID(), TENANT, ESTABLISHMENT, true, new Money(BigDecimal.TEN, "USD"), null, 30, NOW, UUID.randomUUID());
  }
  private static MerchantPaymentMethod method(UUID establishment, boolean enabled) {
    return new MerchantPaymentMethod(UUID.randomUUID(), TENANT, establishment, "Mock", "BO", "USD", PaymentProvider.MOCK_GATEWAY,
        "Mock", "merchant", null, enabled, NOW, NOW, UUID.randomUUID(), UUID.randomUUID());
  }
  private static MerchantPaymentMethod staticMethod(UUID establishment, boolean enabled) {
    return new MerchantPaymentMethod(UUID.randomUUID(), TENANT, establishment, "Transferencia", "BO", "USD",
        PaymentProvider.STATIC_BANK_QR, "Bank", "reference", "data:image/png;base64,iVBORw0KGgoAAQ==",
        enabled, NOW, NOW, UUID.randomUUID(), UUID.randomUUID());
  }
  private static PaymentReservationAccessPort.ReservationView view(String status) {
    return new PaymentReservationAccessPort.ReservationView(TENANT, RESERVATION, ESTABLISHMENT, "Venue", "tenant-a", "venue",
        NOW, NOW.plusSeconds(3600), "UTC", status, List.of(new PaymentReservationAccessPort.Space(UUID.randomUUID(), "Mesa 1", "Piso 1", "Sector", "RESERVED")));
  }
  private static Payment payment() {
    return new Payment(UUID.fromString("99000000-0000-0000-0000-000000000001"), TENANT, ESTABLISHMENT, RESERVATION, UUID.randomUUID(),
        PaymentProvider.MOCK_GATEWAY, "merchant", "external", new Money(BigDecimal.TEN, "USD"), Payment.Status.CONFIRMED,
        NOW.minusSeconds(60), NOW.plusSeconds(60), NOW, null, "WEBHOOK");
  }
}
