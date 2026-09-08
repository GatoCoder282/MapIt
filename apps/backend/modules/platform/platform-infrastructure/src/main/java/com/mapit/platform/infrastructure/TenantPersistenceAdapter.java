package com.mapit.platform.infrastructure;

import org.springframework.stereotype.Repository;

import com.mapit.platform.domain.Tenant;
import com.mapit.platform.domain.TenantRepository;

/** Adaptador que conecta el puerto de tenants con Spring Data JPA. */
@Repository
class TenantPersistenceAdapter implements TenantRepository {

  private final TenantSpringDataRepository repository;

  TenantPersistenceAdapter(TenantSpringDataRepository repository) {
    this.repository = repository;
  }

  @Override
  public boolean existsBySlug(String slug) {
    return repository.existsBySlug(slug);
  }

  @Override
  public Tenant save(Tenant tenant) {
    return repository.save(TenantJpaEntity.fromDomain(tenant)).toDomain();
  }
}
