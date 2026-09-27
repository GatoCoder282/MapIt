package com.mapit.spaces.infrastructure.sector;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

/** Repositorio Spring Data interno del adaptador de Sector. */
interface SectorSpringDataRepository extends JpaRepository<SectorJpaEntity, UUID> {

  List<SectorJpaEntity> findAllByTenantIdAndFloorIdAndDeletedAtIsNullOrderByNameAsc(
      String tenantId, UUID floorId);

  Optional<SectorJpaEntity> findByTenantIdAndFloorIdAndSlugAndDeletedAtIsNull(
      String tenantId, UUID floorId, String slug);

  Optional<SectorJpaEntity> findByIdAndTenantIdAndDeletedAtIsNull(UUID id, String tenantId);
}
