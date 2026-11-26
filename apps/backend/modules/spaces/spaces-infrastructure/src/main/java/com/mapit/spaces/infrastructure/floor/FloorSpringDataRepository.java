package com.mapit.spaces.infrastructure.floor;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Repositorio Spring Data interno del adaptador de persistencia.
 *
 * <p>Todos los métodos que buscan entidades vivas filtran por {@code deletedAt IS NULL}.
 */
public interface FloorSpringDataRepository extends JpaRepository<FloorJpaEntity, UUID> {

  @Query(value = """
      select * from floor where tenant_id = :tenantId and establishment_id = :establishmentId
        and deleted_at is null order by display_order nulls last, level
      """, nativeQuery = true)
  List<FloorJpaEntity> findAliveByEstablishment(
      @Param("tenantId") String tenantId, @Param("establishmentId") UUID establishmentId);

  Optional<FloorJpaEntity> findByIdAndTenantIdAndDeletedAtIsNull(UUID id, String tenantId);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  Optional<FloorJpaEntity> findOneByIdAndTenantIdAndDeletedAtIsNull(UUID id, String tenantId);

  Optional<FloorJpaEntity> findBySlugAndEstablishmentIdAndTenantIdAndDeletedAtIsNull(
      String slug, UUID establishmentId, String tenantId);

  boolean existsByTenantIdAndEstablishmentIdAndLevelAndDeletedAtIsNull(
      String tenantId, UUID establishmentId, Integer level);

  @Query("select max(f.level) from FloorJpaEntity f where f.tenantId = :tenantId " +
         "and f.establishmentId = :establishmentId and f.deletedAt is null")
  Optional<Integer> findMaxLevelByTenantIdAndEstablishmentId(
      @Param("tenantId") String tenantId, @Param("establishmentId") UUID establishmentId);
}
