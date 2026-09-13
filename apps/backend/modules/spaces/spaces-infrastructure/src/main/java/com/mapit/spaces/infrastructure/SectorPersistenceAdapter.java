package com.mapit.spaces.infrastructure;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Repository;
import org.springframework.jdbc.core.JdbcTemplate;

import com.mapit.spaces.domain.SectorId;
import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.Sector;
import com.mapit.spaces.domain.SectorRepository;
import com.mapit.spaces.domain.Slug;

/** Adaptador de persistencia de sectores con activacion de RLS por transaccion. */
@Repository
public class SectorPersistenceAdapter implements SectorRepository {

  private final SectorSpringDataRepository repository;
  private final JdbcTemplate jdbcTemplate;

  public SectorPersistenceAdapter(
      SectorSpringDataRepository repository, JdbcTemplate jdbcTemplate) {
    this.repository = repository;
    this.jdbcTemplate = jdbcTemplate;
  }

  @Override
  public List<Sector> findAliveByFloorId(TenantId tenantId, UUID floorId) {
    setDatabaseTenant(tenantId);
    return repository
        .findAllByTenantIdAndFloorIdOrderByNameAsc(tenantId.value(), floorId)
        .stream()
        .map(SectorJpaEntity::toDomain)
        .toList();
  }

  @Override
  public Optional<Sector> findAliveById(TenantId tenantId, SectorId id) {
    setDatabaseTenant(tenantId);
    return repository
        .findByIdAndTenantId(id.value(), tenantId.value())
        .map(SectorJpaEntity::toDomain);
  }

  @Override
  public Optional<Sector> findAliveBySlug(TenantId tenantId, UUID floorId, Slug slug) {
    setDatabaseTenant(tenantId);
    return repository
        .findByTenantIdAndFloorIdAndSlug(tenantId.value(), floorId, slug.value())
        .map(SectorJpaEntity::toDomain);
  }

  @Override
  public Sector save(Sector sector) {
    setDatabaseTenant(sector.tenantId());
    return repository
        .save(SectorJpaEntity.fromDomain(sector))
        .toDomain();
  }

  private void setDatabaseTenant(TenantId tenantId) {
    // set_config(..., true) equivale a SET LOCAL y se revierte al terminar la transaccion.
    jdbcTemplate.queryForObject(
        "select set_config('app.tenant_id', ?, true)", String.class, tenantId.value());
  }
}
