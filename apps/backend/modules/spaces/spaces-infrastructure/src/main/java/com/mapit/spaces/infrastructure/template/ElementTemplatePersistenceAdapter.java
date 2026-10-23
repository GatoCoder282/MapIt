package com.mapit.spaces.infrastructure.template;

import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.template.ElementTemplate;
import com.mapit.spaces.domain.template.ElementTemplateId;
import com.mapit.spaces.domain.template.ElementTemplateRepository;

/**
 * Adaptador de persistencia de plantillas de elemento con activación de RLS por transacción.
 *
 * <p>Antes de cada operación activa el tenant de la BD con
 * {@code set_config('app.tenant_id', ?, true)} — mismo patrón que
 * {@code SpaceElementPersistenceAdapter} y {@code SectorPersistenceAdapter}.
 */
@Repository
public class ElementTemplatePersistenceAdapter implements ElementTemplateRepository {

  private final ElementTemplateSpringDataRepository repository;
  private final JdbcTemplate jdbcTemplate;

  public ElementTemplatePersistenceAdapter(
      ElementTemplateSpringDataRepository repository, JdbcTemplate jdbcTemplate) {
    this.repository = repository;
    this.jdbcTemplate = jdbcTemplate;
  }

  @Override
  public List<ElementTemplate> findAllAliveByTenant(TenantId tenantId) {
    setDatabaseTenant(tenantId);
    return repository.findAllAliveByTenant(tenantId.value()).stream()
        .map(ElementTemplateJpaEntity::toDomain)
        .toList();
  }

  @Override
  public Optional<ElementTemplate> findAliveById(TenantId tenantId, ElementTemplateId id) {
    setDatabaseTenant(tenantId);
    return repository.findAliveById(id.value(), tenantId.value())
        .map(ElementTemplateJpaEntity::toDomain);
  }

  @Override
  public ElementTemplate save(ElementTemplate template) {
    setDatabaseTenant(template.tenantId());
    return repository.save(ElementTemplateJpaEntity.fromDomain(template)).toDomain();
  }

  @Override
  public boolean existsAliveByName(TenantId tenantId, String name) {
    setDatabaseTenant(tenantId);
    return repository.existsAliveByName(tenantId.value(), name);
  }

  private void setDatabaseTenant(TenantId tenantId) {
    // set_config(..., true) equivale a SET LOCAL — se revierte al terminar la transacción.
    jdbcTemplate.queryForObject(
        "select set_config('app.tenant_id', ?, true)", String.class, tenantId.value());
  }
}
