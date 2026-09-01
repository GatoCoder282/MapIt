package com.mapit.spaces.infrastructure;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.DemoItem;
import com.mapit.spaces.domain.DemoItemRepository;

/** Adaptador JPA del puerto de persistencia y activación de RLS para la transacción actual. */
@Repository
public class DemoItemPersistenceAdapter implements DemoItemRepository {

  private final DemoItemSpringDataRepository repository;
  private final JdbcTemplate jdbcTemplate;

  public DemoItemPersistenceAdapter(
      DemoItemSpringDataRepository repository, JdbcTemplate jdbcTemplate) {
    this.repository = repository;
    this.jdbcTemplate = jdbcTemplate;
  }

  @Override
  public List<DemoItem> findAll(TenantId tenantId) {
    setDatabaseTenant(tenantId);
    return repository.findAllByTenantIdOrderByCreatedAtDesc(tenantId.value()).stream()
        .map(DemoItemJpaEntity::toDomain)
        .collect(Collectors.toList());
  }

  @Override
  public Optional<DemoItem> findById(TenantId tenantId, UUID id) {
    setDatabaseTenant(tenantId);
    return repository.findByIdAndTenantId(id, tenantId.value()).map(DemoItemJpaEntity::toDomain);
  }

  @Override
  public DemoItem save(DemoItem item) {
    setDatabaseTenant(item.tenantId());
    return repository.save(DemoItemJpaEntity.fromDomain(item)).toDomain();
  }

  @Override
  public void deleteById(TenantId tenantId, UUID id) {
    setDatabaseTenant(tenantId);
    repository.deleteByIdAndTenantId(id, tenantId.value());
  }

  private void setDatabaseTenant(TenantId tenantId) {
    // set_config(..., true) equivale a SET LOCAL y se revierte al terminar la transacción.
    jdbcTemplate.queryForObject(
        "select set_config('app.tenant_id', ?, true)", String.class, tenantId.value());
  }
}
