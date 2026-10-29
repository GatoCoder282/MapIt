package com.mapit.payments.application;

import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.payments.domain.MerchantPaymentMethod;
import com.mapit.payments.domain.MockQrConfiguration;
import com.mapit.payments.domain.MockQrConfigurationRepository;
import com.mapit.payments.domain.Payment;
import com.mapit.payments.domain.PaymentConfigurationRepository;
import com.mapit.payments.domain.PaymentGatewayPort;
import com.mapit.payments.domain.PaymentMethodRepository;
import com.mapit.payments.domain.PaymentPolicy;
import com.mapit.payments.domain.PaymentProvider;
import com.mapit.payments.domain.PaymentRepository;
import com.mapit.payments.domain.PaymentReservationAccessPort;
import com.mapit.payments.domain.ReservationPaymentQuote;

@Service
public class PublicCheckoutService {
  private final PaymentReservationAccessPort access;
  private final PaymentMethodRepository methods;
  private final MockQrConfigurationRepository mockQrConfigurations;
  private final PaymentConfigurationRepository configuration;
  private final PaymentRepository repository;
  private final PaymentService payments;
  private final Clock clock;
  private final PaymentGatewayPort gateway;

  public PublicCheckoutService(PaymentReservationAccessPort access, PaymentMethodRepository methods,
      MockQrConfigurationRepository mockQrConfigurations,
      PaymentConfigurationRepository configuration, PaymentRepository repository, PaymentService payments, Clock clock,
      PaymentGatewayPort gateway) {
    this.access = access; this.methods = methods; this.mockQrConfigurations = mockQrConfigurations;
    this.configuration = configuration;
    this.repository = repository; this.payments = payments; this.clock = clock;
    this.gateway = gateway;
  }

  @Transactional
  public PaymentViews.PublicCheckout checkout(String tenantSlug, String establishmentSlug, UUID reservationId, String token) {
    PaymentReservationAccessPort.ReservationView view = access.authorize(tenantSlug, establishmentSlug, reservationId, token);
    PaymentPolicy policy = configuration.policy(view.tenantId(), view.establishmentId()).orElse(null);
    ReservationPaymentQuote quote = configuration.quote(view.tenantId(), reservationId).orElse(null);
    Payment latest = repository.confirmed(view.tenantId(), reservationId)
        .orElseGet(() -> repository.reconciliationRequired(view.tenantId(), reservationId)
            .orElse(null));
    if (latest == null) {
      for (Payment pending : repository.pending(view.tenantId(), reservationId)) {
        Payment refreshed = payments.refreshExpiry(pending);
        if (refreshed.status() == Payment.Status.PENDING
            || refreshed.status() == Payment.Status.PENDING_MANUAL_VERIFICATION) {
          latest = refreshed;
          break;
        }
      }
    }
    if (latest == null) latest = repository.latest(view.tenantId(), reservationId).orElse(null);
    if (latest != null) latest = payments.refreshExpiry(latest);
    String currency = quote != null ? quote.deposit().currency() : policy == null ? null : policy.deposit().currency();
    List<MerchantPaymentMethod> all = methods.list(view.tenantId());
    List<PaymentViews.PublicPaymentMethod> effective = selectableMethods(view, all, currency);
    PaymentViews.PublicPaymentMethod historicalMethod = null;
    if (latest != null && (latest.status() == Payment.Status.PENDING || latest.status() == Payment.Status.PENDING_MANUAL_VERIFICATION)) {
      UUID originalMethodId = latest.methodId();
      MerchantPaymentMethod original = all.stream().filter(method -> method.id().equals(originalMethodId))
          .findFirst().orElse(null);
      if (original != null) historicalMethod = PaymentViews.PublicPaymentMethod.from(original, simulationPath(original));
      if (latest.provider() == PaymentProvider.MOCK_GATEWAY) effective = List.of();
    }
    String reason = unavailableReason(view, policy, quote, effective, latest);
    String amount = quote != null ? quote.deposit().amount().toPlainString()
        : policy == null ? null : policy.deposit().amount().toPlainString();
    String total = quote != null ? quote.total() == null ? null : quote.total().amount().toPlainString()
        : policy == null || policy.total() == null ? null : policy.total().amount().toPlainString();
    PaymentViews.PaymentAttempt attempt = latest == null ? null : PaymentViews.PaymentAttempt.from(latest, quote);
    String paid = attempt == null ? "0" : attempt.paidAmount();
    return new PaymentViews.PublicCheckout(PaymentViews.ReservationCheckout.from(view), reason == null, reason,
        currency, amount, total, paid, PaymentViews.balance(total, paid), effective, historicalMethod, attempt);
  }

