package com.mapit.spaces.infrastructure.spaceelement;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.spaceelement.SpaceElement;
import com.mapit.spaces.domain.spaceelement.SpaceElementId;
import com.mapit.spaces.domain.spaceelement.SpaceElementRepository;

/** Adaptador de persistencia de elementos espaciales con activación de RLS por transacción.
 *
 * <p>Antes de cada operación activa el tenant de la BD con
 * {@code set_config('app.tenant_id', ?, true)} (equivale a {@code SET LOCAL}, se revierte
 * al terminar la transacción). La consulta JPQL filtra además por tenant, así la fila solo
 * se lee si el contexto coincide: es el mismo patrón que {@code SectorPersistenceAdapter}.
 */
@Repository
public class SpaceElementPersistenceAdapter implements SpaceElementRepository {

  private final SpaceElementSpringDataRepository repository;
  private final JdbcTemplate jdbcTemplate;

  public SpaceElementPersistenceAdapter(
      SpaceElementSpringDataRepository repository, JdbcTemplate jdbcTemplate) {
    this.repository = repository;
    this.jdbcTemplate = jdbcTemplate;
  }

  @Override
  public List<SpaceElement> findAliveBySectorId(TenantId tenantId, UUID sectorId) {
    setDatabaseTenant(tenantId);
    return repository
        .findAllAliveByTenantAndSector(tenantId.value(), sectorId)
        .stream()
        .map(SpaceElementJpaEntity::toDomain)
        .toList();
  }

  @Override
  public Optional<SpaceElement> findAliveById(
      TenantId tenantId, UUID sectorId, SpaceElementId id) {
    setDatabaseTenant(tenantId);
    return repository
        .findAliveById(id.value(), sectorId, tenantId.value())
        .map(SpaceElementJpaEntity::toDomain);
  }

  @Override
  public SpaceElement save(SpaceElement element) {
    setDatabaseTenant(element.tenantId());
    return repository.save(SpaceElementJpaEntity.fromDomain(element)).toDomain();
  }

  private void setDatabaseTenant(TenantId tenantId) {
    // set_config(..., true) equivale a SET LOCAL y se revierte al terminar la transacción.
    jdbcTemplate.queryForObject(
        "select set_config('app.tenant_id', ?, true)", String.class, tenantId.value());
  }
}
