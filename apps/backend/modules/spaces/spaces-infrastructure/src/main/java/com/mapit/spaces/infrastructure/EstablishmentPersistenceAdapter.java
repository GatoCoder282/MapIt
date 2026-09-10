package com.mapit.spaces.infrastructure;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.Establishment;
import com.mapit.spaces.domain.EstablishmentRepository;
import com.mapit.spaces.domain.Slug;

/**
 * Adaptador JPA del puerto de establecimientos y activación de RLS para la transacción actual.
 *
 * <p>Aquí conviven las dos capas de aislamiento: el filtro explícito por {@code tenantId} en
 * la consulta y la Row-Level Security de PostgreSQL. La segunda protege incluso si alguien
 * olvidara la primera.
 */
@Repository
public class EstablishmentPersistenceAdapter implements EstablishmentRepository {

  private final EstablishmentSpringDataRepository repository;
  private final JdbcTemplate jdbcTemplate;

  public EstablishmentPersistenceAdapter(
      EstablishmentSpringDataRepository repository, JdbcTemplate jdbcTemplate) {
    this.repository = repository;
    this.jdbcTemplate = jdbcTemplate;
  }

  @Override
  public List<Establishment> findAllAlive(TenantId tenantId) {
    setDatabaseTenant(tenantId);
    return repository
        .findAllByTenantIdAndDeletedAtIsNullOrderByCreatedAtDesc(tenantId.value())
        .stream()
        .map(EstablishmentJpaEntity::toDomain)
        .toList();
  }

  @Override
  public Optional<Establishment> findAliveById(TenantId tenantId, UUID id) {
    setDatabaseTenant(tenantId);
    return repository
        .findByIdAndTenantIdAndDeletedAtIsNull(id, tenantId.value())
        .map(EstablishmentJpaEntity::toDomain);
  }

  @Override
  public Optional<Establishment> findAliveBySlug(TenantId tenantId, Slug slug) {
    setDatabaseTenant(tenantId);
    return repository
        .findBySlugAndTenantIdAndDeletedAtIsNull(slug.value(), tenantId.value())
        .map(EstablishmentJpaEntity::toDomain);
  }

  @Override
  public Establishment save(Establishment establishment) {
    setDatabaseTenant(establishment.tenantId());
    return repository.save(EstablishmentJpaEntity.fromDomain(establishment)).toDomain();
  }

  private void setDatabaseTenant(TenantId tenantId) {
    // set_config(..., true) equivale a SET LOCAL y se revierte al terminar la transacción.
    jdbcTemplate.queryForObject(
        "select set_config('app.tenant_id', ?, true)", String.class, tenantId.value());
  }
}
