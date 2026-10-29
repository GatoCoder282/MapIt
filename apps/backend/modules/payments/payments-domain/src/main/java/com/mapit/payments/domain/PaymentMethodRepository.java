package com.mapit.payments.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

public interface PaymentMethodRepository {
  List<MerchantPaymentMethod> list(TenantId tenantId);
  Optional<MerchantPaymentMethod> find(TenantId tenantId, UUID id);
  Optional<MerchantPaymentMethod> projection(TenantId tenantId, UUID mockQrConfigurationId);
  Optional<MerchantPaymentMethod> lock(TenantId tenantId, UUID id);
  boolean hasPayments(TenantId tenantId, UUID id);
  void supersede(TenantId tenantId, UUID id, java.time.Instant at, UUID actorId);
  boolean establishmentExists(TenantId tenantId, UUID establishmentId);
  MerchantPaymentMethod insert(MerchantPaymentMethod method);
  boolean update(MerchantPaymentMethod method);
}
