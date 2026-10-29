package com.mapit.payments.application;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.payments.domain.MerchantPaymentMethod;
import com.mapit.payments.domain.PaymentMethodRepository;
import com.mapit.payments.domain.PaymentProvider;
import com.mapit.shared.security.ActorContext;
import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;

public class PaymentMethodService {
  private final PaymentMethodRepository repository;
  private final TenantContext tenants;
  private final ActorContext actors;
  private final Clock clock;
  private final boolean mockAllowed;

  public PaymentMethodService(PaymentMethodRepository repository, TenantContext tenants,
      ActorContext actors, Clock clock, boolean mockAllowed) {
    this.repository = repository; this.tenants = tenants; this.actors = actors;
    this.clock = clock; this.mockAllowed = mockAllowed;
  }

  @Transactional(readOnly = true)
  public List<MerchantPaymentMethod> list(@Nullable UUID establishmentId) {
    TenantId tenant = tenants.require();
    List<MerchantPaymentMethod> all = repository.list(tenant).stream()
        .filter(method -> method.mockQrConfigurationId() == null).toList();
    if (establishmentId == null) return all;
    requireEstablishment(tenant, establishmentId);
    List<MerchantPaymentMethod> local = all.stream().filter(m -> establishmentId.equals(m.establishmentId())).toList();
    return local.isEmpty() ? all.stream().filter(m -> m.establishmentId() == null).toList() : local;
  }

  @Transactional
  public MerchantPaymentMethod create(Draft draft) {
    TenantId tenant = tenants.require();
    UUID actor = actors.requireUserId();
    Instant now = clock.instant();
    validate(tenant, draft);
    if (draft.accountHolderName() == null || draft.accountHolderName().isBlank()) throw new IllegalArgumentException("Titular requerido");
    return repository.insert(toMethod(UUID.randomUUID(), tenant, draft, now, now, actor, actor));
  }

  @Transactional
  public MerchantPaymentMethod update(UUID id, Draft draft) {
    TenantId tenant = tenants.require();
    MerchantPaymentMethod original = repository.lock(tenant, id).orElseThrow(NotFound::new);
    if (original.mockQrConfigurationId() != null) {
      throw new PaymentService.Conflict("La proyección MOCK solo se modifica desde su configuración QR y política");
    }
    validate(tenant, draft);
    MerchantPaymentMethod changed = toMethod(id, tenant, draft, original.createdAt(), clock.instant(),
        original.createdBy(), actors.requireUserId());
    boolean sensitiveChange = !Objects.equals(original.establishmentId(), changed.establishmentId())
        || original.provider() != changed.provider() || !original.currency().equals(changed.currency())
        || !original.country().equals(changed.country()) || !original.bankName().equals(changed.bankName())
        || !original.accountReference().equals(changed.accountReference())
        || (original.accountHolderName() != null && !Objects.equals(original.accountHolderName(), changed.accountHolderName()))
        || !Objects.equals(original.staticQrImage(), changed.staticQrImage());
    if (sensitiveChange && repository.hasPayments(tenant, id)) {
      throw new PaymentService.Conflict("Un método utilizado conserva su cuenta y QR; registre otro método");
    }
    if (!repository.update(changed)) throw new NotFound();
    return changed;
  }

  private void validate(TenantId tenant, Draft draft) {
    if (draft.enabled() && (draft.accountHolderName() == null || draft.accountHolderName().isBlank())) throw new IllegalArgumentException("Titular requerido para habilitar cobro");
    if (draft.establishmentId() != null) requireEstablishment(tenant, draft.establishmentId());
    if (draft.provider() == PaymentProvider.MOCK_GATEWAY && draft.enabled() && !mockAllowed) {
      throw new IllegalArgumentException("El mock requiere entorno dev/test y habilitación explícita");
    }
  }

  private void requireEstablishment(TenantId tenant, UUID id) {
    if (!repository.establishmentExists(tenant, id)) throw new NotFound();
  }

  private static MerchantPaymentMethod toMethod(UUID id, TenantId tenant, Draft d,
      Instant createdAt, Instant updatedAt, UUID createdBy, UUID updatedBy) {
    return new MerchantPaymentMethod(id, tenant, d.establishmentId(), d.displayName(), d.country(),
        d.currency(), d.provider(), d.bankName(), d.accountReference(), d.staticQrImage(), d.enabled(),
        createdAt, updatedAt, createdBy, updatedBy, d.accountHolderName());
  }

  public record Draft(@Nullable UUID establishmentId, String displayName, String country,
      String currency, PaymentProvider provider, String bankName, String accountReference,
      @Nullable String staticQrImage, boolean enabled, @Nullable String accountHolderName) {
    public Draft(@Nullable UUID establishmentId, String displayName, String country, String currency,
        PaymentProvider provider, String bankName, String accountReference, @Nullable String staticQrImage, boolean enabled) {
      this(establishmentId, displayName, country, currency, provider, bankName, accountReference, staticQrImage, enabled, null);
    }
  }

  public static class NotFound extends RuntimeException {
    public NotFound() { super("Método de pago o establecimiento no encontrado"); }
  }
}
