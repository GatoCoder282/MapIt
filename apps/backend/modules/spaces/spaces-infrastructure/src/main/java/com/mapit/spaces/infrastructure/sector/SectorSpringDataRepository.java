package com.mapit.spaces.infrastructure.sector;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

/** Repositorio Spring Data interno del adaptador de Sector. */
interface SectorSpringDataRepository extends JpaRepository<SectorJpaEntity, UUID> {

  List<SectorJpaEntity> findAllByTenantIdAndFloorIdOrderByNameAsc(
      String tenantId, UUID floorId);

  Optional<SectorJpaEntity> findByTenantIdAndFloorIdAndSlug(
      String tenantId, UUID floorId, String slug);

  Optional<SectorJpaEntity> findByIdAndTenantId(UUID id, String tenantId);
}
