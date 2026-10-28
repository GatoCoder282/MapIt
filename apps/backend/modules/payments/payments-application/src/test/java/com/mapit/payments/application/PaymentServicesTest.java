package com.mapit.payments.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.Test;

import com.mapit.payments.domain.MerchantPaymentMethod;
import com.mapit.payments.domain.Money;
import com.mapit.payments.domain.Payment;
import com.mapit.payments.domain.PaymentGatewayPort;
import com.mapit.payments.domain.PaymentMethodRepository;
import com.mapit.payments.domain.PaymentProvider;
import com.mapit.payments.domain.PaymentRepository;
import com.mapit.payments.domain.ReservationPaymentPort;
import com.mapit.shared.tenant.TenantId;

/** Dobles de puertos: prueban reglas independientes, no sustituyen la prueba JDBC de concurrencia. */
class PaymentServicesTest {
  private static final Instant NOW = Instant.parse("2026-10-24T12:00:00Z");
  private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
  private static final TenantId TENANT = TenantId.of("tenant-a");
  private static final UUID ESTABLISHMENT = UUID.randomUUID();
  private static final UUID RESERVATION = UUID.randomUUID();
  private static final UUID ACTOR = UUID.randomUUID();
  private static final Money DEPOSIT = new Money(BigDecimal.TEN, "USD");
  private final Methods methods = new Methods();
  private final Payments payments = new Payments();
  private final Reservations reservations = new Reservations();
  private final PaymentService service = new PaymentService(payments, methods, reservations, new Gateway(),
      () -> Optional.of(TENANT), () -> Optional.of(ACTOR), CLOCK);

  @Test
  void metodo_de_otro_tenant_no_es_visible_ni_modificable() {
    MerchantPaymentMethod original = method(null, PaymentProvider.MOCK_GATEWAY, true);
    methods.values.add(original);
    PaymentMethodService foreign = new PaymentMethodService(methods, () -> Optional.of(TenantId.of("tenant-b")),
        () -> Optional.of(ACTOR), CLOCK, true);
    assertThat(foreign.list(null)).isEmpty();
    assertThatThrownBy(() -> foreign.update(original.id(), draft(null, true))).isInstanceOf(PaymentMethodService.NotFound.class);
    assertThatThrownBy(() -> foreign.create(draft(ESTABLISHMENT, true))).isInstanceOf(PaymentMethodService.NotFound.class);
  }

