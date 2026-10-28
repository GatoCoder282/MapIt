package com.mapit.payments.application;

import java.time.Clock;
import java.time.Instant;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.springframework.transaction.annotation.Transactional;

import com.mapit.payments.domain.MerchantPaymentMethod;
import com.mapit.payments.domain.MockQrConfiguration;
import com.mapit.payments.domain.MockQrConfigurationRepository;
import com.mapit.payments.domain.PaymentConfigurationRepository;
import com.mapit.payments.domain.PaymentMethodRepository;
import com.mapit.payments.domain.PaymentProvider;
import com.mapit.shared.security.ActorContext;
import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;

/** Persiste exclusivamente configuración de simulación; no depende de puertos de pagos. */
public class MockQrConfigurationService {
  private final MockQrConfigurationRepository repository;
  private final PaymentConfigurationRepository paymentConfiguration;
  private final PaymentMethodRepository methods;
  private final TenantContext tenants;
  private final ActorContext actors;
  private final Clock clock;
  private final boolean allowed;

  public MockQrConfigurationService(MockQrConfigurationRepository repository,
      PaymentConfigurationRepository paymentConfiguration, PaymentMethodRepository methods,
      TenantContext tenants, ActorContext actors, Clock clock, boolean allowed) {
    this.repository = repository; this.paymentConfiguration = paymentConfiguration; this.methods = methods;
    this.tenants = tenants; this.actors = actors;
    this.clock = clock; this.allowed = allowed;
  }

  @Transactional(readOnly = true)
  public List<MockQrConfiguration> list() {
    requireAllowed();
    return repository.list(tenants.require());
  }

  @Transactional(readOnly = true)
  public MockQrConfiguration get(UUID id) {
    requireAllowed();
    return repository.find(tenants.require(), id).orElseThrow(NotFound::new);
  }

  public List<Country> countries() {
    requireAllowed();
    tenants.require();
    return Arrays.stream(Locale.getISOCountries())
        .map(code -> new Country(code, Locale.of("", code).getDisplayCountry(Locale.forLanguageTag("es"))))
        .sorted(Comparator.comparing(Country::name)).toList();
  }

  @Transactional
  public MockQrConfiguration create(Draft draft) {
    requireAllowed();
    TenantId tenant = tenants.require();
    requireEstablishment(tenant, draft.establishmentId());
    lockEstablishment(tenant, draft.establishmentId());
    UUID actor = actors.requireUserId();
    Instant now = clock.instant();
    var created = toConfiguration(UUID.randomUUID(), tenant, draft, UUID.randomUUID(), now, now, actor, actor);
    if (!repository.insert(created)) throw new MockQrConfigurationRepository.Duplicate();
    synchronizeProjection(tenant, draft.establishmentId(), actor, now);
    return created;
  }

  @Transactional
  public MockQrConfiguration update(UUID id, Draft draft) {
    requireAllowed();
    TenantId tenant = tenants.require();
    requireEstablishment(tenant, draft.establishmentId());
    lockEstablishment(tenant, draft.establishmentId());
    var previous = repository.lock(tenant, id).orElseThrow(NotFound::new);
    if (!previous.establishmentId().equals(draft.establishmentId())) {
      throw new IllegalArgumentException("No se puede trasladar una configuración QR a otro establecimiento");
    }
    var changed = toConfiguration(id, tenant, draft, previous.simulationToken(), previous.createdAt(),
        clock.instant(), previous.createdBy(), actors.requireUserId());
    if (!repository.update(changed)) throw new NotFound();
    synchronizeProjection(tenant, draft.establishmentId(), changed.updatedBy(), changed.updatedAt());
    return changed;
  }

