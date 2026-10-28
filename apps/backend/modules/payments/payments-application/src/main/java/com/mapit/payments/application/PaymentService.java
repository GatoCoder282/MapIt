package com.mapit.payments.application;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.payments.domain.MerchantPaymentMethod;
import com.mapit.payments.domain.Money;
import com.mapit.payments.domain.Payment;
import com.mapit.payments.domain.PaymentEventPublisherPort;
import com.mapit.payments.domain.PaymentGatewayPort;
import com.mapit.payments.domain.PaymentMethodRepository;
import com.mapit.payments.domain.PaymentProvider;
import com.mapit.payments.domain.PaymentRepository;
import com.mapit.payments.domain.PaymentReservationAccessPort;
import com.mapit.payments.domain.ReservationPaymentPort;
import com.mapit.shared.security.ActorContext;
import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;

/** Motor transaccional de intentos, confirmación y conciliación mediante puertos propios. */
public class PaymentService {
  private final PaymentRepository payments;
  private final PaymentMethodRepository methods;
  private final ReservationPaymentPort reservations;
  private final PaymentGatewayPort gateway;
  private final TenantContext tenants;
  private final ActorContext actors;
  private final Clock clock;
  private final @Nullable PaymentReservationAccessPort access;
  private final PaymentEventPublisherPort publisher;

  public PaymentService(PaymentRepository payments, PaymentMethodRepository methods,
      ReservationPaymentPort reservations, PaymentGatewayPort gateway,
      TenantContext tenants, ActorContext actors, Clock clock) {
    this(payments, methods, reservations, gateway, tenants, actors, clock, null, payment -> {});
  }

  public PaymentService(PaymentRepository payments, PaymentMethodRepository methods,
      ReservationPaymentPort reservations, PaymentGatewayPort gateway,
      TenantContext tenants, ActorContext actors, Clock clock,
      @Nullable PaymentReservationAccessPort access, PaymentEventPublisherPort publisher) {
    this.payments = payments; this.methods = methods; this.reservations = reservations;
    this.gateway = gateway; this.tenants = tenants; this.actors = actors; this.clock = clock;
    this.access = access; this.publisher = publisher;
  }

  @Transactional
  public Payment start(UUID reservationId, UUID methodId) {
    return start(tenants.require(), reservationId, methodId, null);
  }

  @Transactional
  public Payment start(TenantId tenant, UUID reservationId, UUID methodId, @org.jspecify.annotations.Nullable UUID requestId) {
    lockReservation(tenant, reservationId);
    if (requestId != null) {
      java.util.Optional<Payment> existing = payments.findByRequest(tenant, reservationId, requestId);
      if (existing.isPresent()) {
        if (!existing.get().methodId().equals(methodId)) throw new Conflict("La clave idempotente ya identifica otro método");
        return existing.get();
      }
    }
    if (payments.confirmed(tenant, reservationId).isPresent()) throw new Conflict("La reserva ya tiene un pago confirmado");
    if (payments.reconciliationRequired(tenant, reservationId).isPresent()) throw new Conflict("Hay un ingreso pendiente de conciliación para esta reserva");
    if (access != null && !access.read(tenant, reservationId).status().equals("CREATED")) {
      throw new Conflict("La reserva no admite un nuevo cobro");
    }
    List<Payment> activePending = payments.pending(tenant, reservationId).stream()
        .map(this::refreshExpiry)
        .filter(payment -> payment.status() == Payment.Status.PENDING
            || payment.status() == Payment.Status.PENDING_MANUAL_VERIFICATION)
        .filter(payment -> payment.provider() == PaymentProvider.MOCK_GATEWAY)
        .toList();
    if (!activePending.isEmpty()) {
      Payment pending = activePending.getFirst();
      if (pending.provider() == PaymentProvider.MOCK_GATEWAY && pending.methodId().equals(methodId)
          && activePending.stream().allMatch(other -> other.methodId().equals(methodId))) {
        if (requestId != null) payments.addRequestAlias(pending, requestId);
        return pending;
      }
      throw new Conflict("Hay un intento de pago pendiente para esta reserva");
    }
    ReservationPaymentPort.Quote quote = reservations.quote(tenant, reservationId);
    MerchantPaymentMethod method = methods.lock(tenant, methodId).orElseThrow(PaymentMethodService.NotFound::new);
    boolean hasLocalConfiguration = methods.list(tenant).stream()
        .filter(m -> m.mockQrConfigurationId() == null)
        .anyMatch(m -> quote.establishmentId().equals(m.establishmentId()));
    if (!method.enabled() || !method.currency().equals(quote.deposit().currency())
        || (method.establishmentId() == null && hasLocalConfiguration)
        || (method.establishmentId() != null && !method.establishmentId().equals(quote.establishmentId()))) {
      throw new IllegalArgumentException("Método no disponible para esta reserva");
    }
    if (!reservationId.equals(quote.reservationId())) throw new IllegalArgumentException("Reserva de cotización incorrecta");
    Instant now = clock.instant();
    if (!now.isBefore(quote.expiresAt())) throw new Conflict("La ventana de pago venció");
    UUID id = UUID.randomUUID();
    String reference;
    Payment.Status status;
    if (method.provider() == PaymentProvider.STATIC_BANK_QR) {
      reference = id.toString(); status = Payment.Status.PENDING_MANUAL_VERIFICATION;
    } else if (method.provider() == PaymentProvider.MOCK_GATEWAY) {
      reference = gateway.createSession(id, quote.deposit(), quote.expiresAt()).reference();
      status = Payment.Status.PENDING;
    } else {
      throw new IllegalArgumentException("Pasarela integrada no disponible");
    }
    Payment payment = new Payment(id, tenant, quote.establishmentId(), reservationId, method.id(),
        method.provider(), method.accountReference(), reference, quote.deposit(), status, now,
        quote.expiresAt(), null, null, null);
    Payment inserted = payments.insert(payment, requestId == null ? UUID.randomUUID() : requestId);
    publisher.publish(inserted);
    return inserted;
  }