  @Transactional
  public PaymentViews.PaymentAttempt start(String tenantSlug, String establishmentSlug, UUID reservationId,
      String token, UUID methodId, UUID requestId) {
    Objects.requireNonNull(methodId, "methodId"); Objects.requireNonNull(requestId, "requestId");
    PaymentReservationAccessPort.ReservationView view = access.authorize(tenantSlug, establishmentSlug, reservationId, token);
    access.lock(view.tenantId(), reservationId);
    if (!configuration.lockEstablishment(view.tenantId(), view.establishmentId())) throw new PaymentMethodService.NotFound();
    if (repository.findByRequest(view.tenantId(), reservationId, requestId).isPresent()) {
      Payment replay = payments.start(view.tenantId(), reservationId, methodId, requestId);
      return PaymentViews.PaymentAttempt.from(replay, configuration.quote(view.tenantId(), reservationId).orElse(null));
    }
    if (configuration.policy(view.tenantId(), view.establishmentId()).filter(PaymentPolicy::enabled).isEmpty()) {
      throw new PaymentService.Conflict("La política de cobro no está habilitada");
    }
    PaymentPolicy policy = configuration.policy(view.tenantId(), view.establishmentId()).orElseThrow();
    ReservationPaymentQuote quote = configuration.quote(view.tenantId(), reservationId).orElse(null);
    String currency = quote == null ? policy.deposit().currency() : quote.deposit().currency();
    MerchantPaymentMethod method = methods.find(view.tenantId(), methodId).orElseThrow(PaymentMethodService.NotFound::new);
    if (!isSelectable(view, method, methods.list(view.tenantId()), currency)) {
      throw new IllegalArgumentException("Método no disponible para esta reserva");
    }
    Payment payment = payments.start(view.tenantId(), reservationId, methodId, requestId);
    return PaymentViews.PaymentAttempt.from(payment, configuration.quote(view.tenantId(), reservationId).orElse(null));
  }

  @Transactional(readOnly = true)
  public Payment paymentForSimulation(String tenantSlug, String establishmentSlug, UUID reservationId,
      String token, UUID paymentId) {
    PaymentReservationAccessPort.ReservationView view = access.authorize(tenantSlug, establishmentSlug, reservationId, token);
    Payment payment = repository.find(view.tenantId(), paymentId).orElseThrow(PaymentMethodService.NotFound::new);
    if (!payment.reservationId().equals(reservationId) || !payment.establishmentId().equals(view.establishmentId())
        || payment.provider() != PaymentProvider.MOCK_GATEWAY) throw new PaymentMethodService.NotFound();
    return payment;
  }

  @Transactional(readOnly = true)
  public PaymentViews.PaymentAttempt simulationResult(String tenantSlug, String establishmentSlug, UUID reservationId,
      String token, UUID paymentId) {
    Payment payment = paymentForSimulation(tenantSlug, establishmentSlug, reservationId, token, paymentId);
    return PaymentViews.PaymentAttempt.from(payment, configuration.quote(payment.tenantId(), payment.reservationId()).orElse(null));
  }

  private @Nullable String unavailableReason(PaymentReservationAccessPort.ReservationView view,
      @Nullable PaymentPolicy policy, @Nullable ReservationPaymentQuote quote,
      List<PaymentViews.PublicPaymentMethod> effective, @Nullable Payment latest) {
    if (latest != null && latest.status() == Payment.Status.CONFIRMED) return "PAYMENT_CONFIRMED";
    if (latest != null && latest.status() == Payment.Status.RECONCILIATION_REQUIRED) return "PAYMENT_RECONCILIATION_REQUIRED";
    if (latest != null && latest.provider() == PaymentProvider.MOCK_GATEWAY
        && (latest.status() == Payment.Status.PENDING || latest.status() == Payment.Status.PENDING_MANUAL_VERIFICATION)) {
      return "PAYMENT_PENDING";
    }
    if (!view.status().equals("CREATED")) return "RESERVATION_NOT_PAYABLE";
    if (policy == null || !policy.enabled()) return "PAYMENT_POLICY_DISABLED";
    if (!clock.instant().isBefore(view.endsAt())
        || (quote != null && !clock.instant().isBefore(quote.expiresAt()))) return "PAYMENT_WINDOW_EXPIRED";
    if (effective.isEmpty()) return "PAYMENT_METHOD_UNAVAILABLE";
    return null;
  }

