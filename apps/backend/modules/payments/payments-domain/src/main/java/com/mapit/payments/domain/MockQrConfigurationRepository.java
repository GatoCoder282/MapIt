package com.mapit.payments.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

public interface MockQrConfigurationRepository {
  List<MockQrConfiguration> list(TenantId tenant);
  Optional<MockQrConfiguration> find(TenantId tenant, UUID id);
  Optional<MockQrConfiguration> findByEstablishment(TenantId tenant, UUID establishmentId);
  Optional<MockQrConfiguration> lock(TenantId tenant, UUID id);
  boolean establishmentExists(TenantId tenant, UUID establishmentId);
  boolean insert(MockQrConfiguration configuration);
  boolean update(MockQrConfiguration configuration);

  /** La restricción tenant/establecimiento se mantiene también ante concurrencia. */
  class Duplicate extends RuntimeException {
    public Duplicate() { super("Ya existe una configuración QR de prueba para este establecimiento"); }
  }
}