  @Test
  void configura_con_actor_y_no_habilita_mock_si_entorno_no_lo_permite() {
    PaymentMethodService admin = new PaymentMethodService(methods, () -> Optional.of(TENANT), () -> Optional.of(ACTOR), CLOCK, true);
    MerchantPaymentMethod created = admin.create(draft(null, true));
    assertThat(created.createdBy()).isEqualTo(ACTOR);
    assertThat(created.verification()).isEqualTo("AUTOMATIC");
    PaymentMethodService production = new PaymentMethodService(methods, () -> Optional.of(TENANT), () -> Optional.of(ACTOR), CLOCK, false);
    assertThatThrownBy(() -> production.create(draft(null, true))).isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void titular_no_se_inventa_en_legado_y_desactivacion_sigue_disponible() {
    PaymentMethodService admin = new PaymentMethodService(methods, () -> Optional.of(TENANT), () -> Optional.of(ACTOR), CLOCK, true);
    var legacy = method(null, PaymentProvider.MOCK_GATEWAY, true);
    methods.values.add(legacy);
    assertThat(legacy.accountHolderName()).isNull();
    var missing = new PaymentMethodService.Draft(null,"Legacy","BO","USD",PaymentProvider.MOCK_GATEWAY,"Bank","merchant",null,true,null);
    assertThatThrownBy(()->admin.create(missing)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(()->admin.update(legacy.id(),missing)).isInstanceOf(IllegalArgumentException.class);
    var disabled = new PaymentMethodService.Draft(null,"Legacy","BO","USD",PaymentProvider.MOCK_GATEWAY,"Bank","merchant",null,false,null);
    assertThat(admin.update(legacy.id(),disabled).enabled()).isFalse();
  }

  @Test
  void local_deshabilitado_sustituye_default_y_no_se_puede_eludir_al_iniciar() {
    MerchantPaymentMethod global = method(null, PaymentProvider.MOCK_GATEWAY, true);
    MerchantPaymentMethod local = method(ESTABLISHMENT, PaymentProvider.MOCK_GATEWAY, false);
    methods.values.addAll(List.of(global, local));
    PaymentMethodService admin = new PaymentMethodService(methods, () -> Optional.of(TENANT), () -> Optional.of(ACTOR), CLOCK, true);
    assertThat(admin.list(ESTABLISHMENT)).containsExactly(local);
    assertThatThrownBy(() -> service.start(RESERVATION, global.id())).isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void proyeccion_no_oculta_fallback_global_y_no_es_editable_por_crud_generico() {
    MerchantPaymentMethod global = method(null, PaymentProvider.INTEGRATED_GATEWAY, false);
    MerchantPaymentMethod projected = new MerchantPaymentMethod(UUID.randomUUID(), TENANT, ESTABLISHMENT,
        "QR de prueba", "BO", "USD", PaymentProvider.MOCK_GATEWAY, "Bank", "merchant", null,
        false, NOW, NOW, ACTOR, ACTOR, "Titular", UUID.randomUUID(), null);
    methods.values.addAll(List.of(global, projected));
    PaymentMethodService admin = new PaymentMethodService(methods, () -> Optional.of(TENANT), () -> Optional.of(ACTOR), CLOCK, true);

    assertThat(admin.list(ESTABLISHMENT)).containsExactly(global);
    assertThatThrownBy(() -> admin.update(projected.id(), draft(ESTABLISHMENT, false)))
        .isInstanceOf(PaymentService.Conflict.class);
  }

  @Test
  void cobro_snapshot_no_recibe_monto_del_cliente_y_duplicado_no_repite_confirmacion() {
    MerchantPaymentMethod method = method(null, PaymentProvider.MOCK_GATEWAY, true);
    methods.values.add(method);
    Payment started = service.start(RESERVATION, method.id());
    assertThat(started.money()).isEqualTo(DEPOSIT);
    PaymentService.VerifiedEvent event = event(started, "event-1", DEPOSIT, "merchant", Payment.Outcome.CONFIRMED);
    assertThat(service.process(event).status()).isEqualTo(Payment.Status.CONFIRMED);
    assertThat(service.process(event).status()).isEqualTo(Payment.Status.CONFIRMED);
    service.process(event(started, "event-2", DEPOSIT, "merchant", Payment.Outcome.FAILED));
    assertThat(reservations.confirmCalls).isEqualTo(1);
    assertThat(payments.verifications).isEqualTo(1);
  }

  @Test
  void monto_moneda_comercio_o_tenant_incorrectos_no_confirman() {
    Payment p = startMock();
    assertThatThrownBy(() -> service.process(event(p, "bad-amount", new Money(BigDecimal.ONE, "USD"), "merchant", Payment.Outcome.CONFIRMED)))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.process(event(p, "bad-currency", new Money(BigDecimal.TEN, "BOB"), "merchant", Payment.Outcome.CONFIRMED)))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.process(event(p, "bad-merchant", DEPOSIT, "other", Payment.Outcome.CONFIRMED)))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.process(new PaymentService.VerifiedEvent(TenantId.of("tenant-b"), p.id(), p.provider(),
        "foreign", p.externalReference(), p.merchantReference(), p.money(), Payment.Outcome.CONFIRMED)))
        .isInstanceOf(PaymentMethodService.NotFound.class);
    assertThat(reservations.confirmCalls).isZero();
    assertThat(payments.events).isEmpty();
  }

  @Test
  void reserva_no_confirmable_requiere_conciliacion_sin_marcar_pagado_el_checkout() {
    Payment p = startMock();
    reservations.confirmable = false;
    Payment changed = service.process(event(p, "event", DEPOSIT, "merchant", Payment.Outcome.CONFIRMED));
    assertThat(changed.status()).isEqualTo(Payment.Status.RECONCILIATION_REQUIRED);
    assertThat(changed.verifiedAt()).isEqualTo(NOW);
    assertThatThrownBy(() -> service.start(TENANT, RESERVATION, p.methodId(), UUID.randomUUID()))
        .isInstanceOf(PaymentService.Conflict.class);
  }

  @Test
  void qr_estatico_solo_se_verifica_manualmente_con_actor() {
    MerchantPaymentMethod m = method(null, PaymentProvider.STATIC_BANK_QR, true);
    methods.values.add(m);
    Payment p = service.start(RESERVATION, m.id());
    assertThat(p.status()).isEqualTo(Payment.Status.PENDING_MANUAL_VERIFICATION);
    assertThatThrownBy(() -> service.process(event(p, "static-webhook", DEPOSIT, "merchant", Payment.Outcome.CONFIRMED)))
        .isInstanceOf(IllegalArgumentException.class);
    Payment verified = service.verifyManually(p.id(), "bank-reference");
    assertThat(verified.status()).isEqualTo(Payment.Status.CONFIRMED);
    assertThat(verified.verifiedBy()).isEqualTo(ACTOR);
    service.verifyManually(p.id(), "bank-reference");
    assertThat(payments.verifications).isEqualTo(1);
  }

