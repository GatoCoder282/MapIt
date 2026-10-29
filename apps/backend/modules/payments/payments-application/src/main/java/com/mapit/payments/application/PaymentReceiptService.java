package com.mapit.payments.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.payments.domain.Payment;
import com.mapit.payments.domain.PaymentConfigurationRepository;
import com.mapit.payments.domain.PaymentReceiptRepository;
import com.mapit.payments.domain.PaymentReceiptRepository.StoredReceipt;
import com.mapit.payments.domain.PaymentRepository;
import com.mapit.payments.domain.PaymentReservationAccessPort;
import com.mapit.payments.domain.ReservationPaymentQuote;
import com.mapit.payments.domain.receipt.ReceiptToken;
import com.mapit.shared.tenant.TenantId;

@Service
public class PaymentReceiptService {
  private final PaymentReservationAccessPort access;
  private final PaymentRepository payments;
  private final PaymentReceiptRepository receipts;
  private final PaymentConfigurationRepository configuration;
  private final Clock clock;

  public PaymentReceiptService(PaymentReservationAccessPort access, PaymentRepository payments,
      PaymentReceiptRepository receipts, PaymentConfigurationRepository configuration, Clock clock) {
    this.access = access; this.payments = payments; this.receipts = receipts;
    this.configuration = configuration; this.clock = clock;
  }

  @Transactional
  public PaymentViews.PaymentReceipt issue(String tenantSlug, String establishmentSlug, UUID reservationId, String capability) {
    PaymentReservationAccessPort.ReservationView view = access.authorize(tenantSlug, establishmentSlug, reservationId, capability);
    access.lock(view.tenantId(), reservationId);
    view = access.read(view.tenantId(), reservationId);
    Payment confirmed = requireConfirmed(view);
    Instant now = clock.instant();
    Instant expires = view.endsAt().plus(Duration.ofHours(24));
    if (!expires.isAfter(now)) throw new PaymentMethodService.NotFound();
    ReceiptToken token = ReceiptToken.generate();
    receipts.insert(new StoredReceipt(UUID.randomUUID(), view.tenantId(), view.establishmentId(), reservationId,
        confirmed.id(), token.hash(), now, expires, null));
    String path = "/comprobante/" + token.presentationValue() + "?tenantSlug=" + view.tenantSlug() + "&establishmentSlug=" + view.establishmentSlug();
    return present(view, confirmed, token.presentationValue(), path, expires);
  }

  @Transactional(readOnly = true)
  public PaymentViews.PaymentReceipt read(String tenantSlug, String establishmentSlug, String token) {
    TenantId tenant = access.resolveTenant(tenantSlug, establishmentSlug);
    // Se consulta con tenant y slug de local; nunca se omite RLS para localizar un token.
    String hash;
    try { hash = ReceiptToken.hashOf(token); } catch (IllegalArgumentException exception) { throw new PaymentMethodService.NotFound(); }
    StoredReceipt stored = receipts.findByHash(tenant, hash).orElseThrow(PaymentMethodService.NotFound::new);
    PaymentViews.PaymentReceipt result = readStored(stored, token);
    if (!result.reservation().tenantSlug().equals(tenantSlug)
        || !result.reservation().establishmentSlug().equals(establishmentSlug)) throw new PaymentMethodService.NotFound();
    return result;
  }

  @Transactional(readOnly = true)
  public PaymentViews.PaymentReceipt readForOperator(TenantId tenant, UUID establishmentId, String token) {
    String hash;
    try { hash = ReceiptToken.hashOf(token); } catch (IllegalArgumentException exception) { throw new PaymentMethodService.NotFound(); }
    StoredReceipt stored = receipts.find(tenant, establishmentId, hash).orElseThrow(PaymentMethodService.NotFound::new);
    return readStored(stored, token);
  }

  private PaymentViews.PaymentReceipt readStored(StoredReceipt stored, String token) {
    if (!stored.credential().accepts(stored.tenantId(), stored.reservationId(), token, clock.instant())) throw new PaymentMethodService.NotFound();
    PaymentReservationAccessPort.ReservationView view = access.read(stored.tenantId(), stored.reservationId());
    if (!view.establishmentId().equals(stored.establishmentId())) throw new PaymentMethodService.NotFound();
    Payment confirmed = requireConfirmed(view);
    if (!confirmed.id().equals(stored.paymentId())) throw new PaymentMethodService.NotFound();
    return present(view, confirmed, null, null, stored.expiresAt());
  }

  private Payment requireConfirmed(PaymentReservationAccessPort.ReservationView view) {
    if (!view.status().equals("CONFIRMED") && !view.status().equals("ACTIVE")) throw new PaymentMethodService.NotFound();
    return payments.confirmed(view.tenantId(), view.id()).filter(payment -> payment.verifiedAt() != null)
        .orElseThrow(PaymentMethodService.NotFound::new);
  }

  private PaymentViews.PaymentReceipt present(PaymentReservationAccessPort.ReservationView view, Payment payment,
      @Nullable String token, @Nullable String path, Instant expires) {
    ReservationPaymentQuote quote = configuration.quote(view.tenantId(), view.id()).orElse(null);
    PaymentViews.PaymentAttempt attempt = PaymentViews.PaymentAttempt.from(payment, quote);
    return new PaymentViews.PaymentReceipt(token, path, PaymentViews.ReservationCheckout.from(view), attempt,
        attempt.paidAmount(), attempt.currency(), attempt.totalAmount(), PaymentViews.balance(attempt.totalAmount(), attempt.paidAmount()),
        view.status().equals("ACTIVE") ? "CHECKED_IN" : "NOT_CHECKED_IN", expires);
  }
}
