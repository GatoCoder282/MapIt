package com.mapit.spaces.infrastructure;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Repositorio Spring Data interno del adaptador de SpaceElement. */
interface SpaceElementSpringDataRepository extends JpaRepository<SpaceElementJpaEntity, UUID> {

  @Query(
      "select e from SpaceElementJpaEntity e "
          + "where e.tenantId = :tenantId and e.sectorId = :sectorId and e.deletedAt is null "
          + "order by e.createdAt desc")
  List<SpaceElementJpaEntity> findAllAliveByTenantAndSector(
      @Param("tenantId") String tenantId, @Param("sectorId") UUID sectorId);

  @Query(
      "select e from SpaceElementJpaEntity e "
          + "where e.id = :id and e.sectorId = :sectorId and e.tenantId = :tenantId "
          + "and e.deletedAt is null")
  Optional<SpaceElementJpaEntity> findAliveById(
      @Param("id") UUID id, @Param("sectorId") UUID sectorId, @Param("tenantId") String tenantId);
}