  private List<PaymentViews.PublicPaymentMethod> selectableMethods(
      PaymentReservationAccessPort.ReservationView view, List<MerchantPaymentMethod> all, @Nullable String currency) {
    List<MerchantPaymentMethod> legacyAndTraditional = all.stream()
        .filter(method -> method.mockQrConfigurationId() == null).toList();
    boolean local = legacyAndTraditional.stream().anyMatch(method -> view.establishmentId().equals(method.establishmentId()));
    List<MerchantPaymentMethod> traditional = legacyAndTraditional.stream()
        .filter(method -> method.provider() != PaymentProvider.MOCK_GATEWAY).toList();
    List<PaymentViews.PublicPaymentMethod> result = new ArrayList<>(traditional.stream()
        .filter(method -> local ? view.establishmentId().equals(method.establishmentId()) : method.establishmentId() == null)
        .filter(method -> method.enabled() && currency != null && method.currency().equals(currency))
        .map(method -> PaymentViews.PublicPaymentMethod.from(method, null)).toList());

    MockQrConfiguration config = mockQrConfigurations.findByEstablishment(view.tenantId(), view.establishmentId()).orElse(null);
    if (config != null && config.enabled() && currency != null && gateway.capabilities().webhooks()) {
      all.stream().filter(method -> isCurrentProjection(method, config) && method.enabled()
          && method.currency().equals(currency))
          .map(method -> PaymentViews.PublicPaymentMethod.from(method, config.simulationPath()))
          .forEach(result::add);
    }
    return result;
  }

  private boolean isSelectable(PaymentReservationAccessPort.ReservationView view,
      MerchantPaymentMethod method, List<MerchantPaymentMethod> all, String currency) {
    if (!method.enabled() || !method.currency().equals(currency)) return false;
    if (method.provider() == PaymentProvider.MOCK_GATEWAY) {
      if (!gateway.capabilities().webhooks() || method.mockQrConfigurationId() == null || method.supersededAt() != null
          || !view.establishmentId().equals(method.establishmentId())) return false;
      MockQrConfiguration config = mockQrConfigurations.findByEstablishment(view.tenantId(), view.establishmentId()).orElse(null);
      return config != null && config.enabled() && config.id().equals(method.mockQrConfigurationId());
    }
    List<MerchantPaymentMethod> legacyAndTraditional = all.stream()
        .filter(candidate -> candidate.mockQrConfigurationId() == null).toList();
    boolean local = legacyAndTraditional.stream().anyMatch(candidate -> view.establishmentId().equals(candidate.establishmentId()));
    List<MerchantPaymentMethod> traditional = legacyAndTraditional.stream()
        .filter(candidate -> candidate.provider() != PaymentProvider.MOCK_GATEWAY).toList();
    return traditional.stream().anyMatch(candidate -> candidate.id().equals(method.id())
        && (local ? view.establishmentId().equals(candidate.establishmentId()) : candidate.establishmentId() == null));
  }

  private boolean isCurrentProjection(MerchantPaymentMethod method, MockQrConfiguration config) {
    return method.provider() == PaymentProvider.MOCK_GATEWAY && method.mockQrConfigurationId() != null
        && method.mockQrConfigurationId().equals(config.id()) && method.supersededAt() == null
        && config.establishmentId().equals(method.establishmentId());
  }

  private @Nullable String simulationPath(MerchantPaymentMethod method) {
    return method.mockQrConfigurationId() == null ? null
        : mockQrConfigurations.find(method.tenantId(), method.mockQrConfigurationId())
            .map(MockQrConfiguration::simulationPath).orElse(null);
  }
}
