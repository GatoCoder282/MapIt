package com.mapit.spaces.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/** Puerto de persistencia del CRUD de demostración. */
public interface DemoItemRepository {

  List<DemoItem> findAll(TenantId tenantId);

  Optional<DemoItem> findById(TenantId tenantId, UUID id);

  DemoItem save(DemoItem item);

  void deleteById(TenantId tenantId, UUID id);
}