  @Test
  void request_id_reintenta_el_mismo_pago_y_rechaza_reutilizarlo_para_otro_metodo() {
    MerchantPaymentMethod method = method(null, PaymentProvider.MOCK_GATEWAY, true);
    methods.values.add(method);
    UUID request = UUID.randomUUID();
    Payment first = service.start(TENANT, RESERVATION, method.id(), request);
    Payment replay = service.start(TENANT, RESERVATION, method.id(), request);
    assertThat(replay.id()).isEqualTo(first.id());
    assertThat(payments.values).hasSize(1);
    assertThatThrownBy(() -> service.start(TENANT, RESERVATION, UUID.randomUUID(), request)).isInstanceOf(PaymentService.Conflict.class);
  }

  @Test
  void mock_pendiente_se_reutiliza_aunque_el_request_id_cambie() {
    MerchantPaymentMethod method = method(null, PaymentProvider.MOCK_GATEWAY, true);
    methods.values.add(method);

    Payment first = service.start(TENANT, RESERVATION, method.id(), UUID.randomUUID());
    Payment retry = service.start(TENANT, RESERVATION, method.id(), UUID.randomUUID());

    assertThat(retry.id()).isEqualTo(first.id());
    assertThat(payments.values).hasSize(1);
  }

  @Test
  void request_alias_de_pago_reutilizado_sigue_resolviendo_despues_de_fallar() {
    MerchantPaymentMethod method = method(null, PaymentProvider.MOCK_GATEWAY, true);
    methods.values.add(method);
    UUID requestOne = UUID.randomUUID();
    UUID requestTwo = UUID.randomUUID();

    Payment first = service.start(TENANT, RESERVATION, method.id(), requestOne);
    assertThat(service.start(TENANT, RESERVATION, method.id(), requestTwo).id()).isEqualTo(first.id());
    service.process(event(first, "failed-after-reuse", DEPOSIT, "merchant", Payment.Outcome.FAILED));

    assertThat(service.start(TENANT, RESERVATION, method.id(), requestTwo).id()).isEqualTo(first.id());
    assertThat(service.start(TENANT, RESERVATION, method.id(), requestOne).id()).isEqualTo(first.id());
    assertThat(payments.values).hasSize(1);
  }

  @Test
  void intento_pendiente_bloquea_otra_sesion_hasta_llegar_a_estado_terminal() {
    MerchantPaymentMethod method = method(null, PaymentProvider.MOCK_GATEWAY, true);
    methods.values.add(method);
    Payment first = service.start(TENANT, RESERVATION, method.id(), UUID.randomUUID());
    Payment reused = service.start(TENANT, RESERVATION, method.id(), UUID.randomUUID());
    assertThat(reused.id()).isEqualTo(first.id());
    assertThat(payments.values).hasSize(1);

    service.process(event(first, "first-failure", DEPOSIT, "merchant", Payment.Outcome.FAILED));
    Payment second = service.start(TENANT, RESERVATION, method.id(), UUID.randomUUID());
    assertThat(service.process(event(second, "second-income", DEPOSIT, "merchant", Payment.Outcome.CONFIRMED)).status())
        .isEqualTo(Payment.Status.CONFIRMED);
    assertThat(reservations.confirmCalls).isEqualTo(1);
    assertThat(payments.verifications).isEqualTo(1);
  }

  @Test
  void pending_manual_static_bank_qr_no_bloquea_un_nuevo_intento() {
    MerchantPaymentMethod firstMethod = method(null, PaymentProvider.STATIC_BANK_QR, true);
    MerchantPaymentMethod secondMethod = method(null, PaymentProvider.STATIC_BANK_QR, true);
    methods.values.addAll(List.of(firstMethod, secondMethod));

    Payment first = service.start(TENANT, RESERVATION, firstMethod.id(), UUID.randomUUID());
    Payment second = service.start(TENANT, RESERVATION, secondMethod.id(), UUID.randomUUID());

    assertThat(first.status()).isEqualTo(Payment.Status.PENDING_MANUAL_VERIFICATION);
    assertThat(second.id()).isNotEqualTo(first.id());
    assertThat(payments.values).hasSize(2);
  }

