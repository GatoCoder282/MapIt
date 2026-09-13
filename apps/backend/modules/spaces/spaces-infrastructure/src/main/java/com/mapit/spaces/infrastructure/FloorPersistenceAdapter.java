package com.mapit.spaces.infrastructure;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.shared.tenant.TenantContext; // Import TenantContext
import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.Floor;
import com.mapit.spaces.domain.FloorRepository;
import com.mapit.spaces.domain.Slug;
import com.mapit.spaces.application.EstablishmentNotFoundException; // Assuming this exists

/**
 * Adaptador JPA del puerto de pisos y activación de RLS.
 *
 * <p>Doble capa de aislamiento: filtro explícito por tenantId + RLS de PostgreSQL.
 */
@Repository
public class FloorPersistenceAdapter implements FloorRepository {

  private final FloorSpringDataRepository repository;
  private final JdbcTemplate jdbcTemplate;
  private final TenantContext tenantContext; // Inject TenantContext

  public FloorPersistenceAdapter(
      FloorSpringDataRepository repository,
      JdbcTemplate jdbcTemplate,
      TenantContext tenantContext) { // Inject TenantContext
    this.repository = repository;
    this.jdbcTemplate = jdbcTemplate;
    this.tenantContext = tenantContext; // Assign TenantContext
  }

  @Override
  public List<Floor> findAliveByEstablishmentId(TenantId tenantId, UUID establishmentId) {
    setDatabaseTenant(tenantId); // Ensure RLS is set
    return repository
        .findAllByTenantIdAndEstablishmentIdAndDeletedAtIsNullOrderByLevelAsc(
            tenantId.value(), establishmentId)
        .stream()
        .map(FloorJpaEntity::toDomain)
        .toList();
  }

  @Override
  public Optional<Floor> findAliveById(TenantId tenantId, UUID id) {
    setDatabaseTenant(tenantId); // Ensure RLS is set
    return repository
        .findByIdAndTenantIdAndDeletedAtIsNull(id, tenantId.value())
        .map(FloorJpaEntity::toDomain);
  }

  @Override
  public Optional<Floor> findAliveBySlug(TenantId tenantId, UUID establishmentId, Slug slug) {
    setDatabaseTenant(tenantId); // Ensure RLS is set
    return repository
        .findBySlugAndEstablishmentIdAndTenantIdAndDeletedAtIsNull(
            slug.value(), establishmentId, tenantId.value())
        .map(FloorJpaEntity::toDomain);
  }

  @Override
  public boolean existsAliveByLevel(TenantId tenantId, UUID establishmentId, int level) {
    setDatabaseTenant(tenantId); // Ensure RLS is set
    return repository.existsByTenantIdAndEstablishmentIdAndLevelAndDeletedAtIsNull(
        tenantId.value(), establishmentId, level);
  }

  @Override
  public Optional<Integer> findMaxLevel(TenantId tenantId, UUID establishmentId) {
    setDatabaseTenant(tenantId); // Ensure RLS is set
    return repository.findMaxLevelByTenantIdAndEstablishmentId(
        tenantId.value(), establishmentId);
  }

  @Override
  public Floor save(Floor floor) {
    setDatabaseTenant(floor.tenantId()); // Ensure RLS is set before saving
    FloorJpaEntity jpaEntity = FloorJpaEntity.fromDomain(floor);
    // Spring Data JPA automatically handles INSERT vs UPDATE based on whether the ID exists.
    // For soft delete, the entity is still 'saved' (updated), not physically removed.
    return repository.save(jpaEntity).toDomain();
  }

  private void setDatabaseTenant(TenantId tenantId) {
    // This sets the 'app.tenant_id' configuration parameter for the current session,
    // which is used by PostgreSQL's RLS policies.
    jdbcTemplate.queryForObject(
        "select set_config('app.tenant_id', ?, true)",
        String.class,
        tenantId.value());
  }
}
