package com.mapit.payments.application;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

import com.mapit.payments.domain.MerchantPaymentMethod;
import com.mapit.payments.domain.Payment;
import com.mapit.payments.domain.PaymentProvider;
import com.mapit.payments.domain.PaymentReservationAccessPort;
import com.mapit.payments.domain.ReservationPaymentQuote;

/** Proyecciones de transporte públicas: no serializan tenant interno, comercio ni credenciales. */
public final class PaymentViews {
  private PaymentViews() {}

  public record ReservationCheckout(UUID id, UUID establishmentId, String establishmentName,
      String tenantSlug, String establishmentSlug, Instant startsAt, Instant endsAt, String timezone,
      String status, List<PaymentReservationAccessPort.Space> spaces) {
    public static ReservationCheckout from(PaymentReservationAccessPort.ReservationView v) {
      return new ReservationCheckout(v.id(), v.establishmentId(), v.establishmentName(), v.tenantSlug(),
          v.establishmentSlug(), v.startsAt(), v.endsAt(), v.timezone(), v.status(), v.spaces());
    }
  }

  public record PublicPaymentMethod(UUID id, String displayName, PaymentProvider provider,
      String verification, @Nullable String staticQrImage, @Nullable String simulationPath) {
    public static PublicPaymentMethod from(MerchantPaymentMethod method, @Nullable String simulationPath) {
      return new PublicPaymentMethod(method.id(), method.displayName(), method.provider(), method.verification(),
          method.staticQrImage(), simulationPath);
    }
  }

  public record PaymentAttempt(UUID id, Payment.Status status, PaymentProvider provider,
      String amount, String currency, @Nullable String totalAmount, String paidAmount,
      Instant expiresAt, String externalReference) {
    public static PaymentAttempt from(Payment payment, @Nullable ReservationPaymentQuote quote) {
      String total = quote == null || quote.total() == null ? null : quote.total().amount().toPlainString();
      return new PaymentAttempt(payment.id(), payment.status(), payment.provider(), payment.money().amount().toPlainString(),
          payment.money().currency(), total, payment.verifiedAt() == null ? "0" : payment.money().amount().toPlainString(),
          payment.expiresAt(), payment.externalReference());
    }
  }

  public record PublicCheckout(ReservationCheckout reservation, boolean available,
      @Nullable String unavailableReason, @Nullable String currency, @Nullable String amount,
      @Nullable String totalAmount, String paidAmount, @Nullable String balanceAmount,
      List<PublicPaymentMethod> methods, @Nullable PublicPaymentMethod historicalMethod,
      @Nullable PaymentAttempt payment) {}

  public record PaymentReceipt(@Nullable String token, @Nullable String url,
      ReservationCheckout reservation, PaymentAttempt payment, String paidAmount, String currency,
      @Nullable String totalAmount, @Nullable String balanceAmount, String checkIn, Instant expiresAt) {}

  public static @Nullable String balance(@Nullable String total, String paid) {
    return total == null ? null : new BigDecimal(total).subtract(new BigDecimal(paid)).max(BigDecimal.ZERO).toPlainString();
  }
}
