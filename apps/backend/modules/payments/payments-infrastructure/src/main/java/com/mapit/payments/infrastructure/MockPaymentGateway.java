package com.mapit.payments.infrastructure;

import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import com.mapit.payments.domain.Money;
import com.mapit.payments.domain.Payment;
import com.mapit.payments.domain.PaymentGatewayPort;

/** Simulador de pruebas aislado; no registrado como pasarela productiva ni endpoint público. */
public final class MockPaymentGateway implements PaymentGatewayPort {
  private final Clock clock;
  private final Map<String, Optional<Payment.Outcome>> outcomes = new ConcurrentHashMap<>();

  public MockPaymentGateway(boolean enabled, Set<String> profiles, Clock clock) {
    if (!enabled || profiles.isEmpty() || !profiles.stream().allMatch(p -> p.equals("dev") || p.equals("test"))) {
      throw new IllegalArgumentException("El simulador solo está disponible explícitamente en dev/test");
    }
    this.clock = clock;
  }

  @Override
  public Capabilities capabilities() {
    return new Capabilities(false, false, true, true, false, Set.of(), Set.of());
  }

  @Override
  public Session createSession(UUID paymentId, Money money, Instant expiresAt) {
    if (!expiresAt.isAfter(clock.instant())) throw new IllegalArgumentException("Cobro vencido");
    String reference = UUID.randomUUID().toString();
    outcomes.put(reference, Optional.empty());
    return new Session(reference, "mock://payments/" + reference, expiresAt);
  }

  /** Permite repetir y desordenar notificaciones de prueba sin mover dinero real. */
  public void simulate(String reference, Payment.Outcome outcome) {
    if (!outcomes.containsKey(reference)) throw new IllegalArgumentException("Sesión mock no encontrada");
    outcomes.put(reference, Optional.of(outcome));
  }

  @Override
  public Optional<Payment.Outcome> query(String reference) {
    Optional<Payment.Outcome> status = outcomes.get(reference);
    if (status == null) throw new IllegalArgumentException("Sesión mock no encontrada");
    return status;
  }
}
