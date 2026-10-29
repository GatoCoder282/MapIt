package com.mapit.payments.domain;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

import com.mapit.payments.domain.receipt.ReceiptCredential;
import com.mapit.shared.tenant.TenantId;

public interface PaymentReceiptRepository {
  record StoredReceipt(UUID id, TenantId tenantId, UUID establishmentId, UUID reservationId,
      UUID paymentId, String tokenHash, Instant createdAt, Instant expiresAt, @Nullable Instant revokedAt) {
    public ReceiptCredential credential() {
      return new ReceiptCredential(tenantId, reservationId, tokenHash, createdAt, expiresAt, revokedAt);
    }
  }
  void insert(StoredReceipt receipt);
  Optional<StoredReceipt> find(TenantId tenantId, UUID establishmentId, String tokenHash);
  Optional<StoredReceipt> findByHash(TenantId tenantId, String tokenHash);
}
