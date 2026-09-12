package com.mapit.spaces.infrastructure;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Repositorio Spring Data interno del adaptador de persistencia.
 *
 * <p>Todos los métodos que buscan entidades vivas filtran por {@code deletedAt IS NULL}.
 */
public interface FloorSpringDataRepository extends JpaRepository<FloorJpaEntity, UUID> {

  List<FloorJpaEntity> findAllByTenantIdAndEstablishmentIdAndDeletedAtIsNullOrderByLevelAsc(
      String tenantId, UUID establishmentId);

  Optional<FloorJpaEntity> findByIdAndTenantIdAndDeletedAtIsNull(UUID id, String tenantId);

  Optional<FloorJpaEntity> findBySlugAndEstablishmentIdAndTenantIdAndDeletedAtIsNull(
      String slug, UUID establishmentId, String tenantId);

  boolean existsByTenantIdAndEstablishmentIdAndLevelAndDeletedAtIsNull(
      String tenantId, UUID establishmentId, Integer level);

  @Query("select max(f.level) from FloorJpaEntity f where f.tenantId = :tenantId " +
         "and f.establishmentId = :establishmentId and f.deletedAt is null")
  Optional<Integer> findMaxLevelByTenantIdAndEstablishmentId(
      @Param("tenantId") String tenantId, @Param("establishmentId") UUID establishmentId);
}