  /** Solo recibe un evento autenticado por un adaptador, nunca un DTO del navegador. */
  @Transactional
  public Payment process(VerifiedEvent event) {
    Payment before = payments.find(event.tenantId(), event.paymentId()).orElseThrow(PaymentMethodService.NotFound::new);
    lockReservation(before.tenantId(), before.reservationId());
    Payment payment = payments.lock(event.tenantId(), event.paymentId()).orElseThrow(PaymentMethodService.NotFound::new);
    if (payment.provider() != event.provider() || !payment.externalReference().equals(event.externalReference())
        || !payment.merchantReference().equals(event.merchantReference()) || !payment.money().equals(event.money())) {
      throw new IllegalArgumentException("El webhook no coincide con el cobro");
    }
    if (payment.provider() == PaymentProvider.STATIC_BANK_QR) {
      throw new IllegalArgumentException("El QR estático requiere verificación manual");
    }
    Instant now = clock.instant();
    if (!payments.recordEvent(payment, event.eventId(), event.outcome(), now)) return payment;
    return settle(payment, event.outcome(), now, "WEBHOOK", null, event.eventId());
  }

  /** El adaptador HTTP exige ADMIN y el actor se obtiene del contexto autenticado. */
  @Transactional
  public Payment verifyManually(UUID paymentId, String bankReference) {
    if (bankReference == null || bankReference.isBlank() || bankReference.length() > 120) {
      throw new IllegalArgumentException("Referencia bancaria requerida");
    }
    TenantId tenant = tenants.require();
    Payment before = payments.find(tenant, paymentId).orElseThrow(PaymentMethodService.NotFound::new);
    lockReservation(tenant, before.reservationId());
    Payment payment = payments.lock(tenant, paymentId).orElseThrow(PaymentMethodService.NotFound::new);
    if (payment.provider() != PaymentProvider.STATIC_BANK_QR) throw new IllegalArgumentException("El método no admite verificación manual");
    return settle(payment, Payment.Outcome.CONFIRMED, clock.instant(), "MANUAL", actors.requireUserId(), bankReference.strip());
  }

  private Payment settle(Payment payment, Payment.Outcome outcome, Instant now,
      String source, @Nullable UUID actor, String reference) {
    if (payment.status() == Payment.Status.CONFIRMED || payment.status() == Payment.Status.RECONCILIATION_REQUIRED) return payment;
    boolean confirmable = outcome == Payment.Outcome.CONFIRMED && now.isBefore(payment.expiresAt())
        && (payment.status() == Payment.Status.PENDING || payment.status() == Payment.Status.PENDING_MANUAL_VERIFICATION);
    boolean alreadySettled = payments.confirmed(payment.tenantId(), payment.reservationId())
        .filter(existing -> !existing.id().equals(payment.id())).isPresent();
    boolean confirmed = confirmable && !alreadySettled && reservations.confirm(payment);
    Payment changed = payment.apply(outcome, now, confirmed, source, actor);
    if (!changed.equals(payment)) {
      payments.update(changed);
      if (outcome == Payment.Outcome.CONFIRMED) payments.recordVerification(changed, actor, source, reference, now);
      publisher.publish(changed);
    }
    return changed;
  }

  @Transactional
  public Payment refreshExpiry(Payment payment) {
    if (clock.instant().isBefore(payment.expiresAt())
        || (payment.status() != Payment.Status.PENDING && payment.status() != Payment.Status.PENDING_MANUAL_VERIFICATION)) return payment;
    lockReservation(payment.tenantId(), payment.reservationId());
    Payment locked = payments.lock(payment.tenantId(), payment.id()).orElseThrow(PaymentMethodService.NotFound::new);
    return settle(locked, Payment.Outcome.EXPIRED, clock.instant(), "TIMEOUT", null, "timeout");
  }

  private void lockReservation(TenantId tenant, UUID id) {
    if (access != null) access.lock(tenant, id);
  }

  public static class Conflict extends RuntimeException {
    public Conflict(String message) { super(message); }
  }

  public record VerifiedEvent(TenantId tenantId, UUID paymentId, PaymentProvider provider,
      String eventId, String externalReference, String merchantReference, Money money, Payment.Outcome outcome) {
    public VerifiedEvent {
      Objects.requireNonNull(tenantId); Objects.requireNonNull(paymentId); Objects.requireNonNull(provider);
      Objects.requireNonNull(money); Objects.requireNonNull(outcome);
      if (eventId == null || eventId.isBlank() || eventId.length() > 120) throw new IllegalArgumentException("Evento inválido");
    }
  }
}