  @Test
  void cancelar_no_confirma_replay_conserva_intento_y_reintento_conserva_snapshot_y_plazo() {
    Payment first = startMock();
    UUID request = payments.requests.entrySet().stream().filter(e -> e.getValue().equals(first.id())).findFirst().orElseThrow().getKey();
    var cancel = event(first, "cancel", DEPOSIT, "merchant", Payment.Outcome.valueOf("CANCELLED"));
    Payment cancelled = service.process(cancel);
    assertThat(cancelled.status().name()).isEqualTo("CANCELLED");
    assertThat(service.process(cancel)).isEqualTo(cancelled);
    assertThat(service.process(event(first, "contradiction", DEPOSIT, "merchant", Payment.Outcome.FAILED))).isEqualTo(cancelled);
    assertThat(service.refreshExpiry(cancelled)).isEqualTo(cancelled);
    var afterDeadline = new PaymentService(payments, methods, reservations, new Gateway(),
        () -> Optional.of(TENANT), () -> Optional.of(ACTOR), Clock.fixed(NOW.plusSeconds(120), ZoneOffset.UTC));
    assertThat(afterDeadline.refreshExpiry(cancelled)).isEqualTo(cancelled);
    assertThat(service.start(TENANT, RESERVATION, first.methodId(), request)).isEqualTo(cancelled);
    Payment retry = service.start(TENANT, RESERVATION, first.methodId(), UUID.randomUUID());
    assertThat(retry.id()).isNotEqualTo(first.id());
    assertThat(retry.expiresAt()).isEqualTo(first.expiresAt());
    assertThat(retry.money()).isEqualTo(first.money());
    assertThat(payments.values).hasSize(2);
    assertThat(service.process(event(first, "late-income", DEPOSIT, "merchant", Payment.Outcome.CONFIRMED)).status())
        .isEqualTo(Payment.Status.RECONCILIATION_REQUIRED);
    assertThat(reservations.confirmCalls).isZero();
  }

  @Test
  void vencimiento_es_distinto_no_degrada_confirmado_y_no_renueva_ventana_al_reintentar() {
    Payment pending = startMock();
    var afterDeadline = new PaymentService(payments, methods, reservations, new Gateway(),
        () -> Optional.of(TENANT), () -> Optional.of(ACTOR), Clock.fixed(NOW.plusSeconds(120), ZoneOffset.UTC));
    assertThat(afterDeadline.refreshExpiry(pending).status()).isEqualTo(Payment.Status.EXPIRED);
    assertThatThrownBy(() -> afterDeadline.start(TENANT, RESERVATION, pending.methodId(), UUID.randomUUID()))
        .isInstanceOf(PaymentService.Conflict.class);
    assertThat(afterDeadline.process(event(pending, "late", DEPOSIT, "merchant", Payment.Outcome.CONFIRMED)).status())
        .isEqualTo(Payment.Status.RECONCILIATION_REQUIRED);
    assertThat(reservations.confirmCalls).isZero();
  }

  private Payment startMock() {
    MerchantPaymentMethod m = method(null, PaymentProvider.MOCK_GATEWAY, true);
    methods.values.add(m); return service.start(RESERVATION, m.id());
  }

  private static PaymentService.VerifiedEvent event(Payment p, String id, Money amount, String merchant, Payment.Outcome outcome) {
    return new PaymentService.VerifiedEvent(TENANT, p.id(), p.provider(), id, p.externalReference(), merchant, amount, outcome);
  }

  private static PaymentMethodService.Draft draft(@Nullable UUID establishment, boolean enabled) {
    return new PaymentMethodService.Draft(establishment, "Mock", "BO", "USD", PaymentProvider.MOCK_GATEWAY,
        "Mock bank", "merchant", null, enabled, "Titular de prueba");
  }

  private static MerchantPaymentMethod method(@Nullable UUID establishment, PaymentProvider provider, boolean enabled) {
    String image = provider == PaymentProvider.STATIC_BANK_QR ? "data:image/png;base64,iVBORw0KGgoA" : null;
    return new MerchantPaymentMethod(UUID.randomUUID(), TENANT, establishment, "Method", "BO", "USD", provider,
        "Bank", "merchant", image, enabled, NOW, NOW, ACTOR, ACTOR);
  }