  @Transactional
  public MockQrConfiguration regenerate(UUID id) {
    requireAllowed();
    TenantId tenant = tenants.require();
    var previous = repository.lock(tenant, id).orElseThrow(NotFound::new);
    requireEstablishment(tenant, previous.establishmentId());
    var changed = toConfiguration(id, tenant, new Draft(previous.establishmentId(), previous.country(),
        previous.bankName(), previous.accountHolderName(), previous.accountReference(), previous.enabled()),
        UUID.randomUUID(), previous.createdAt(), clock.instant(), previous.createdBy(), actors.requireUserId());
    if (!repository.update(changed)) throw new NotFound();
    return changed;
  }

  private void requireAllowed() { if (!allowed) throw new Disabled(); }
  private void lockEstablishment(TenantId tenant, UUID establishmentId) {
    if (!paymentConfiguration.lockEstablishment(tenant, establishmentId)) throw new NotFound();
  }

  /** Invocado tras guardar la policy, manteniendo el lock adquirido por ese flujo. */
  public void synchronizeAfterPolicySave(TenantId tenant, UUID establishmentId, UUID actorId, Instant now) {
    if (!allowed) return;
    synchronizeProjection(tenant, establishmentId, actorId, now);
  }

  private void synchronizeProjection(TenantId tenant, UUID establishmentId, UUID actorId, Instant now) {
    var config = repository.findByEstablishment(tenant, establishmentId).orElse(null);
    var policy = paymentConfiguration.policy(tenant, establishmentId).orElse(null);
    if (config == null || policy == null) return;

    var current = methods.projection(tenant, config.id()).orElse(null);
    UUID id = current == null ? UUID.randomUUID() : current.id();
    MerchantPaymentMethod projection = new MerchantPaymentMethod(id, tenant, establishmentId,
        "QR de prueba", config.country(), policy.deposit().currency(), PaymentProvider.MOCK_GATEWAY,
        config.bankName(), config.accountReference(), null, config.enabled(),
        current == null ? now : current.createdAt(), now,
        current == null ? actorId : current.createdBy(), actorId, config.accountHolderName(), config.id(), null);

    if (current == null) {
      methods.insert(projection);
    } else if (methods.hasPayments(tenant, current.id()) && sensitiveChange(current, projection)) {
      methods.supersede(tenant, current.id(), now, actorId);
      methods.insert(new MerchantPaymentMethod(UUID.randomUUID(), tenant, establishmentId,
          projection.displayName(), projection.country(), projection.currency(), projection.provider(),
          projection.bankName(), projection.accountReference(), null, projection.enabled(), now, now,
          actorId, actorId, projection.accountHolderName(), config.id(), null));
    } else if (!methods.update(projection)) {
      throw new IllegalStateException("La proyección MOCK dejó de existir durante la sincronización");
    }
  }

  private static boolean sensitiveChange(MerchantPaymentMethod before, MerchantPaymentMethod after) {
    return !before.currency().equals(after.currency()) || !before.country().equals(after.country())
        || !before.bankName().equals(after.bankName())
        || !before.accountReference().equals(after.accountReference())
        || !java.util.Objects.equals(before.accountHolderName(), after.accountHolderName());
  }

  private void requireEstablishment(TenantId tenant, UUID id) {
    if (!repository.establishmentExists(tenant, id)) throw new NotFound();
  }
  private static MockQrConfiguration toConfiguration(UUID id, TenantId tenant, Draft d,
      UUID token, Instant createdAt, Instant updatedAt, UUID createdBy, UUID updatedBy) {
    return new MockQrConfiguration(id, tenant, d.establishmentId(), d.country(), d.bankName(),
        d.accountHolderName(), d.accountReference(), d.enabled(), token, createdAt, updatedAt, createdBy, updatedBy);
  }

  public record Draft(UUID establishmentId, String country, String bankName, String accountHolderName,
      String accountReference, boolean enabled) {}
  public record Country(String code, String name) {}
  public static class Disabled extends RuntimeException { public Disabled() { super("Configuración MOCK no disponible"); } }
  public static class NotFound extends RuntimeException { public NotFound() { super("Configuración o establecimiento no encontrado"); } }
}
