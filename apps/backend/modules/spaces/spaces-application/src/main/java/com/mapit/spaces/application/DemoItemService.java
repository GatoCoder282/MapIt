package com.mapit.spaces.application;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.DemoItem;
import com.mapit.spaces.domain.DemoItemRepository;

/** Casos de uso del CRUD de demostración. */
@Service
public class DemoItemService {

  private final DemoItemRepository repository;
  private final TenantContext tenantContext;
  private final Clock clock;

  public DemoItemService(DemoItemRepository repository, TenantContext tenantContext, Clock clock) {
    this.repository = repository;
    this.tenantContext = tenantContext;
    this.clock = clock;
  }

  @Transactional(readOnly = true)
  public List<DemoItem> findAll() {
    return repository.findAll(tenantContext.require());
  }

  @Transactional(readOnly = true)
  public DemoItem findById(UUID id) {
    return repository
        .findById(tenantContext.require(), id)
        .orElseThrow(() -> new DemoItemNotFoundException(id));
  }

  @Transactional
  public DemoItem create(String name, String description, boolean active) {
    TenantId tenantId = tenantContext.require();
    Instant now = clock.instant();
    DemoItem item =
        new DemoItem(UUID.randomUUID(), tenantId, name, description, active, now, now);
    return repository.save(item);
  }

  @Transactional
  public DemoItem update(UUID id, String name, String description, boolean active) {
    TenantId tenantId = tenantContext.require();
    DemoItem current =
        repository
            .findById(tenantId, id)
            .orElseThrow(() -> new DemoItemNotFoundException(id));
    return repository.save(current.update(name, description, active, clock.instant()));
  }

  @Transactional
  public void delete(UUID id) {
    TenantId tenantId = tenantContext.require();
    repository
        .findById(tenantId, id)
        .orElseThrow(() -> new DemoItemNotFoundException(id));
    repository.deleteById(tenantId, id);
  }
}