  private static class Methods implements PaymentMethodRepository {
    final List<MerchantPaymentMethod> values = new ArrayList<>();
    public List<MerchantPaymentMethod> list(TenantId tenant) { return values.stream().filter(m -> m.tenantId().equals(tenant)).toList(); }
    public Optional<MerchantPaymentMethod> find(TenantId tenant, UUID id) { return list(tenant).stream().filter(m -> m.id().equals(id)).findFirst(); }
    public Optional<MerchantPaymentMethod> projection(TenantId tenant, UUID configId) { return list(tenant).stream().filter(m -> configId.equals(m.mockQrConfigurationId()) && m.supersededAt() == null).findFirst(); }
    public Optional<MerchantPaymentMethod> lock(TenantId tenant, UUID id) { return find(tenant, id); }
    public boolean hasPayments(TenantId tenant, UUID id) { return false; }
    public void supersede(TenantId tenant, UUID id, Instant at, UUID actorId) { }
    public boolean establishmentExists(TenantId tenant, UUID id) { return tenant.equals(TENANT) && id.equals(ESTABLISHMENT); }
    public MerchantPaymentMethod insert(MerchantPaymentMethod m) { values.add(m); return m; }
    public boolean update(MerchantPaymentMethod m) { if (find(m.tenantId(), m.id()).isEmpty()) return false; values.removeIf(v -> v.id().equals(m.id())); values.add(m); return true; }
  }

  private static class Payments implements PaymentRepository {
    final Map<UUID, Payment> values = new HashMap<>();
    final Map<UUID, UUID> requests = new HashMap<>();
    final Set<String> events = new HashSet<>();
    int verifications;
    public Payment insert(Payment p) { return insert(p, null); }
    public Payment insert(Payment p, UUID requestId) { values.put(p.id(), p); if (requestId != null) requests.put(requestId, p.id()); return p; }
    public void addRequestAlias(Payment p, UUID requestId) { requests.put(requestId, p.id()); }
    public Optional<Payment> find(TenantId tenant, UUID id) { return Optional.ofNullable(values.get(id)).filter(p -> p.tenantId().equals(tenant)); }
    public Optional<Payment> findByRequest(TenantId tenant, UUID reservationId, UUID requestId) { return Optional.ofNullable(requests.get(requestId)).flatMap(id -> find(tenant, id)).filter(p -> p.reservationId().equals(reservationId)); }
    public Optional<Payment> latest(TenantId tenant, UUID reservationId) { return values.values().stream().filter(p -> p.tenantId().equals(tenant) && p.reservationId().equals(reservationId)).findFirst(); }
    public List<Payment> pending(TenantId tenant, UUID reservationId) { return values.values().stream().filter(p -> p.tenantId().equals(tenant) && p.reservationId().equals(reservationId) && (p.status() == Payment.Status.PENDING || p.status() == Payment.Status.PENDING_MANUAL_VERIFICATION)).toList(); }
    public Optional<Payment> confirmed(TenantId tenant, UUID reservationId) { return values.values().stream().filter(p -> p.tenantId().equals(tenant) && p.reservationId().equals(reservationId) && p.status() == Payment.Status.CONFIRMED).findFirst(); }
    public Optional<Payment> reconciliationRequired(TenantId tenant, UUID reservationId) { return values.values().stream().filter(p -> p.tenantId().equals(tenant) && p.reservationId().equals(reservationId) && p.status() == Payment.Status.RECONCILIATION_REQUIRED).findFirst(); }
    public Optional<Payment> lock(TenantId tenant, UUID id) { return Optional.ofNullable(values.get(id)).filter(p -> p.tenantId().equals(tenant)); }
    public void update(Payment p) { values.put(p.id(), p); }
    public boolean recordEvent(Payment p, String id, Payment.Outcome outcome, Instant now) { return events.add(p.tenantId() + "/" + p.provider() + "/" + id); }
    public void recordVerification(Payment p, @Nullable UUID actor, String source, String reference, Instant now) { verifications++; }
  }

  private static class Reservations implements ReservationPaymentPort {
    boolean confirmable = true;
    int confirmCalls;
    public Quote quote(TenantId tenant, UUID reservationId) { return new Quote(ESTABLISHMENT, reservationId, DEPOSIT, NOW.plusSeconds(60)); }
    public boolean confirm(Payment p) { confirmCalls++; return confirmable; }
  }

  private static class Gateway implements PaymentGatewayPort {
    public Capabilities capabilities() { return new Capabilities(false, false, true, true, false, Set.of(), Set.of()); }
    public Session createSession(UUID id, Money money, Instant expiresAt) { return new Session("external-" + id, "mock://session/" + id, expiresAt); }
    public Optional<Payment.Outcome> query(String reference) { return Optional.empty(); }
  }
}
