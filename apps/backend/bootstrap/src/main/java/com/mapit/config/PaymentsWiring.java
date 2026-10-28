package com.mapit.config;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.mapit.payments.domain.Payment;
import com.mapit.payments.domain.PaymentConfigurationRepository;
import com.mapit.payments.domain.PaymentPolicy;
import com.mapit.payments.domain.PaymentReservationAccessPort;
import com.mapit.payments.domain.ReservationPaymentPort;
import com.mapit.payments.domain.ReservationPaymentQuote;
import com.mapit.reservations.application.reservation.PublicReservationAccessService;
import com.mapit.reservations.domain.booking.ReservationAccessView;
import com.mapit.shared.tenant.TenantId;

@Configuration
public class PaymentsWiring {
  @Bean
  PaymentReservationAccessPort paymentReservationAccessPort(PublicReservationAccessService reservations) {
    return new PaymentReservationAccessPort() {
      @Override
      public ReservationView authorize(String tenantSlug, String establishmentSlug, UUID reservationId, String accessToken) {
        ReservationAccessView v = reservations.authorize(tenantSlug, establishmentSlug, reservationId, accessToken);
        return toView(v);
      }
      @Override
      public ReservationView read(TenantId tenantId, UUID reservationId) {
        ReservationAccessView v = reservations.read(tenantId, reservationId);
        return toView(v);
      }
      @Override
      public void lock(TenantId tenantId, UUID reservationId) {
        reservations.lockRow(tenantId, reservationId);
      }
      @Override
      public TenantId resolveTenant(String tenantSlug, String establishmentSlug) {
        return reservations.resolveTenant(tenantSlug, establishmentSlug);
      }
      private ReservationView toView(ReservationAccessView v) {
        List<PaymentReservationAccessPort.Space> spaces = v.spaces().stream()
            .map(s -> new PaymentReservationAccessPort.Space(s.id(), s.name(), s.floor(), s.sector(), s.state(), s.type(), s.label(), s.capacity(), s.x(), s.y()))
            .toList();
        return new ReservationView(v.tenantId(), v.id(), v.establishmentId(), v.establishmentName(),
            v.tenantSlug(), v.establishmentSlug(), v.startsAt(), v.endsAt(), v.timezone(), v.status().name(), spaces);
      }
    };
  }

  @Bean
  ReservationPaymentPort reservationPaymentPort(PublicReservationAccessService reservations,
      PaymentConfigurationRepository configuration, Clock clock) {
    return new ReservationPaymentPort() {
      @Override
      public Quote quote(TenantId tenantId, UUID reservationId) {
        ReservationAccessView view = reservations.read(tenantId, reservationId);
        Optional<ReservationPaymentQuote> existing = configuration.quote(tenantId, reservationId);
        if (existing.isPresent()) {
          ReservationPaymentQuote q = existing.get();
          return new Quote(q.establishmentId(), q.reservationId(), q.deposit(), q.expiresAt());
        }
        PaymentPolicy policy = configuration.policy(tenantId, view.establishmentId())
            .filter(PaymentPolicy::enabled)
            .orElseThrow(() -> new IllegalArgumentException("No hay política de pago habilitada"));
        Instant now = clock.instant();
        Instant expiresAt = now.plus(java.time.Duration.ofMinutes(policy.paymentWindowMinutes()));
        if (expiresAt.isAfter(view.endsAt())) expiresAt = view.endsAt();
        if (!expiresAt.isAfter(now)) throw new IllegalArgumentException("Reserva vencida");
        ReservationPaymentQuote quote = new ReservationPaymentQuote(UUID.randomUUID(), tenantId,
            view.establishmentId(), reservationId, policy.deposit(), policy.total(),
            policy.paymentWindowMinutes(), now, expiresAt);
        configuration.insertQuote(quote);
        return new Quote(quote.establishmentId(), quote.reservationId(), quote.deposit(), quote.expiresAt());
      }
      @Override
      public boolean confirm(Payment payment) {
        return reservations.confirm(payment.tenantId(), payment.reservationId(), payment.id());
      }
    };
  }

}
