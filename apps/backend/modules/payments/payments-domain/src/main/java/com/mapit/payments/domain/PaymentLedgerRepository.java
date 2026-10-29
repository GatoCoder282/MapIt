package com.mapit.payments.domain;

import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

import com.mapit.shared.tenant.TenantId;

public interface PaymentLedgerRepository {
  record Entry(Payment payment,String establishmentName,String methodName) {}
  record Page(List<Entry> items,long total) { public Page { items=List.copyOf(items); } }
  Page list(TenantId tenant,UUID establishmentId,Payment.@Nullable Status status,int limit,int offset);
}
